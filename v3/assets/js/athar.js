/* أثر v2 — plain JavaScript, no dependencies.
   Every feature checks for its markup first, so any page can include this file. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var THEME_KEY = 'athar-v2-theme';

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  /* ---------- Theme (light by default, remembers the choice) ---------- */
  var themeBtn = $('[data-theme-toggle]');
  function currentTheme() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function syncThemeButton() {
    if (!themeBtn) return;
    var dark = currentTheme() === 'dark';
    themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    themeBtn.setAttribute('aria-label', dark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن');
    themeBtn.setAttribute('title', dark ? 'الوضع الفاتح' : 'الوضع الداكن');
  }
  if (themeBtn) {
    syncThemeButton();
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode */ }
      syncThemeButton();
    });
  }

  /* ---------- Mobile menu (a sheet under the header — no side drawer, so no RTL slide bugs) ---------- */
  var navBtn = $('[data-nav-toggle]');
  var drawer = $('#drawer');
  function setDrawer(open) {
    if (!navBtn || !drawer) return;
    drawer.hidden = !open;
    navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    navBtn.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
  }
  if (navBtn && drawer) {
    navBtn.addEventListener('click', function () { setDrawer(drawer.hidden); });
    drawer.addEventListener('click', function (e) { if (e.target.closest('a')) setDrawer(false); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drawer.hidden) { setDrawer(false); navBtn.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth >= 1080) setDrawer(false); });
  }

  /* ---------- Header shadow + the thread (fills as you read) ---------- */
  var header = $('.site-header');
  var trace = $('.trace');
  var mainEl = $('main');
  var heads = $$('.sec-head');
  var ticking = false;

  function onScroll() {
    ticking = false;
    var y = window.pageYOffset || root.scrollTop;
    if (header) header.classList.toggle('is-stuck', y > 4);

    if (trace && mainEl && trace.offsetParent !== null) {
      var line = y + window.innerHeight * 0.6;
      var top = mainEl.getBoundingClientRect().top + y;
      var p = (line - top) / mainEl.offsetHeight;
      trace.style.setProperty('--trace', Math.max(0, Math.min(1, p)).toFixed(4));
      heads.forEach(function (h) {
        h.classList.toggle('on', h.getBoundingClientRect().top + y < line);
      });
    }
  }
  function requestTick() {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  onScroll();

  /* ---------- Testimonials carousel ---------- */
  var car = $('[data-carousel]');
  if (car) {
    var track = $('[data-track]', car);
    var slides = $$('.q', track);
    var dots = $$('[data-dot]', car);
    var idx = 0;

    var sync = function () {
      dots.forEach(function (d, i) { d.setAttribute('aria-current', i === idx ? 'true' : 'false'); });
    };
    var go = function (i) {
      idx = (i + slides.length) % slides.length;
      slides[idx].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'start', block: 'nearest' });
      sync();
    };

    var prev = $('[data-prev]', car);
    var next = $('[data-next]', car);
    if (prev) prev.addEventListener('click', function () { go(idx - 1); });
    if (next) next.addEventListener('click', function () { go(idx + 1); });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) { idx = slides.indexOf(e.target); sync(); }
        });
      }, { root: track, threshold: [0.6] });
      slides.forEach(function (s) { io.observe(s); });
    }
    sync();

    /* Auto-advance every 6s; pauses on hover/focus/touch and while the
       tab is hidden, and never runs at all under reduced-motion. */
    if (!reduceMotion && slides.length > 1) {
      var AUTO_MS = 6000;
      var timer = null;
      var start = function () {
        stop();
        timer = setInterval(function () { go(idx + 1); }, AUTO_MS);
      };
      var stop = function () {
        if (timer) { clearInterval(timer); timer = null; }
      };
      ['mouseenter', 'focusin', 'touchstart'].forEach(function (ev) {
        car.addEventListener(ev, stop, { passive: true });
      });
      ['mouseleave', 'focusout'].forEach(function (ev) {
        car.addEventListener(ev, start);
      });
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden) stop(); else start();
      });
      start();
    }
  }

  /* ---------- Directory filter ---------- */
  var dir = $('[data-directory]');
  if (dir) {
    var q = $('[data-q]', dir);
    var region = $('[data-region]', dir);
    var rows = $$('tbody tr', dir);
    var count = $('[data-count]', dir);
    var empty = $('[data-empty]', dir);

    // Arabic-insensitive matching: ignores diacritics and أ/إ/آ, ى/ي, ة/ه variants
    var norm = function (s) {
      return s.replace(/[ً-ٰٟـ]/g, '')
        .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
        .toLowerCase();
    };
    var haystacks = rows.map(function (tr) { return norm(tr.textContent); });

    var run = function () {
      var term = norm(q.value.trim());
      var r = region.value;
      var shown = 0;
      rows.forEach(function (tr, i) {
        var ok = (!r || tr.getAttribute('data-region') === r) && (!term || haystacks[i].indexOf(term) > -1);
        tr.hidden = !ok;
        if (ok) { shown += 1; tr.querySelector('.rn').textContent = shown; }
      });
      count.textContent = shown;
      empty.hidden = shown > 0;
    };
    q.addEventListener('input', run);
    region.addEventListener('change', run);
  }

  /* ---------- Newsletter → WhatsApp (no backend on a static site) ---------- */
  var news = $('[data-newsletter]');
  if (news) {
    var phone = $('input', news);
    var msg = $('[data-msg]', news);
    news.addEventListener('submit', function (e) {
      e.preventDefault();
      var digits = phone.value.replace(/[^\d٠-٩]/g, '').replace(/[٠-٩]/g, function (c) {
        return String(c.charCodeAt(0) - 0x0660);
      });
      if (digits.length < 9) {
        phone.setAttribute('aria-invalid', 'true');
        msg.textContent = 'أدخل رقم جوال صحيحًا.';
        phone.focus();
        return;
      }
      phone.removeAttribute('aria-invalid');
      msg.textContent = '';
      var text = 'أرغب بالاشتراك في نشرة أثر. رقم جوالي: ' + digits;
      window.open('https://wa.me/966554686962?text=' + encodeURIComponent(text), '_blank', 'noopener');
    });
    phone.addEventListener('input', function () { phone.removeAttribute('aria-invalid'); msg.textContent = ''; });
  }

  /* ---------- Login form (static site — no backend to authenticate against) ---------- */
  var login = $('[data-login]');
  if (login) {
    var loginMsg = $('[data-msg]', login);
    login.addEventListener('submit', function (e) {
      e.preventDefault();
      loginMsg.style.color = 'var(--text-2)';
      loginMsg.textContent = 'هذه نسخة عرض توضيحية، ولا تتصل بأي خادم فعلي.';
    });
  }

  /* ---------- Count-up numbers (hero/KPI stats) ---------- */
  var counters = $$('.count-up');
  if (counters.length) {
    var parseNum = function (text) {
      var m = text.trim().match(/^(\D*)([\d.,]+)(\D*)$/);
      if (!m) return null;
      var digits = m[2].replace(/,/g, '');
      return { prefix: m[1], value: parseFloat(digits), suffix: m[3], decimals: (digits.split('.')[1] || '').length };
    };
    var format = function (n, decimals) {
      return decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString('en-US');
    };
    var animateCount = function (el) {
      var n = parseNum(el.textContent);
      if (!n || !isFinite(n.value)) return;
      var finalText = n.prefix + format(n.value, n.decimals) + n.suffix;
      if (reduceMotion) { el.textContent = finalText; return; }
      var dur = 1000, t0 = Date.now();
      var timer = setInterval(function () {
        var p = Math.min(1, (Date.now() - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = n.prefix + format(n.value * eased, n.decimals) + n.suffix;
        if (p >= 1) { clearInterval(timer); el.textContent = finalText; }
      }, 16);
    };
    if ('IntersectionObserver' in window) {
      var cio = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { animateCount(e.target); obs.unobserve(e.target); }
        });
      }, { threshold: 0.6 });
      counters.forEach(function (el) { cio.observe(el); });
    }
  }

  /* ---------- Scroll reveal: one-time fade + rise per card ---------- */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var cards = $$('.card');
    if (cards.length) {
      root.classList.add('js-reveal');
      var rio = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' });
      cards.forEach(function (el) { rio.observe(el); });
    }
  }
})();
