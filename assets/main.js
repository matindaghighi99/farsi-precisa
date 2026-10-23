/* Precisa Solutions — shared front-end behaviors */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const fa = document.documentElement.lang === 'fa';   /* the Persian pages under fa/ */

  /* ---------- Preloader (home only) ---------- */
  const preloader = document.getElementById('preloader');
  if (preloader) {
    /* The رسا intro (assets/rasa-loader.css). It starts once the logo and
       the display font are ready, so neither pops in late; the ring and
       counter follow real progress — they run to 92% on a clock and only
       close once the page has loaded. FLOOR lets the entrance play out
       (logo, sheen, wordmark); CAP stops a slow load holding the page. */
    const FLOOR = 2100;
    const CAP   = 4200;
    const IRIS  = 1000;   /* the exit: .done opens the iris (rasa-loader.css) */
    const num   = preloader.querySelector('.rl-num');
    const faDigits = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    let loaded = document.readyState === 'complete';
    let closed = false;
    window.addEventListener('load', () => { loaded = true; });

    const close = () => {
      if (closed) return;
      closed = true;
      const emblem = preloader.querySelector('.rl-emblem').getBoundingClientRect();
      preloader.style.setProperty('--cx', (emblem.left + emblem.width / 2) + 'px');
      preloader.style.setProperty('--cy', (emblem.top + emblem.height / 2) + 'px');
      preloader.classList.add('done');
      document.body.classList.remove('locked');
      setTimeout(() => preloader.remove(), IRIS + 150);
    };

    if (reduceMotion) {
      preloader.remove();
      document.body.classList.remove('locked');
    } else {
      const go = () => {
        if (preloader.classList.contains('is-go')) return;
        preloader.classList.add('is-go');
        const start = performance.now();
        let p = 0;
        const tick = (now) => {
          if (closed) return;
          const t = Math.min((now - start) / FLOOR, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          const goal = loaded ? 100 * eased : Math.min(92, 100 * eased);
          p += (goal - p) * 0.12;
          if (loaded && t >= 1 && p > 99.4) p = 100;
          preloader.style.setProperty('--p', p.toFixed(2));
          num.textContent = faDigits(Math.round(p));
          if (p === 100) { setTimeout(close, 260); return; }
          if (now - start >= CAP) { close(); return; }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };
      const logo = preloader.querySelector('.rl-logo img');
      Promise.all([
        logo.decode ? logo.decode().catch(() => {}) : null,
        document.fonts ? document.fonts.load('800 1em Estedad').catch(() => {}) : null,
      ]).then(go);
      setTimeout(go, 900);              /* don't wait on a slow logo or font */
      setTimeout(close, CAP + 900);     /* safety net */
    }
  }

  /* ---------- Custom cursor ---------- */
  const dot  = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  if (dot && ring) {
    if (finePointer && !reduceMotion) {
      let mx = -100, my = -100, rx = -100, ry = -100;
      window.addEventListener('mousemove', (e) => {
        mx = e.clientX; my = e.clientY;
        dot.style.left = mx + 'px';
        dot.style.top  = my + 'px';
      }, { passive: true });
      (function ringLoop() {
        rx += (mx - rx) * 0.45;
        ry += (my - ry) * 0.45;
        ring.style.left = rx + 'px';
        ring.style.top  = ry + 'px';
        requestAnimationFrame(ringLoop);
      })();
      document.querySelectorAll('a, button, .bento-card, .t-card, .project-card').forEach((el) => {
        el.addEventListener('mouseenter', () => ring.classList.add('grow'));
        el.addEventListener('mouseleave', () => ring.classList.remove('grow'));
      });
    } else {
      dot.remove();
      ring.remove();
    }
  }

  /* ---------- Scroll progress + nav state ---------- */
  const progressBar = document.getElementById('progressBar');
  const nav = document.getElementById('nav');
  let ticking = false;

  function onScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const burger = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open);
      burger.setAttribute('aria-label', open ? (fa ? 'بستن منو' : 'Close menu') : (fa ? 'باز کردن منو' : 'Open menu'));
      document.body.classList.toggle('locked', open);
    });
    mobileMenu.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('locked');
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

  /* Process line draw */
  const processTrack = document.getElementById('processTrack');
  if (processTrack) {
    const lineObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          processTrack.classList.add('in');
          lineObserver.disconnect();
        }
      });
    }, { threshold: 0.3 });
    lineObserver.observe(processTrack);
  }

  /* ---------- Counters ---------- */
  function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const decimal = el.dataset.decimal === 'true';
    const comma = el.dataset.comma === 'true';
    const dur = 1800;
    const start = performance.now();

    function frame(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      const val = target * eased;
      let text = decimal ? val.toFixed(1) : Math.round(val).toString();
      if (comma) text = Number(text).toLocaleString('en-US');
      el.textContent = text;
      if (p < 1) requestAnimationFrame(frame);
    }
    if (reduceMotion) {
      el.textContent = decimal ? target.toFixed(1) : (comma ? target.toLocaleString('en-US') : target);
    } else {
      requestAnimationFrame(frame);
    }
  }
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.counter').forEach((el) => counterObserver.observe(el));

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.magnetic').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = 'translate(' + x * 0.22 + 'px,' + y * 0.28 + 'px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transition = 'transform .6s cubic-bezier(0.22, 1, 0.36, 1)';
        btn.style.transform = 'translate(0,0)';
        setTimeout(() => { btn.style.transition = ''; }, 600);
      });
    });
  }

  /* ---------- Tactile ripple on textured buttons ---------- */
  if (!reduceMotion) {
    document.querySelectorAll('.btn-primary, .btn-gold, .btn-ghost, .nav-cta').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        const r = btn.getBoundingClientRect();
        const size = Math.max(r.width, r.height) * 1.6;
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - r.left) + 'px';
        ripple.style.top  = (e.clientY - r.top) + 'px';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 750);
      });
    });
  }

  /* ---------- 3D tilt + glare tracking ---------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.bento-card').forEach((card) => {
      const glare = card.querySelector('.bento-glare');
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.transform =
          'translateY(-8px) perspective(900px)' +
          ' rotateX(' + ((0.5 - py) * 5).toFixed(2) + 'deg)' +
          ' rotateY(' + ((px - 0.5) * 5).toFixed(2) + 'deg)';
        if (glare) {
          card.style.setProperty('--mx', (px * 100) + '%');
          card.style.setProperty('--my', (py * 100) + '%');
        }
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- Hero orb parallax ---------- */
  if (finePointer && !reduceMotion) {
    const orbs = document.querySelectorAll('.hero .orb');
    if (orbs.length) {
      let px = 0, py = 0, tx = 0, ty = 0;
      window.addEventListener('mousemove', (e) => {
        tx = (e.clientX / window.innerWidth - 0.5);
        ty = (e.clientY / window.innerHeight - 0.5);
      }, { passive: true });
      (function orbLoop() {
        px += (tx - px) * 0.03;
        py += (ty - py) * 0.03;
        orbs.forEach((orb, i) => {
          const depth = (i + 1) * 14;
          orb.style.translate = (px * depth) + 'px ' + (py * depth) + 'px';
        });
        requestAnimationFrame(orbLoop);
      })();
    }
  }

  /* ---------- Project filters ---------- */
  const filterBar = document.getElementById('filterBar');
  if (filterBar) {
    const cards = document.querySelectorAll('.project-card[data-cat]');
    filterBar.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBar.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.filter;
        cards.forEach((card) => {
          const show = cat === 'all' || card.dataset.cat === cat;
          card.classList.toggle('hidden', !show);
        });
      });
    });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item').forEach((item) => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach((other) => {
        other.classList.remove('open');
        other.querySelector('.faq-a').style.maxHeight = '0px';
        other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
        q.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---------- Contact form ----------
     The contact page's intake console is handled in assets/contact.js. */
})();


/* ---------- Home hero: assembling system ---------- */
(function () {
  'use strict';
  var svg = document.getElementById('heroSystem');
  if (!svg) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var assemble = function () { svg.classList.add('hh-assembled'); };

  if (reduceMotion) {
    assemble();
  } else {
    /* wait for the preloader sweep when present, otherwise start quickly */
    var delay = document.getElementById('preloader') ? 2000 : 500;
    setTimeout(assemble, delay);
  }

  /* subtle scroll parallax on the whole assembly (container only, so
     inner SVG transitions/animations are never overridden) */
  var wrap = document.querySelector('.hh-visual-inner');
  if (wrap && !reduceMotion) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = Math.min(window.scrollY, 900);
        wrap.style.transform = 'translateY(' + (y * 0.08) + 'px)';
        ticking = false;
      });
    }, { passive: true });
  }
})();


/* ---------- Workflow Simulator (lead journey) ---------- */
(function () {
  'use strict';
  var track = document.getElementById('simTrack');
  if (!track) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var steps = Array.prototype.slice.call(track.querySelectorAll('.sim-step'));
  var line = document.getElementById('simLine');
  var caption = document.getElementById('simCaption');
  var replayBtn = document.getElementById('simReplay');
  var resultEl = document.getElementById('simResult');
  var timer = null;
  var started = false;

  function setStep(i) {
    steps.forEach(function (s, idx) {
      s.classList.toggle('done', idx < i);
      s.classList.toggle('active', idx === i);
    });
    if (line) line.style.transform = 'scaleX(' + (i / (steps.length - 1)) + ')';
    caption.innerHTML = steps[i].dataset.caption;
  }

  function finish() {
    steps.forEach(function (s) { s.classList.add('done'); s.classList.remove('active'); });
    if (line) line.style.transform = 'scaleX(1)';
    caption.innerHTML = 'The entire sequence ran without your team — <strong>an ordinary night for a Precisa system.</strong>';
    if (resultEl) resultEl.classList.add('show');
    var lbl = replayBtn.querySelector('span');
    if (lbl) lbl.textContent = 'Run it again';
  }

  function play() {
    clearTimeout(timer);
    if (resultEl) resultEl.classList.remove('show');
    var lbl = replayBtn.querySelector('span');
    if (lbl) lbl.textContent = 'Running\u2026';   /* label restored by finish() */
    var i = 0;
    setStep(0);
    (function next() {
      timer = setTimeout(function () {
        i += 1;
        if (i < steps.length) { setStep(i); next(); }
        else { finish(); }
      }, 1700);
    })();
  }

  if (reduceMotion) {
    finish();
  } else {
    var simObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !started) {
          started = true;
          play();
          simObserver.disconnect();
        }
      });
    }, { threshold: 0.4 });
    simObserver.observe(track);
  }

  replayBtn.addEventListener('click', function () {
    if (window.MSObserve) MSObserve.log('click', { label: 'simulator_replay' });
    play();
  });
})();

/* ---------- Founder photo (activates when the file exists) ---------- */
(function () {
  'use strict';
  document.querySelectorAll('.founder-mark[data-photo]').forEach(function (mark) {
    var img = mark.querySelector('img');
    if (!img) return;
    var probe = new Image();
    probe.onload = function () {
      img.src = probe.src;
      mark.classList.add('has-photo');
    };
    probe.src = mark.dataset.photo;
  });
})();

/* ---------- Report-a-bug widget (site-wide launcher + modal) ---------- */
(function () {
  'use strict';
  if (document.getElementById('msbug-fab')) return;

  /* every visible string, in the page's language (fa/ pages are Persian) */
  var fa = document.documentElement.lang === 'fa';
  var T = fa ? {
    report: 'گزارش خطا', title: 'مشکلی دیدید؟',
    sub: 'بگویید چه اتفاقی افتاد — مستقیم به دست تیم می‌رسد. از کمکتان ممنونیم.',
    what: 'چه چیزی درست کار نکرد؟', whatPh: 'مثلاً دکمه‌ی فرم تماس در موبایل کار نمی‌کند',
    details: 'جزئیات', optional: '(اختیاری)', detailsPh: 'مراحل تکرار مشکل، انتظار شما و آنچه رخ داد…',
    severity: 'اهمیت', low: 'کم — جزئی / ظاهری', normal: 'معمولی', high: 'زیاد — مانع کارم شده',
    email: 'ایمیل شما', emailOpt: '(اختیاری، برای پاسخ)',
    send: 'ارسال گزارش', cancel: 'انصراف', thanks: 'سپاسگزاریم',
    sent: 'گزارش شما ارسال شد. از وقتی که گذاشتید ممنونیم.', close: 'بستن',
    empty: 'لطفاً مشکل را توضیح دهید.', sending: 'در حال ارسال…', failed: 'ارسال گزارش ممکن نشد.'
  } : {
    report: 'Report a bug', title: 'Spotted something off?',
    sub: 'Tell us what happened — it goes straight to the team. Thanks for helping.',
    what: 'What went wrong?', whatPh: 'e.g. Contact form button does nothing on mobile',
    details: 'Details', optional: '(optional)', detailsPh: 'Steps to reproduce, what you expected, what happened…',
    severity: 'Severity', low: 'Low — minor / cosmetic', normal: 'Normal', high: 'High — blocks me',
    email: 'Your email', emailOpt: '(optional, for a reply)',
    send: 'Send report', cancel: 'Cancel', thanks: 'Thank you',
    sent: 'Your report was sent. We appreciate you taking the time.', close: 'Close',
    empty: 'Please describe the bug.', sending: 'Sending…', failed: 'Could not send the report.'
  };

  var css =
    '.msbug-fab{position:fixed;right:20px;bottom:20px;z-index:9998;display:inline-flex;align-items:center;gap:8px;' +
    'padding:11px 16px;border-radius:100px;border:1px solid rgba(47,107,224,.35);background:var(--ink,#0C1524);' +
    'color:#FDFDFB;font-family:var(--font-body,Inter,sans-serif);font-size:13px;font-weight:500;cursor:pointer;' +
    'box-shadow:0 8px 24px rgba(12,21,36,.22);transition:transform .25s,box-shadow .25s;}' +
    '.msbug-fab:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(12,21,36,.3);}' +
    '.msbug-fab svg{color:var(--gold-bright,#2F6BE0);}' +
    '@media(max-width:600px){.msbug-fab span{display:none;}.msbug-fab{padding:13px;}}' +
    '.msbug-overlay{position:fixed;inset:0;z-index:9999;background:rgba(12,21,36,.55);backdrop-filter:blur(3px);' +
    'display:none;align-items:center;justify-content:center;padding:20px;}' +
    '.msbug-overlay.open{display:flex;}' +
    '.msbug-card{background:var(--bg-warm,#FBFAF7);border:1px solid var(--border,#ECE7DF);border-radius:20px;' +
    'width:100%;max-width:460px;max-height:90vh;overflow:auto;padding:26px 26px 24px;box-shadow:0 30px 70px rgba(12,21,36,.3);}' +
    '.msbug-eyebrow{font-family:var(--font-mono,monospace);font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold,#103C86);}' +
    '.msbug-card h3{font-family:var(--font-display,Georgia,serif);font-size:22px;font-weight:600;color:var(--ink,#0C1524);margin:8px 0 4px;}' +
    '.msbug-card p.msbug-sub{font-size:13.5px;color:var(--ink-soft,#57534E);margin:0 0 16px;line-height:1.5;}' +
    '.msbug-field{margin-bottom:13px;}' +
    '.msbug-field label{display:block;font-size:12.5px;font-weight:600;color:var(--ink,#0C1524);margin-bottom:6px;}' +
    '.msbug-field input,.msbug-field textarea,.msbug-field select{width:100%;padding:11px 13px;border:1px solid var(--border-strong,#d9d4cc);' +
    'border-radius:11px;background:#fff;font-family:inherit;font-size:14px;color:var(--ink,#0C1524);box-sizing:border-box;}' +
    '.msbug-field textarea{min-height:88px;resize:vertical;}' +
    '.msbug-field input:focus,.msbug-field textarea:focus,.msbug-field select:focus{outline:none;border-color:var(--gold-bright,#2F6BE0);}' +
    '.msbug-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;}' +
    '.msbug-actions{display:flex;gap:10px;align-items:center;margin-top:6px;}' +
    '.msbug-submit{flex:1;padding:12px 18px;border:none;border-radius:11px;background:var(--gold-bright,#2F6BE0);color:#241A0C;' +
    'font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .2s;}' +
    '.msbug-submit:hover{opacity:.9;}' +
    '.msbug-cancel{padding:12px 16px;border:1px solid var(--border-strong,#d9d4cc);border-radius:11px;background:#fff;' +
    'font-family:inherit;font-size:14px;color:var(--ink-soft,#57534E);cursor:pointer;}' +
    '.msbug-msg{font-size:13px;margin-top:10px;min-height:1em;}' +
    '.msbug-success{text-align:center;padding:14px 4px;}' +
    '.msbug-success svg{color:var(--gold,#103C86);}' +
    '.msbug-success h3{margin:10px 0 4px;}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var fab = document.createElement('button');
  fab.id = 'msbug-fab';
  fab.className = 'msbug-fab';
  fab.setAttribute('aria-label', T.report);
  fab.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">' +
    '<rect x="8" y="6" width="8" height="12" rx="4"/><path d="M12 6V4M9 3l1.5 2M15 3l-1.5 2M8 10H4M20 10h-4M8 14H4M20 14h-4M9 19l-1.5 2M15 19l1.5 2"/></svg>' +
    '<span>' + T.report + '</span>';
  document.body.appendChild(fab);

  var overlay = document.createElement('div');
  overlay.className = 'msbug-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', T.report);
  overlay.innerHTML =
    '<div class="msbug-card">' +
      '<div class="msbug-body">' +
        '<div class="msbug-eyebrow">' + T.report + '</div>' +
        '<h3>' + T.title + '</h3>' +
        '<p class="msbug-sub">' + T.sub + '</p>' +
        '<form id="msbug-form" novalidate>' +
          '<input type="text" class="msbug-hp" name="_hp" tabindex="-1" autocomplete="off" aria-hidden="true" />' +
          '<div class="msbug-field"><label for="msbug-summary">' + T.what + '</label>' +
            '<input type="text" id="msbug-summary" name="summary" maxlength="160" placeholder="' + T.whatPh + '" required /></div>' +
          '<div class="msbug-field"><label for="msbug-details">' + T.details + ' <span style="font-weight:400;color:var(--ink-mute,#8A817A)">' + T.optional + '</span></label>' +
            '<textarea id="msbug-details" name="details" maxlength="4000" placeholder="' + T.detailsPh + '"></textarea></div>' +
          '<div class="msbug-field"><label for="msbug-severity">' + T.severity + '</label>' +
            '<select id="msbug-severity" name="severity"><option value="low">' + T.low + '</option><option value="normal" selected>' + T.normal + '</option><option value="high">' + T.high + '</option></select></div>' +
          '<div class="msbug-field"><label for="msbug-email">' + T.email + ' <span style="font-weight:400;color:var(--ink-mute,#8A817A)">' + T.emailOpt + '</span></label>' +
            '<input type="email" id="msbug-email" name="email" maxlength="120" placeholder="you@example.com" dir="ltr" /></div>' +
          '<div class="msbug-msg" id="msbug-msg" role="alert"></div>' +
          '<div class="msbug-actions"><button type="submit" class="msbug-submit">' + T.send + '</button>' +
            '<button type="button" class="msbug-cancel" id="msbug-cancel">' + T.cancel + '</button></div>' +
        '</form>' +
      '</div>' +
      '<div class="msbug-success" id="msbug-success" hidden>' +
        '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>' +
        '<h3>' + T.thanks + '</h3><p class="msbug-sub">' + T.sent + '</p>' +
        '<button type="button" class="msbug-submit" id="msbug-done" style="max-width:160px;margin:6px auto 0;">' + T.close + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  var form = overlay.querySelector('#msbug-form');
  var msg = overlay.querySelector('#msbug-msg');
  var body = overlay.querySelector('.msbug-body');
  var success = overlay.querySelector('#msbug-success');
  var submitBtn = overlay.querySelector('.msbug-submit');

  function open() {
    overlay.classList.add('open');
    body.hidden = false; success.hidden = true;
    setTimeout(function () { overlay.querySelector('#msbug-summary').focus(); }, 60);
    if (window.MSObserve) MSObserve.log('click', { label: 'bug_open' });
  }
  function close() { overlay.classList.remove('open'); }

  fab.addEventListener('click', open);
  overlay.querySelector('#msbug-cancel').addEventListener('click', close);
  overlay.querySelector('#msbug-done').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var summary = document.getElementById('msbug-summary').value.trim();
    if (!summary) { msg.style.color = '#B4232B'; msg.textContent = T.empty; return; }

    msg.textContent = '';
    submitBtn.disabled = true; submitBtn.style.opacity = '.6'; submitBtn.textContent = T.sending;

    fetch('/api/bug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _hp: form.elements['_hp'].value,
        summary: summary,
        details: document.getElementById('msbug-details').value.trim(),
        severity: document.getElementById('msbug-severity').value,
        email: document.getElementById('msbug-email').value.trim(),
        page_url: location.href
      })
    }).then(function (r) {
      return r.json().then(function (b) { if (!r.ok || !b.ok) throw new Error(b.error || T.failed); });
    }).then(function () {
      body.hidden = true; success.hidden = false;
      form.reset();
      if (window.MSObserve) MSObserve.log('click', { label: 'bug_sent' });
    }).catch(function (err) {
      msg.style.color = '#B4232B'; msg.textContent = (!fa && err.message) || T.failed;   /* server errors are English */
      submitBtn.disabled = false; submitBtn.style.opacity = ''; submitBtn.textContent = T.send;
    });
  });
})();
