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
      // An explicit pause control, not just hover/focus (WCAG 2.2.2).
      var paused = false;
      var pauseBtn = $('[data-pause]', car);
      var resume = function () { if (!paused) start(); };
      ['mouseenter', 'focusin', 'touchstart'].forEach(function (ev) {
        car.addEventListener(ev, stop, { passive: true });
      });
      ['mouseleave', 'focusout'].forEach(function (ev) {
        car.addEventListener(ev, resume);
      });
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden) stop(); else resume();
      });
      if (pauseBtn) {
        pauseBtn.addEventListener('click', function () {
          paused = !paused;
          pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
          pauseBtn.setAttribute('aria-label', paused ? 'تشغيل التبديل التلقائي' : 'إيقاف التبديل التلقائي');
          if (paused) stop(); else start();
        });
      }
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
    var pills = $$('[data-region-pill]', dir);
    var syncPills = function () {
      pills.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-region-pill') === region.value ? 'true' : 'false');
      });
    };
    pills.forEach(function (b) {
      b.addEventListener('click', function () {
        region.value = b.getAttribute('data-region-pill');
        syncPills();
        run();
      });
    });

    q.addEventListener('input', run);
    region.addEventListener('change', function () { syncPills(); run(); });
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

  /* ---------- Forms library: filter by department ---------- */
  var formsPage = $('[data-forms]');
  if (formsPage) {
    var catBtns = $$('[data-cat]', formsPage);
    var docs = $$('[data-doc-cat]', formsPage);
    var docCount = $('[data-doc-count]', formsPage);
    var docEmpty = $('[data-doc-empty]', formsPage);
    catBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = btn.getAttribute('data-cat');
        catBtns.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        var shown = 0;
        docs.forEach(function (d) {
          var ok = !cat || d.getAttribute('data-doc-cat') === cat;
          d.hidden = !ok;
          if (ok) shown += 1;
        });
        docCount.textContent = shown;
        docEmpty.hidden = shown > 0;
      });
    });
  }

  /* ---------- Self-assessment: pick an answer ---------- */
  var assess = $('[data-assess]');
  if (assess) {
    var choices = $$('.choice', assess);
    choices.forEach(function (c) {
      c.addEventListener('click', function () {
        choices.forEach(function (o) { o.setAttribute('aria-checked', o === c ? 'true' : 'false'); });
      });
    });
    var restart = $('[data-restart]', assess);
    if (restart) {
      restart.addEventListener('click', function () {
        choices.forEach(function (o) { o.setAttribute('aria-checked', 'false'); });
        var quiz = $('[data-quiz]', assess);
        if (quiz) quiz.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      });
    }
  }

  /* ---------- FAQ accordion (grid-rows + 3D-unfold reveal, in CSS) ---------- */
  var setFaqOpen = function (btn, open) {
    var item = btn.closest('.faq-item');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (item) item.classList.toggle('is-open', open);
  };
  $$('.faq-q').forEach(function (btn) {
    var panel = doc.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      // one open answer per group keeps the list scannable
      var group = btn.closest('.faq-list');
      if (group) {
        $$('.faq-q[aria-expanded="true"]', group).forEach(function (other) {
          if (other !== btn) setFaqOpen(other, false);
        });
      }
      setFaqOpen(btn, !open);
    });
  });

  /* ---------- Demo login ----------
     No backend on a static host, so this checks one published demo account
     client-side and remembers it in sessionStorage. It is a UI demo, not
     security — never treat it as an access control. */
  var DEMO = { email: 'demo@a3r.sa', pass: 'athar1234' };
  var SESSION_KEY = 'athar-demo-session';

  var login = $('[data-login]');
  if (login) {
    var loginMsg = $('[data-msg]', login);
    login.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = ($('#lg-email', login).value || '').trim().toLowerCase();
      var pass = $('#lg-pass', login).value || '';
      if (email === DEMO.email && pass === DEMO.pass) {
        try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (err) { /* private mode */ }
        loginMsg.style.color = 'var(--dot-green)';
        loginMsg.textContent = 'تم تسجيل الدخول — جارٍ التحويل...';
        setTimeout(function () { location.href = 'dashboard.html'; }, 500);
      } else {
        loginMsg.style.color = 'var(--dot-red)';
        loginMsg.textContent = 'البيانات غير صحيحة. استخدم بيانات العرض الموضّحة أسفل النموذج.';
      }
    });

    // one-click fill, so nobody has to retype the demo account
    var fill = $('[data-fill-demo]', login);
    if (fill) {
      fill.addEventListener('click', function () {
        $('#lg-email', login).value = DEMO.email;
        $('#lg-pass', login).value = DEMO.pass;
        loginMsg.textContent = '';
      });
    }
  }

  var logout = $('[data-logout]');
  if (logout) {
    logout.addEventListener('click', function () {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (err) { /* ignore */ }
    });
  }

  /* ---------- Contact form -> WhatsApp (same honest fallback as the newsletter) ---------- */
  var contact = $('[data-contact]');
  if (contact) {
    var cMsg = $('[data-msg]', contact);
    contact.addEventListener('submit', function (e) {
      e.preventDefault();
      var get = function (id) { return ($('#' + id, contact).value || '').trim(); };
      var name = get('c-name'), phone = get('c-phone'), email = get('c-email'), body = get('c-msg');
      if (!name || !body) {
        cMsg.style.color = 'var(--dot-red)';
        cMsg.textContent = 'الاسم والرسالة مطلوبان.';
        return;
      }
      cMsg.textContent = '';
      var text = 'رسالة من موقع أثر\nالاسم: ' + name +
                 (phone ? '\nالجوال: ' + phone : '') +
                 (email ? '\nالبريد: ' + email : '') +
                 '\n\n' + body;
      window.open('https://wa.me/966554686962?text=' + encodeURIComponent(text), '_blank', 'noopener');
    });
  }

  /* ---------- Video lightbox ----------
     Each trigger carries data-video: a YouTube id (or full watch/youtu.be URL),
     or a path ending in .mp4/.webm for a local file. Nothing is requested from
     YouTube until the visitor actually clicks. */
  var lbTriggers = $$('[data-video]');
  if (lbTriggers.length) {
    var lb = null, lastFocus = null;

    var youtubeId = function (v) {
      var m = v.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
      return /^[A-Za-z0-9_-]{11}$/.test(v) ? v : null;
    };

    var closeLb = function () {
      if (!lb) return;
      lb.hidden = true;
      $('.lightbox-frame', lb).innerHTML = '';   // stops playback
      doc.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };

    var buildLb = function () {
      lb = doc.createElement('div');
      lb.className = 'lightbox';
      lb.hidden = true;
      lb.setAttribute('role', 'dialog');
      lb.setAttribute('aria-modal', 'true');
      lb.innerHTML =
        '<div class="lightbox-panel">' +
          '<button class="lightbox-close" type="button">إغلاق ✕</button>' +
          '<div class="lightbox-frame"></div>' +
          '<div class="lightbox-title"></div>' +
        '</div>';
      doc.body.appendChild(lb);
      $('.lightbox-close', lb).addEventListener('click', closeLb);
      lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
      doc.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !lb.hidden) closeLb();
      });
    };

    var openLb = function (src, title, trigger) {
      if (!lb) buildLb();
      var frame = $('.lightbox-frame', lb);
      var id = youtubeId(src);
      if (id) {
        frame.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id +
          '?autoplay=1&rel=0" title="' + (title || '') +
          '" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
      } else {
        frame.innerHTML = '<video src="' + src + '" controls autoplay playsinline></video>';
      }
      $('.lightbox-title', lb).textContent = title || '';
      lb.setAttribute('aria-label', title || 'مشغّل الفيديو');
      lastFocus = trigger;
      lb.hidden = false;
      doc.body.style.overflow = 'hidden';
      $('.lightbox-close', lb).focus();
    };

    lbTriggers.forEach(function (el) {
      var src = el.getAttribute('data-video');
      if (!src) return;                       // no id yet -> stays a "قريبًا" card
      el.removeAttribute('disabled');
      var card = el.closest('.video-card');
      var soon = card && $('.soon', card);
      if (soon) soon.remove();
      var title = card ? (($('h3', card) || {}).textContent || '').trim() : '';
      el.addEventListener('click', function () { openLb(src, title, el); });
    });
  }

  /* ---------- Show/hide password ---------- */
  $$('[data-toggle-password]').forEach(function (btn) {
    var input = doc.getElementById(btn.getAttribute('data-toggle-password'));
    if (!input) return;
    btn.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      btn.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
      input.focus();
    });
  });

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
