/* ==========================================================================
   Q8Dreams Standalone Store Interactions
   (Gallery, Bundle selector, Live Incomplete Lead Tracking, COD Submit -> Thank You)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initGallery();
  initBundlesAndForm();
  initFaqAccordion();
  initScrollReveals();
  initTaglineReveal();
});

/* --------------------------------------------------------------------------
   Mobile Full-Height Menu
   -------------------------------------------------------------------------- */
function initMobileMenu() {
  const toggleBtn = document.querySelector('.nav-toggle');
  const menu = document.getElementById('mobile-menu');
  if (!toggleBtn || !menu) return;

  const toggleMenu = (open) => {
    toggleBtn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    menu.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };

  toggleBtn.addEventListener('click', () => {
    const isOpen = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleMenu(!isOpen);
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => toggleMenu(false));
  });
}

/* --------------------------------------------------------------------------
   Product Gallery (Images + Video)
   -------------------------------------------------------------------------- */
function initGallery() {
  const thumbs = document.querySelectorAll('.thumb-btn');
  const activeImg = document.getElementById('gallery-active-img');
  const activeVideo = document.getElementById('gallery-active-video');
  if (!thumbs.length || !activeImg || !activeVideo) return;

  thumbs.forEach((btn) => {
    btn.addEventListener('click', () => {
      thumbs.forEach((t) => t.classList.remove('is-active'));
      btn.classList.add('is-active');

      const type = btn.dataset.type;
      const src = btn.dataset.src;
      const alt = btn.dataset.alt || '';

      if (type === 'video') {
        activeImg.hidden = true;
        activeVideo.hidden = false;
        if (activeVideo.querySelector('source').getAttribute('src') !== src) {
          activeVideo.querySelector('source').setAttribute('src', src);
          activeVideo.load();
        }
        activeVideo.play().catch(() => {});
      } else {
        activeVideo.pause();
        activeVideo.hidden = true;
        activeImg.hidden = false;
        activeImg.src = src;
        activeImg.alt = alt;
      }
    });
  });
}

/* --------------------------------------------------------------------------
   Session ID Helper for Lead Tracking
   -------------------------------------------------------------------------- */
function getOrCreateSessionId() {
  let id = sessionStorage.getItem('q8_session_id');
  if (!id) {
    id = (crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('q8_session_id', id);
  }
  return id;
}

/* --------------------------------------------------------------------------
   Bundle Selector, Live Incomplete Lead Capture & COD Order Submission
   -------------------------------------------------------------------------- */
function initBundlesAndForm() {
  const bundleCards = document.querySelectorAll('.bundle-card');
  const heroPrice = document.getElementById('hero-price');
  const heroOldPrice = document.getElementById('hero-old-price');
  const orderTotal = document.getElementById('order-total');
  const form = document.getElementById('order-form');
  const statusEl = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn');

  let selectedBundle = { qty: '1', price: '18.00', old: '24.00' };
  const sessionId = getOrCreateSessionId();
  let isSubmitted = false;
  let draftTimer = null;

  const nameInput = document.getElementById('customer-name');
  const phoneInput = document.getElementById('customer-phone');
  const phoneConfirmInput = document.getElementById('customer-phone-confirm');
  const govInput = document.getElementById('customer-gov');
  const addressInput = document.getElementById('customer-address');

  phoneConfirmInput?.addEventListener('paste', (e) => e.preventDefault());

  const collectPayload = (status) => ({
    sessionId,
    name: nameInput ? nameInput.value.trim() : '',
    phone: phoneInput ? phoneInput.value.trim() : '',
    governorate: govInput ? govInput.value.trim() : '',
    address: addressInput ? addressInput.value.trim() : '',
    qty: selectedBundle.qty,
    total: selectedBundle.price,
    status,
  });

  const hasMeaningfulInput = () => {
    const p = collectPayload('incomplete');
    return p.name.length >= 2 || p.phone.length >= 3 || p.address.length >= 3;
  };

  const saveLocalOrder = (payload) => {
    try {
      const list = JSON.parse(localStorage.getItem('q8_local_orders') || '[]');
      const now = new Date().toISOString();
      let existing = list.find(
        (o) => o.sessionId === payload.sessionId && o.status === 'incomplete'
      );
      if (existing) {
        Object.assign(existing, {
          name: payload.name,
          phone: payload.phone,
          governorate: payload.governorate,
          address: payload.address,
          qty: payload.qty,
          total: payload.total,
          updatedAt: now,
        });
        if (payload.status === 'completed') {
          existing.status = 'completed';
          existing.fulfillmentStatus = 'جديد';
          existing.orderNumber = `Q8-${1001 + list.filter((o) => o.status === 'completed').length - 1}`;
          existing.completedAt = now;
        }
        localStorage.setItem('q8_local_orders', JSON.stringify(list));
        return existing;
      }

      const newOrder = {
        id: `loc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sessionId: payload.sessionId,
        orderNumber:
          payload.status === 'completed'
            ? `Q8-${1001 + list.filter((o) => o.status === 'completed').length}`
            : `LEAD-${String(list.length + 1).padStart(4, '0')}`,
        name: payload.name,
        phone: payload.phone,
        governorate: payload.governorate,
        address: payload.address,
        qty: payload.qty,
        total: payload.total,
        status: payload.status,
        fulfillmentStatus: payload.status === 'completed' ? 'جديد' : 'لم يكتمل',
        createdAt: now,
        updatedAt: now,
        completedAt: payload.status === 'completed' ? now : null,
      };
      list.push(newOrder);
      localStorage.setItem('q8_local_orders', JSON.stringify(list));
      return newOrder;
    } catch {
      return null;
    }
  };

  const saveIncompleteDraft = () => {
    if (isSubmitted || !hasMeaningfulInput()) return;
    const payload = collectPayload('incomplete');
    if (window.location.protocol === 'file:') {
      saveLocalOrder(payload);
      return;
    }
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      saveLocalOrder(payload);
    });
  };

  const scheduleDraftSave = () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveIncompleteDraft, 500);
  };

  bundleCards.forEach((card) => {
    card.addEventListener('click', () => {
      bundleCards.forEach((c) => {
        c.classList.remove('is-selected');
        c.setAttribute('aria-checked', 'false');
      });
      card.classList.add('is-selected');
      card.setAttribute('aria-checked', 'true');

      selectedBundle = {
        qty: card.dataset.qty,
        price: card.dataset.price,
        old: card.dataset.old,
      };

      if (heroPrice) heroPrice.textContent = `${selectedBundle.price} د.ك`;
      if (heroOldPrice) heroOldPrice.textContent = `${selectedBundle.old} د.ك`;
      if (orderTotal) orderTotal.textContent = `${selectedBundle.price} د.ك`;

      scheduleDraftSave();
    });
  });

  if (!form || !statusEl) return;

  const fields = [
    {
      input: nameInput,
      error: document.getElementById('err-name'),
      validate: (val) => val.trim().length >= 3,
    },
    {
      input: phoneInput,
      error: document.getElementById('err-phone'),
      validate: (val) => /^[4569]\d{7}$/.test(val.replace(/\s+/g, '')),
    },
    {
      input: phoneConfirmInput,
      error: document.getElementById('err-phone-confirm'),
      validate: (val) => {
        const clean1 = (phoneInput?.value || '').replace(/\s+/g, '');
        const clean2 = val.replace(/\s+/g, '');
        return /^[4569]\d{7}$/.test(clean2) && clean1 === clean2;
      },
    },
    {
      input: govInput,
      error: document.getElementById('err-gov'),
      validate: (val) => val.trim().length > 0,
    },
    {
      input: addressInput,
      error: document.getElementById('err-address'),
      validate: (val) => val.trim().length >= 5,
    },
  ];

  fields.forEach(({ input, error }) => {
    if (!input) return;
    input.addEventListener('input', () => {
      input.classList.remove('is-error');
      if (error) error.classList.remove('is-visible');
      scheduleDraftSave();
    });
    input.addEventListener('change', scheduleDraftSave);
  });

  window.addEventListener('pagehide', () => {
    if (!isSubmitted && hasMeaningfulInput() && navigator.sendBeacon) {
      const blob = new Blob(
        [JSON.stringify(collectPayload('incomplete'))],
        { type: 'application/json' }
      );
      navigator.sendBeacon('/api/orders', blob);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let hasError = false;

    fields.forEach(({ input, error, validate }) => {
      if (!input) return;
      const valid = validate(input.value);
      input.classList.toggle('is-error', !valid);
      if (error) error.classList.toggle('is-visible', !valid);
      if (!valid) hasError = true;
    });

    if (hasError) {
      saveIncompleteDraft();
      statusEl.className = 'form-status is-error body-5';
      statusEl.innerHTML = '<i class="ph ph-warning-circle" aria-hidden="true"></i><span>يرجى مراجعة الحقول المطلوبة لإتمام طلب التوصيل.</span>';
      return;
    }

    clearTimeout(draftTimer);
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.querySelector('span').textContent = 'جاري تسجيل طلبك...';
    }

    try {
      const payload = collectPayload('completed');
      let order = null;

      if (window.location.protocol !== 'file:') {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          order = data.order;
        }
      }

      if (!order) {
        order = saveLocalOrder(payload);
      }
      if (!order) throw new Error('Save failed');

      isSubmitted = true;
      sessionStorage.setItem('q8_last_order', JSON.stringify(order));
      sessionStorage.removeItem('q8_session_id');

      window.location.href = `./thank-you.html?id=${encodeURIComponent(order.id)}`;
    } catch {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'اطلب الآن وادفع عند الاستلام';
      }
      statusEl.className = 'form-status is-error body-5';
      statusEl.innerHTML = '<i class="ph ph-warning-circle" aria-hidden="true"></i><span>تعذر إرسال الطلب حالياً. يرجى المحاولة مرة أخرى.</span>';
    }
  });
}

/* --------------------------------------------------------------------------
   FAQ Accordion
   -------------------------------------------------------------------------- */
function initFaqAccordion() {
  const buttons = document.querySelectorAll('.faq-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('is-open');
      item.classList.toggle('is-open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  });
}

/* --------------------------------------------------------------------------
   Scroll Reveals (IntersectionObserver, once only)
   -------------------------------------------------------------------------- */
function initScrollReveals() {
  const sections = document.querySelectorAll('.reveal-section');
  if (!sections.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    sections.forEach((s) => s.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  sections.forEach((section) => observer.observe(section));
}

/* --------------------------------------------------------------------------
   B11. Mandatory Word-by-Word Tagline Reveal
   -------------------------------------------------------------------------- */
function initTaglineReveal() {
  const el = document.getElementById('tagline-reveal');
  if (!el) return;

  const parts = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = parts
    .map((line) =>
      line
        .trim()
        .split(/\s+/)
        .map((word) => `<span class="reveal-word">${word}</span>`)
        .join(' ')
    )
    .join('<br />');

  const words = Array.from(el.querySelectorAll('.reveal-word'));

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    words.forEach((w) => w.classList.add('is-visible'));
    return;
  }

  let rafPending = false;
  const updateWords = () => {
    rafPending = false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const start = vh * 0.85;
    const end = vh * 0.35;
    const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
    const activeCount = Math.round(progress * words.length);

    words.forEach((word, idx) => {
      word.classList.toggle('is-visible', idx < activeCount);
    });
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(updateWords);
      }
    },
    { passive: true }
  );

  updateWords();
}
