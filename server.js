const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'data', 'orders.json');
const CONFIG_FILE = path.join(ROOT_DIR, 'config.json');

// بيانات الدخول الثابتة للوحة متابعة الطلبات (يمكنك تغييرها من هنا مباشرة)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'q8dreams2026';
const adminTokens = new Set();

const incompleteTimers = new Map();

function loadConfig() {
  let fileCfg = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fileCfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {}
  return {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || fileCfg.telegramBotToken || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || fileCfg.telegramChatId || '',
    incompleteDelayMs: (Number(fileCfg.incompleteNotifyDelaySeconds) || 120) * 1000,
  };
}

async function sendTelegramNotification(order) {
  const { telegramBotToken, telegramChatId } = loadConfig();
  if (!telegramBotToken || !telegramChatId) return;

  const isCompleted = order.status === 'completed';
  const cleanPhone = String(order.phone || '').replace(/\D/g, '');
  const waLine = cleanPhone.length === 8
    ? `\n💬 واتساب مباشر: https://wa.me/965${cleanPhone}`
    : '';

  const text = isCompleted
    ? `✅ طلب جديد مكتمل (${order.orderNumber})\n` +
      `🏷️ اللاندنج: ${order.landing || 'default'}${order.utmSource ? ` (${order.utmSource})` : ''}\n` +
      `👤 الاسم: ${order.name || '-'}\n` +
      `📱 الهاتف: ${order.phone || '-'}\n` +
      `📍 العنوان: ${[order.governorate, order.address].filter(Boolean).join('، ') || '-'}\n` +
      `🛏️ الكمية: ${order.qty} وسادة\n` +
      `💰 الإجمالي: ${order.total} د.ك (الدفع عند الاستلام)${waLine}`
    : `⏳ عميل أدخل بياناته ولم يضغط طلب (${order.orderNumber})\n` +
      `🏷️ اللاندنج: ${order.landing || 'default'}\n` +
      `👤 الاسم: ${order.name || 'لم يُكتب'}\n` +
      `📱 الهاتف: ${order.phone || 'لم يُكتب'}\n` +
      `📍 العنوان: ${[order.governorate, order.address].filter(Boolean).join('، ') || 'غير مكتمل'}\n` +
      `🛏️ الباقة المختارة: ${order.qty} وسادة (${order.total} د.ك)${waLine}`;

  try {
    await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text,
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error('Telegram notification error:', err.message);
  }
}

function scheduleIncompleteNotification(orderId, sessionId) {
  const { incompleteDelayMs } = loadConfig();
  if (incompleteTimers.has(sessionId)) {
    clearTimeout(incompleteTimers.get(sessionId));
  }

  const timer = setTimeout(() => {
    incompleteTimers.delete(sessionId);
    const orders = readOrders();
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status !== 'incomplete' || order.notifiedIncomplete) return;
    if (!order.phone && !order.name) return;

    order.notifiedIncomplete = true;
    writeOrders(orders);
    sendTelegramNotification(order);
  }, incompleteDelayMs);

  incompleteTimers.set(sessionId, timer);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.ico': 'image/x-icon',
};

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readOrders() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function nextOrderNumber(orders) {
  const completedCount = orders.filter((o) => o.status === 'completed').length;
  return `Q8-${1001 + completedCount}`;
}

function isAuthorizedAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return Boolean(token && adminTokens.has(token));
}

async function handleApi(req, res, urlObj) {
  const pathname = urlObj.pathname;

  // POST /api/admin/login
  if (req.method === 'POST' && pathname === '/api/admin/login') {
    try {
      const data = await parseBody(req);
      if (data.username === ADMIN_USERNAME && data.password === ADMIN_PASSWORD) {
        const token = crypto.randomBytes(24).toString('hex');
        adminTokens.add(token);
        return sendJson(res, 200, { token });
      }
      return sendJson(res, 401, { error: 'بيانات الدخول غير صحيحة' });
    } catch {
      return sendJson(res, 400, { error: 'Invalid request body' });
    }
  }

  // GET /api/orders (Admin only)
  if (req.method === 'GET' && pathname === '/api/orders') {
    if (!isAuthorizedAdmin(req)) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    const orders = readOrders().sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    return sendJson(res, 200, { orders });
  }

  // GET /api/orders/:id
  if (req.method === 'GET' && pathname.startsWith('/api/orders/')) {
    const id = decodeURIComponent(pathname.replace('/api/orders/', ''));
    const order = readOrders().find((o) => o.id === id);
    if (!order) return sendJson(res, 404, { error: 'Order not found' });
    return sendJson(res, 200, { order });
  }

  // POST /api/orders (upsert draft/incomplete or complete order by sessionId)
  if (req.method === 'POST' && pathname === '/api/orders') {
    try {
      const data = await parseBody(req);
      const orders = readOrders();
      const now = new Date().toISOString();

      const sessionId = String(data.sessionId || '').trim() || crypto.randomUUID();
      const incomingStatus = data.status === 'completed' ? 'completed' : 'incomplete';

      let existing = orders.find(
        (o) => o.sessionId === sessionId && o.status === 'incomplete'
      );

      if (!existing && incomingStatus === 'completed' && data.orderId) {
        existing = orders.find((o) => o.id === data.orderId);
      }

      if (existing) {
        existing.landing = data.landing ?? existing.landing;
        existing.product = data.product ?? existing.product;
        existing.utmSource = data.utmSource ?? existing.utmSource;
        existing.name = data.name ?? existing.name;
        existing.phone = data.phone ?? existing.phone;
        existing.governorate = data.governorate ?? existing.governorate;
        existing.address = data.address ?? existing.address;
        existing.qty = data.qty ?? existing.qty;
        existing.total = data.total ?? existing.total;
        existing.updatedAt = now;

        if (incomingStatus === 'completed' && existing.status !== 'completed') {
          existing.status = 'completed';
          existing.orderNumber = nextOrderNumber(orders);
          existing.fulfillmentStatus = 'جديد';
          existing.completedAt = now;
          if (incompleteTimers.has(sessionId)) {
            clearTimeout(incompleteTimers.get(sessionId));
            incompleteTimers.delete(sessionId);
          }
          writeOrders(orders);
          sendTelegramNotification(existing);
          return sendJson(res, 200, { order: existing });
        }

        writeOrders(orders);
        if (existing.status === 'incomplete') {
          scheduleIncompleteNotification(existing.id, sessionId);
        }
        return sendJson(res, 200, { order: existing });
      }

      const newOrder = {
        id: crypto.randomUUID(),
        sessionId,
        landing: String(data.landing || 'default').trim(),
        product: String(data.product || 'وسادة الفراشة الطبية').trim(),
        utmSource: String(data.utmSource || '').trim(),
        orderNumber:
          incomingStatus === 'completed'
            ? nextOrderNumber(orders)
            : `LEAD-${String(orders.length + 1).padStart(4, '0')}`,
        name: String(data.name || '').trim(),
        phone: String(data.phone || '').trim(),
        governorate: String(data.governorate || '').trim(),
        address: String(data.address || '').trim(),
        qty: String(data.qty || '1'),
        total: String(data.total || '18.00'),
        status: incomingStatus,
        fulfillmentStatus: incomingStatus === 'completed' ? 'جديد' : 'لم يكتمل',
        createdAt: now,
        updatedAt: now,
        completedAt: incomingStatus === 'completed' ? now : null,
      };

      orders.push(newOrder);
      writeOrders(orders);
      if (newOrder.status === 'completed') {
        if (incompleteTimers.has(sessionId)) {
          clearTimeout(incompleteTimers.get(sessionId));
          incompleteTimers.delete(sessionId);
        }
        sendTelegramNotification(newOrder);
      } else {
        scheduleIncompleteNotification(newOrder.id, sessionId);
      }
      return sendJson(res, 201, { order: newOrder });
    } catch {
      return sendJson(res, 400, { error: 'Invalid request body' });
    }
  }

  // PATCH /api/orders/:id (Admin only — update fulfillmentStatus)
  if (req.method === 'PATCH' && pathname.startsWith('/api/orders/')) {
    if (!isAuthorizedAdmin(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    try {
      const id = decodeURIComponent(pathname.replace('/api/orders/', ''));
      const data = await parseBody(req);
      const orders = readOrders();
      const order = orders.find((o) => o.id === id);
      if (!order) return sendJson(res, 404, { error: 'Order not found' });

      if (data.fulfillmentStatus) {
        order.fulfillmentStatus = String(data.fulfillmentStatus);
      }
      order.updatedAt = new Date().toISOString();
      writeOrders(orders);
      return sendJson(res, 200, { order });
    } catch {
      return sendJson(res, 400, { error: 'Invalid request body' });
    }
  }

  // DELETE /api/orders/:id (Admin only)
  if (req.method === 'DELETE' && pathname.startsWith('/api/orders/')) {
    if (!isAuthorizedAdmin(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const id = decodeURIComponent(pathname.replace('/api/orders/', ''));
    const orders = readOrders();
    const filtered = orders.filter((o) => o.id !== id);
    if (filtered.length === orders.length) {
      return sendJson(res, 404, { error: 'Order not found' });
    }
    writeOrders(filtered);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: 'API route not found' });
}

function serveStatic(req, res, urlObj) {
  let reqPath = decodeURIComponent(urlObj.pathname);
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.normalize(path.join(ROOT_DIR, reqPath));
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  // Never expose data/orders.json or config.json directly as static files
  if (filePath === DATA_FILE || filePath === CONFIG_FILE) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  if (urlObj.pathname.startsWith('/api/')) {
    return handleApi(req, res, urlObj);
  }
  return serveStatic(req, res, urlObj);
});

server.listen(PORT, () => {
  ensureDataFile();
  console.log(`Q8Dreams standalone store running at http://localhost:${PORT}`);
});
