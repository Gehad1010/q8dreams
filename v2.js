/* ==========================================================================
   Q8Dreams V2 Interactions (Gallery, Countdown, Lead Tracking, Tagline, FAQ)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initCountdown();
  initGallery();
  initOrderForm();
  initFaq();
  initReveals();
  initTaglineReveal();
});

function initCountdown() {
  const el = document.getElementById('countdown-timer');
  if (!el) return;
  let seconds = 2 * 3600 + 45 * 60 + 19;
  setInterval(() => {
    seconds = seconds > 0 ? seconds - 1 : 2 * 3600 + 45 * 60;
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    el.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

function initGallery() {
  const thumbs = document.querySelectorAll('.thumb-btn');
  const img = document.getElementById('v2-active-img');
  const video = document.getElementById('v2-active-video');
  if (!thumbs.length || !img || !video) return;

  thumbs.forEach((btn) => {
    btn.addEventListener('click', () => {
      thumbs.forEach((t) => t.classList.remove('is-active'));
      btn.classList.add('is-active');

      if (btn.dataset.type === 'video') {
        img.hidden = true;
        video.hidden = false;
        video.play().catch(() => {});
      } else {
        video.pause();
        video.hidden = true;
        img.hidden = false;
        img.src = btn.dataset.src;
      }
    });
  });
}

function getSessionId() {
  let id = sessionStorage.getItem('q8_session_id');
  if (!id) {
    id = (crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('q8_session_id', id);
  }
  return id;
}

function initOrderForm() {
  const bundles = document.querySelectorAll('.bundle-opt');
  const priceEl = document.getElementById('v2-price');
  const oldEl = document.getElementById('v2-old');
  const totalEl = document.getElementById('v2-total');
  const stickyEl = document.getElementById('sticky-price');
  const form = document.getElementById('order-form');
  const statusEl = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn');

  let selected = { qty: '1', price: '18.00', old: '24.00' };
  const sessionId = getSessionId();
  let isSubmitted = false;
  let timer = null;

  const nameIn = document.getElementById('customer-name');
  const phoneIn = document.getElementById('customer-phone');
  const phoneConfirmIn = document.getElementById('customer-phone-confirm');
  const govIn = document.getElementById('customer-gov');
  const addrIn = document.getElementById('customer-address');

  phoneConfirmIn?.addEventListener('paste', (e) => e.preventDefault());

  const payload = (status) => ({
    sessionId,
    name: nameIn ? nameIn.value.trim() : '',
    phone: phoneIn ? phoneIn.value.trim() : '',
    governorate: govIn ? govIn.value.trim() : '',
    address: addrIn ? addrIn.value.trim() : '',
    qty: selected.qty,
    total: selected.price,
    status,
  });

  const saveLocal = (data) => {
    try {
      const list = JSON.parse(localStorage.getItem('q8_local_orders') || '[]');
      const now = new Date().toISOString();
      let ex = list.find((o) => o.sessionId === data.sessionId && o.status === 'incomplete');
      if (ex) {
        Object.assign(ex, data, { updatedAt: now });
        if (data.status === 'completed') {
          ex.fulfillmentStatus = 'جديد';
          ex.orderNumber = `Q8-${1001 + list.filter((o) => o.status === 'completed').length - 1}`;
          ex.completedAt = now;
        }
        localStorage.setItem('q8_local_orders', JSON.stringify(list));
        return ex;
      }
      const item = {
        id: `loc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ...data,
        orderNumber: data.status === 'completed'
          ? `Q8-${1001 + list.filter((o) => o.status === 'completed').length}`
          : `LEAD-${String(list.length + 1).padStart(4, '0')}`,
        fulfillmentStatus: data.status === 'completed' ? 'جديد' : 'لم يكتمل',
        createdAt: now,
        updatedAt: now,
      };
      list.push(item);
      localStorage.setItem('q8_local_orders', JSON.stringify(list));
      return item;
    } catch { return null; }
  };

  const saveDraft = () => {
    const p = payload('incomplete');
    if (isSubmitted || (p.name.length < 2 && p.phone.length < 3 && p.address.length < 3)) return;
    if (window.location.protocol === 'file:') { saveLocal(p); return; }
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    }).catch(() => saveLocal(p));
  };

  const scheduleDraft = () => {
    clearTimeout(timer);
    timer = setTimeout(saveDraft, 500);
  };

  bundles.forEach((b) => {
    b.addEventListener('click', () => {
      bundles.forEach((x) => { x.classList.remove('is-selected'); x.setAttribute('aria-checked', 'false'); });
      b.classList.add('is-selected');
      b.setAttribute('aria-checked', 'true');
      selected = { qty: b.dataset.qty, price: b.dataset.price, old: b.dataset.old };
      if (priceEl) priceEl.textContent = `${selected.price} د.ك`;
      if (oldEl) oldEl.textContent = `${selected.old} د.ك`;
      if (totalEl) totalEl.textContent = `${selected.price} د.ك`;
      if (stickyEl) stickyEl.textContent = `${selected.price} د.ك`;
      scheduleDraft();
    });
  });

  if (!form) return;

  const rules = [
    { el: nameIn, err: document.getElementById('err-name'), ok: (v) => v.trim().length >= 3 },
    { el: phoneIn, err: document.getElementById('err-phone'), ok: (v) => /^[4569]\d{7}$/.test(v.replace(/\s+/g, '')) },
    {
      el: phoneConfirmIn,
      err: document.getElementById('err-phone-confirm'),
      ok: (v) => {
        const clean1 = (phoneIn?.value || '').replace(/\s+/g, '');
        const clean2 = v.replace(/\s+/g, '');
        return /^[4569]\d{7}$/.test(clean2) && clean1 === clean2;
      },
    },
    { el: govIn, err: document.getElementById('err-gov'), ok: (v) => v.trim().length > 0 },
    { el: addrIn, err: document.getElementById('err-address'), ok: (v) => v.trim().length >= 5 },
  ];

  rules.forEach(({ el, err }) => {
    if (!el) return;
    el.addEventListener('input', () => { el.classList.remove('is-error'); err?.classList.remove('is-visible'); scheduleDraft(); });
    el.addEventListener('change', scheduleDraft);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let bad = false;
    rules.forEach(({ el, err, ok }) => {
      const valid = ok(el.value);
      el.classList.toggle('is-error', !valid);
      err?.classList.toggle('is-visible', !valid);
      if (!valid) bad = true;
    });

    if (bad) {
      saveDraft();
      statusEl.className = 'form-msg is-error body-md';
      statusEl.innerHTML = '<i class="ph ph-warning-circle"></i><span>يرجى استكمال الحقول المطلوبة.</span>';
      return;
    }

    clearTimeout(timer);
    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'جاري تسجيل طلبك...';

    try {
      const data = payload('completed');
      let order = null;
      if (window.location.protocol !== 'file:') {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) order = (await res.json()).order;
      }
      if (!order) order = saveLocal(data);
      if (!order) throw new Error('Save failed');

      isSubmitted = true;
      sessionStorage.setItem('q8_last_order', JSON.stringify(order));
      sessionStorage.removeItem('q8_session_id');
      window.location.href = `./thank-you.html?id=${encodeURIComponent(order.id)}`;
    } catch {
      submitBtn.disabled = false;
      submitBtn.querySelector('span').textContent = 'اطلب الآن وادفع عند الاستلام';
      statusEl.className = 'form-msg is-error body-md';
      statusEl.innerHTML = '<i class="ph ph-warning-circle"></i><span>تعذر إرسال الطلب حالياً. حاول مرة أخرى.</span>';
    }
  });
}

function initFaq() {
  document.querySelectorAll('.faq-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.faq-card');
      const open = card.classList.contains('is-open');
      card.classList.toggle('is-open', !open);
      btn.setAttribute('aria-expanded', String(!open));
    });
  });
}

function initReveals() {
  const items = document.querySelectorAll('.reveal');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((i) => i.classList.add('is-visible'));
    return;
  }
  const obs = new IntersectionObserver((entries, o) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); o.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  items.forEach((i) => obs.observe(i));
}

function initTaglineReveal() {
  const el = document.getElementById('tagline-reveal');
  if (!el) return;
  el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="reveal-word">${w}</span>`).join(' ');
  const words = Array.from(el.querySelectorAll('.reveal-word'));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    words.forEach((w) => w.classList.add('is-visible'));
    return;
  }
  let raf = false;
  const update = () => {
    raf = false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.85 - rect.top) / (vh * 0.5)));
    const count = Math.round(p * words.length);
    words.forEach((w, idx) => w.classList.toggle('is-visible', idx < count));
  };
  window.addEventListener('scroll', () => { if (!raf) { raf = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}
