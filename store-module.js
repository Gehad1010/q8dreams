/* ==========================================================================
   Q8Dreams Reusable Store & Tracking Module (store-module.js)
   اربط هذا الملف مع tracking-config.js في أي صفحة هبوط HTML لأي منتج جديد
   ========================================================================== */

(function () {
  const pageConfig = window.Q8_PAGE_META || {};
  const landingName = pageConfig.landing || document.body.dataset.landing || 'default';
  const productName = pageConfig.product || document.body.dataset.product || 'وسادة الفراشة الطبية';

  document.addEventListener('DOMContentLoaded', () => {
    initTrackingPixels();
    initGallery();
    initOrderForm();
    initFaq();
    initReveals();
    initTaglineReveal();
  });

  /* ------------------------------------------------------------------------
     1. Pixels Loader & Event Dispatcher (TikTok + Clarity + GA4)
     ------------------------------------------------------------------------ */
  function initTrackingPixels() {
    const cfg = window.Q8_TRACKING_CONFIG || {};

    // TikTok Pixel
    if (cfg.tiktokPixelId) {
      !(function (w, d, t) {
        w.TiktokAnalyticsObject = t;
        const ttq = (w[t] = w[t] || []);
        ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
        ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
        for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.load = function (e) {
          const s = d.createElement('script');
          s.async = true;
          s.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${e}&lib=${t}`;
          d.head.appendChild(s);
        };
        ttq.load(cfg.tiktokPixelId);
        ttq.page();
        ttq.track('ViewContent', { content_name: productName, content_category: landingName });
      })(window, document, 'ttq');
    }

    // Microsoft Clarity
    if (cfg.clarityId) {
      (function (c, l, a, r, i, t, y) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
      })(window, document, 'clarity', 'script', cfg.clarityId);
    }

    // Google Analytics 4
    if (cfg.ga4MeasurementId) {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${cfg.ga4MeasurementId}`;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', cfg.ga4MeasurementId, { page_title: `${productName} - ${landingName}` });
    }
  }

  function trackEvent(eventName, valueKwd, qty) {
    try {
      if (window.ttq) {
        if (eventName === 'begin_checkout') {
          window.ttq.track('InitiateCheckout', { content_name: productName, value: Number(valueKwd), currency: 'KWD' });
        } else if (eventName === 'purchase') {
          window.ttq.track('CompletePayment', { content_name: productName, quantity: Number(qty), value: Number(valueKwd), currency: 'KWD' });
        }
      }
      if (window.gtag) {
        window.gtag('event', eventName, {
          currency: 'KWD',
          value: Number(valueKwd),
          items: [{ item_name: productName, item_category: landingName, quantity: Number(qty) }],
        });
      }
    } catch {}
  }

  /* ------------------------------------------------------------------------
     2. Gallery Switcher
     ------------------------------------------------------------------------ */
  function initGallery() {
    const thumbs = document.querySelectorAll('.thumb-btn');
    const img = document.getElementById('stage-img');
    const video = document.getElementById('stage-video');
    if (!thumbs.length || !img) return;

    thumbs.forEach((btn) => {
      btn.addEventListener('click', () => {
        thumbs.forEach((t) => t.classList.remove('is-active'));
        btn.classList.add('is-active');
        if (btn.dataset.type === 'video' && video) {
          img.hidden = true;
          video.hidden = false;
          video.play().catch(() => {});
        } else {
          if (video) { video.pause(); video.hidden = true; }
          img.hidden = false;
          img.src = btn.dataset.src;
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     3. Reusable Order Form + Phone Confirmation + Lead Capture
     ------------------------------------------------------------------------ */
  function getSessionId() {
    const key = `q8_session_${landingName}`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = (crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  function initOrderForm() {
    const form = document.getElementById('order-form');
    if (!form) return;

    const bundles = document.querySelectorAll('.bundle-opt');
    const priceEl = document.getElementById('display-price');
    const oldEl = document.getElementById('display-old');
    const totalEl = document.getElementById('order-total');
    const stickyEl = document.getElementById('sticky-price');
    const statusEl = document.getElementById('form-status');
    const submitBtn = document.getElementById('submit-btn');

    let selected = { qty: '1', price: '18.00', old: '24.00' };
    const activeBundle = document.querySelector('.bundle-opt.is-selected');
    if (activeBundle) {
      selected = { qty: activeBundle.dataset.qty, price: activeBundle.dataset.price, old: activeBundle.dataset.old };
    }

    const sessionId = getSessionId();
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source') || '';
    let isSubmitted = false;
    let checkoutTracked = false;
    let timer = null;

    const nameIn = document.getElementById('customer-name');
    const phoneIn = document.getElementById('customer-phone');
    const phoneConfirmIn = document.getElementById('customer-phone-confirm');
    const govIn = document.getElementById('customer-gov');
    const addrIn = document.getElementById('customer-address');

    phoneConfirmIn?.addEventListener('paste', (e) => e.preventDefault());

    const payload = (status) => ({
      sessionId,
      landing: landingName,
      product: productName,
      utmSource,
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
      if (!checkoutTracked) {
        checkoutTracked = true;
        trackEvent('begin_checkout', selected.price, selected.qty);
      }
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

    const rules = [
      { el: nameIn, err: document.getElementById('err-name'), ok: (v) => v.trim().length >= 3 },
      { el: phoneIn, err: document.getElementById('err-phone'), ok: (v) => /^[4569]\d{7}$/.test(v.replace(/\s+/g, '')) },
      {
        el: phoneConfirmIn,
        err: document.getElementById('err-phone-confirm'),
        ok: (v) => {
          const c1 = (phoneIn?.value || '').replace(/\s+/g, '');
          const c2 = v.replace(/\s+/g, '');
          return /^[4569]\d{7}$/.test(c2) && c1 === c2;
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

    window.addEventListener('pagehide', () => {
      const p = payload('incomplete');
      if (!isSubmitted && (p.name.length >= 2 || p.phone.length >= 3) && navigator.sendBeacon && window.location.protocol !== 'file:') {
        navigator.sendBeacon('/api/orders', new Blob([JSON.stringify(p)], { type: 'application/json' }));
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let bad = false;
      rules.forEach(({ el, err, ok }) => {
        if (!el) return;
        const valid = ok(el.value);
        el.classList.toggle('is-error', !valid);
        err?.classList.toggle('is-visible', !valid);
        if (!valid) bad = true;
      });

      if (bad) {
        saveDraft();
        if (statusEl) {
          statusEl.className = 'form-msg is-error';
          statusEl.innerHTML = '<i class="ph ph-warning-circle"></i><span>يرجى مراجعة الحقول المطلوبة وتطابق رقم الهاتف.</span>';
        }
        return;
      }

      clearTimeout(timer);
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.querySelector('span').textContent = 'جاري تسجيل طلبك...';
      }

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
        trackEvent('purchase', selected.price, selected.qty);
        sessionStorage.setItem('q8_last_order', JSON.stringify(order));
        sessionStorage.removeItem(`q8_session_${landingName}`);
        window.location.href = `./thank-you.html?id=${encodeURIComponent(order.id)}`;
      } catch {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.querySelector('span').textContent = 'اطلب الآن وادفع عند الاستلام';
        }
        if (statusEl) {
          statusEl.className = 'form-msg is-error';
          statusEl.innerHTML = '<i class="ph ph-warning-circle"></i><span>تعذر إرسال الطلب حالياً. حاول مرة أخرى.</span>';
        }
      }
    });
  }

  /* ------------------------------------------------------------------------
     4. FAQ, Scroll Reveals & Tagline Reveal
     ------------------------------------------------------------------------ */
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
    if (!items.length) return;
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
})();
