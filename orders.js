/* ==========================================================================
   Q8Dreams Orders & Incomplete Leads Dashboard (Admin Auth Protected)
   ========================================================================== */

let allOrders = [];
let activeFilter = 'all';
let activeLanding = 'all';
let searchQuery = '';

// بيانات الدخول الاحتياطية عند الفتح المباشر عبر file:// (طابقها مع server.js)
const LOCAL_ADMIN_USER = 'admin';
const LOCAL_ADMIN_PASS = 'q8dreams2026';

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initControls();
});

function getToken() {
  return sessionStorage.getItem('q8_admin_token') || '';
}

function showLogin() {
  document.getElementById('login-view').hidden = false;
  document.getElementById('dashboard-view').hidden = true;
  document.getElementById('logout-btn').hidden = true;
}

function showDashboard() {
  document.getElementById('login-view').hidden = true;
  document.getElementById('dashboard-view').hidden = false;
  document.getElementById('logout-btn').hidden = false;
  loadOrders();
}

function initAuth() {
  const loginForm = document.getElementById('login-form');
  const loginErr = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');

  if (getToken()) {
    showDashboard();
  } else {
    showLogin();
  }

  logoutBtn?.addEventListener('click', () => {
    sessionStorage.removeItem('q8_admin_token');
    showLogin();
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErr.className = 'form-status body-5';
    loginErr.textContent = '';

    const username = document.getElementById('admin-user').value.trim();
    const password = document.getElementById('admin-pass').value;

    if (window.location.protocol === 'file:') {
      if (username === LOCAL_ADMIN_USER && password === LOCAL_ADMIN_PASS) {
        sessionStorage.setItem('q8_admin_token', 'local-mode');
        showDashboard();
      } else {
        loginErr.className = 'form-status is-error body-5';
        loginErr.innerHTML = '<i class="ph ph-warning-circle"></i><span>اسم المستخدم أو كلمة المرور غير صحيحة.</span>';
      }
      return;
    }

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        loginErr.className = 'form-status is-error body-5';
        loginErr.innerHTML = '<i class="ph ph-warning-circle"></i><span>اسم المستخدم أو كلمة المرور غير صحيحة.</span>';
        return;
      }

      const { token } = await res.json();
      sessionStorage.setItem('q8_admin_token', token);
      showDashboard();
    } catch {
      loginErr.className = 'form-status is-error body-5';
      loginErr.innerHTML = '<i class="ph ph-warning-circle"></i><span>تعذر الاتصال بالسيرفر.</span>';
    }
  });
}

function initControls() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeFilter = btn.dataset.filter;
      renderTable();
    });
  });

  const landingFilter = document.getElementById('landing-filter');
  if (landingFilter) {
    landingFilter.addEventListener('change', (e) => {
      activeLanding = e.target.value;
      renderTable();
    });
  }

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderTable();
    });
  }

  document.getElementById('refresh-btn')?.addEventListener('click', loadOrders);
  document.getElementById('export-btn')?.addEventListener('click', exportCsv);
}

async function loadOrders() {
  if (window.location.protocol !== 'file:') {
    try {
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 401) {
        sessionStorage.removeItem('q8_admin_token');
        showLogin();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        allOrders = data.orders || [];
        renderStats();
        renderTable();
        return;
      }
    } catch {}
  }

  try {
    allOrders = JSON.parse(localStorage.getItem('q8_local_orders') || '[]')
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } catch {
    allOrders = [];
  }
  renderStats();
  renderTable();
}

function renderStats() {
  const completed = allOrders.filter((o) => o.status === 'completed');
  const incomplete = allOrders.filter((o) => o.status !== 'completed');
  const revenue = completed.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

  document.getElementById('stat-total').textContent = String(allOrders.length);
  document.getElementById('stat-completed').textContent = String(completed.length);
  document.getElementById('stat-incomplete').textContent = String(incomplete.length);
  document.getElementById('stat-revenue').textContent = `${revenue.toFixed(2)} د.ك`;
}

function getFilteredOrders() {
  return allOrders.filter((o) => {
    if (activeFilter !== 'all' && o.status !== activeFilter) return false;
    const land = o.landing || 'default';
    if (activeLanding !== 'all' && land !== activeLanding) return false;
    if (!searchQuery) return true;
    const hay = [o.orderNumber, o.landing, o.name, o.phone, o.governorate, o.address]
      .join(' ')
      .toLowerCase();
    return hay.includes(searchQuery);
  });
}

function renderTable() {
  const tbody = document.getElementById('orders-tbody');
  const emptyState = document.getElementById('empty-state');
  const list = getFilteredOrders();

  if (!list.length) {
    tbody.innerHTML = '';
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  tbody.innerHTML = list.map((o) => {
    const isCompleted = o.status === 'completed';
    const badge = isCompleted
      ? '<span class="badge badge-completed caption-3"><i class="ph-fill ph-check-circle"></i> مكتمل</span>'
      : '<span class="badge badge-incomplete caption-3"><i class="ph-fill ph-clock"></i> غير مكتمل</span>';

    const cleanPhone = (o.phone || '').replace(/\D/g, '');
    const waLink = cleanPhone.length === 8 ? `https://wa.me/965${cleanPhone}` : null;

    const dateStr = new Date(o.updatedAt).toLocaleString('ar-KW', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const fulfillmentSelect = isCompleted
      ? `<select class="input caption-4" style="min-height: 34px; padding: 4px 8px; width: 120px;" data-id="${escapeHtml(o.id)}">
          ${['جديد', 'تم التأكيد', 'تم التوصيل', 'ملغي']
            .map((opt) => `<option value="${opt}" ${o.fulfillmentStatus === opt ? 'selected' : ''}>${opt}</option>`)
            .join('')}
         </select>`
      : '<span class="caption-4" style="color: var(--ink-muted);">لم يضغط طلب</span>';

    const landingLabels = {
      'lp-pain': 'آلام الرقبة',
      'lp-sleep': 'النوم العميق',
      'lp-gift': 'العائلة والهدية',
      'v2': 'النسخة V2',
      'default': 'الرئيسية',
    };
    const landingText = landingLabels[o.landing || 'default'] || (o.landing || 'الرئيسية');

    return `
      <tr>
        <td class="num-tabular body-4">${escapeHtml(o.orderNumber || '-')}</td>
        <td><span class="caption-3" style="background: var(--surface-muted); padding: 4px 10px; border-radius: var(--radius-full); color: var(--brand-primary);">${escapeHtml(landingText)}</span></td>
        <td>${badge}</td>
        <td class="body-4">${escapeHtml(o.name || 'بدون اسم')}</td>
        <td class="num-tabular" dir="ltr">${escapeHtml(o.phone || 'بدون هاتف')}</td>
        <td>${escapeHtml([o.governorate, o.address].filter(Boolean).join('، ') || 'لم يُدخل بعد')}</td>
        <td class="num-tabular">${escapeHtml(o.qty)} وسادة • <strong>${escapeHtml(o.total)} د.ك</strong></td>
        <td>${fulfillmentSelect}</td>
        <td class="caption-4" style="color: var(--ink-muted);">${escapeHtml(dateStr)}</td>
        <td>
          <div class="action-row">
            ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener" class="icon-btn" title="مراسلة واتساب" aria-label="واتساب"><i class="ph ph-whatsapp-logo"></i></a>` : ''}
            <button type="button" class="icon-btn delete-btn" data-id="${escapeHtml(o.id)}" title="حذف السجل" aria-label="حذف"><i class="ph ph-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('select[data-id]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      if (window.location.protocol !== 'file:') {
        try {
          await fetch(`/api/orders/${encodeURIComponent(sel.dataset.id)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ fulfillmentStatus: sel.value }),
          });
          await loadOrders();
          return;
        } catch {}
      }
      const list = JSON.parse(localStorage.getItem('q8_local_orders') || '[]');
      const item = list.find((o) => o.id === sel.dataset.id);
      if (item) {
        item.fulfillmentStatus = sel.value;
        item.updatedAt = new Date().toISOString();
        localStorage.setItem('q8_local_orders', JSON.stringify(list));
      }
      await loadOrders();
    });
  });

  tbody.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (window.location.protocol !== 'file:') {
        try {
          await fetch(`/api/orders/${encodeURIComponent(btn.dataset.id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${getToken()}` },
          });
          await loadOrders();
          return;
        } catch {}
      }
      const list = JSON.parse(localStorage.getItem('q8_local_orders') || '[]')
        .filter((o) => o.id !== btn.dataset.id);
      localStorage.setItem('q8_local_orders', JSON.stringify(list));
      await loadOrders();
    });
  });
}

function exportCsv() {
  const headers = ['المرجع', 'اللاندنج', 'الحالة', 'الاسم', 'الهاتف', 'المحافظة', 'العنوان', 'الكمية', 'الإجمالي', 'حالة التنفيذ', 'التاريخ'];
  const rows = getFilteredOrders().map((o) => [
    o.orderNumber,
    o.landing || 'default',
    o.status === 'completed' ? 'مكتمل' : 'غير مكتمل',
    o.name,
    o.phone,
    o.governorate,
    o.address,
    o.qty,
    o.total,
    o.fulfillmentStatus,
    o.updatedAt,
  ]);

  const csvContent = '\uFEFF' + [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `q8dreams-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}
