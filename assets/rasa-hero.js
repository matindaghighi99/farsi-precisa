/* Rasa — Persian home hero runtime. Loaded by fa/index.html.
   1 fit: the 3D scene is laid out at 560×430 and scaled to its column
   2 entrance, once the site preloader lifts: the copy rises, and the
     sample site fades in pulled apart into its layers, then comes together
   3 the scene turns toward the pointer on a spring, sways gently while
     nobody is pointing at it, and can be dragged round (mouse or finger);
     the grid floor behind turns with it and a soft glow follows the mouse
   4 «نمای لایه‌ها», or a click on the scene, opens the layers view
   5 the phone works: a tap brings it forward (on small screens it opens
     full size instead) with the clinic's mobile site — it scrolls, has a
     menu, and books an appointment on real upcoming dates
   The animation loop only runs while the hero is on screen and the tab
   is visible. With reduced motion nothing moves on its own; the layers
   view and the phone still work, without the travel. */
(function () {
  'use strict';

  var hero = document.getElementById('sjHero');
  if (!hero) return;

  var stage = hero.querySelector('.sj-stage');
  var tilt = hero.querySelector('.sj-tilt');
  var visual = hero.querySelector('.sj-visual');
  var layersBtn = hero.querySelector('.sj-layers-btn');
  var phoneBtn = hero.querySelector('.sj-phone-btn');
  var screen = hero.querySelector('.sj-p-screen');
  var screenHome = screen.parentNode;
  var floor = hero.querySelector('.sj-bg-floor');
  var glow = hero.querySelector('.sj-bg-glow');
  var glares = hero.querySelectorAll('.sj-glare');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  hero.classList.add('sj-js');

  /* ── 1 · fit ───────────────────────────────────────────────────── */
  var DESIGN_W = 560, scale = 1;
  var SMALL = 0.9;                         /* below this the phone opens full size instead */
  function fit() {
    scale = Math.min(1, visual.clientWidth / DESIGN_W);
    stage.style.setProperty('--sj-scale', scale);
    if (phoneOpen && !modalOpen && scale < SMALL) closePhone();
  }

  /* ── 4 · layers view ───────────────────────────────────────────── */
  var building = false;
  function setLayers(on) {
    if (on && phoneOpen) closePhone();
    hero.classList.toggle('is-exploded', on);
    layersBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function toggleLayers() {
    if (building) return;                  /* let the entrance finish first */
    setLayers(!hero.classList.contains('is-exploded'));
  }
  layersBtn.addEventListener('click', toggleLayers);

  /* ── 5 · the phone ─────────────────────────────────────────────── */
  var phoneOpen = false, modalOpen = false, modal = null, backTo = null;
  var scroller = screen.querySelector('.sj-p-scroll');
  var menuBtn = screen.querySelector('.sj-p-menu-btn');
  var sheet = screen.querySelector('.sj-p-sheet');
  var confirmBtn = screen.querySelector('.sj-p-confirm');
  var summary = screen.querySelector('.sj-p-summary');
  var pushText = screen.querySelector('.sj-p-push-text');
  var pick = { service: '', day: '', time: '' };
  var pushTimer = 0, saveTimer = 0, tipTimer = 0, tipShown = false;
  var CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  function openPhone(withKeyboard) {
    if (phoneOpen || building) return;
    if (hero.classList.contains('is-exploded')) setLayers(false);
    phoneOpen = true;
    hideTip();
    backTo = document.activeElement;
    phoneBtn.setAttribute('aria-pressed', 'true');
    screen.inert = false;
    if (scale < SMALL) openModal();
    else hero.classList.add('is-phone');
    /* focus goes inside: to the first button from the keyboard, to the
       screen itself (no ring) when it was opened by touch into the overlay */
    if (withKeyboard || modalOpen) {
      setTimeout(function () { (withKeyboard ? menuBtn : screen).focus({ preventScroll: true }); }, reduced ? 0 : 420);
    }
  }
  function closePhone() {
    if (!phoneOpen) return;
    var focusInside = screen.contains(document.activeElement);
    phoneOpen = false;
    phoneBtn.setAttribute('aria-pressed', 'false');
    screen.inert = true;
    hero.classList.remove('is-phone');
    if (modalOpen) closeModal();
    setTimeout(resetPhone, reduced ? 0 : 650);
    if (focusInside) (backTo && backTo !== document.body ? backTo : phoneBtn).focus({ preventScroll: true });
  }
  phoneBtn.addEventListener('click', function (e) {
    if (phoneOpen) closePhone(); else openPhone(e.detail === 0);   /* detail 0: Enter or Space */
  });
  hero.querySelector('.sj-phone-close').addEventListener('click', closePhone);

  /* small screens: the same screen element, moved into a full-size frame */
  function openModal() {
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'sj-pm';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'نسخه‌ی موبایل سایت نمونه');
      modal.innerHTML = '<div class="sj-pm-frame"></div><button type="button" class="sj-pm-close" aria-label="بستن">' + CLOSE_SVG + '</button>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function (e) { if (e.target === modal) closePhone(); });
      modal.querySelector('.sj-pm-close').addEventListener('click', closePhone);
    }
    modal.firstChild.appendChild(screen);
    modalOpen = true;
    document.documentElement.classList.add('sj-pm-lock');
    void modal.offsetWidth;                /* start the fade from the closed state */
    modal.classList.add('is-open');
  }
  function closeModal() {
    modalOpen = false;
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('sj-pm-lock');
    setTimeout(function () { if (!modalOpen) screenHome.appendChild(screen); }, reduced ? 0 : 380);
  }

  /* the clinic's site inside */
  function setMenu(on) {
    screen.classList.toggle('is-menu', on);
    menuBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  var sheetFrom = null;
  function openSheet(service, withKeyboard) {
    clearTimeout(saveTimer); saveTimer = 0;
    sheet.classList.remove('is-done');
    sheet.scrollTop = 0;
    if (service) choose('service', sheet.querySelector('[data-pick="service"] [data-v="' + service + '"]'));
    screen.classList.add('is-sheet');
    sheetFrom = withKeyboard ? document.activeElement : null;
    var first = sheet.querySelector('[data-pick="service"] button');
    if (withKeyboard) setTimeout(function () { first.focus({ preventScroll: true }); }, reduced ? 0 : 300);
  }
  function closeSheet() {
    var focusInside = sheet.contains(document.activeElement);
    screen.classList.remove('is-sheet');
    if (sheet.classList.contains('is-done')) setTimeout(clearPicks, reduced ? 0 : 500);
    if (focusInside) (sheetFrom && screen.contains(sheetFrom) ? sheetFrom : menuBtn).focus({ preventScroll: true });
  }
  function choose(group, button) {
    if (!button || button.disabled) return;
    var all = sheet.querySelectorAll('[data-pick="' + group + '"] button');
    for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-pressed', all[i] === button ? 'true' : 'false');
    pick[group] = button.getAttribute('data-v');
    confirmBtn.disabled = !(pick.service && pick.day && pick.time);
  }
  function clearPicks() {
    pick = { service: '', day: '', time: '' };
    var all = sheet.querySelectorAll('[aria-pressed="true"]');
    for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-pressed', 'false');
    confirmBtn.disabled = true;
    sheet.classList.remove('is-done');
  }
  function confirmBooking() {
    if (confirmBtn.disabled || saveTimer) return;
    confirmBtn.classList.add('is-loading');
    confirmBtn.textContent = 'در حال ثبت…';
    saveTimer = setTimeout(function () {
      saveTimer = 0;
      confirmBtn.classList.remove('is-loading');
      confirmBtn.textContent = 'تأیید نوبت';
      summary.textContent = pick.service + ' · ' + pick.day + ' · ساعت ' + pick.time;
      sheet.classList.add('is-done');
      if (sheet.contains(document.activeElement)) sheet.querySelector('[data-act="done"]').focus({ preventScroll: true });
      /* …and the confirmation text message arrives */
      pushText.textContent = 'نوبت ' + pick.service + ' شما برای ' + pick.day + '، ساعت ' + pick.time + ' ثبت شد.';
      clearTimeout(pushTimer);
      setTimeout(function () { if (phoneOpen) screen.classList.add('is-push'); }, reduced ? 0 : 700);
      pushTimer = setTimeout(function () { screen.classList.remove('is-push'); }, reduced ? 6000 : 5200);
    }, reduced ? 0 : 900);
  }
  function goTo(id) {
    var target = screen.querySelector('#' + id);
    if (target) scroller.scrollTo({ top: target.offsetTop - 12, behavior: reduced ? 'auto' : 'smooth' });
  }
  function resetPhone() {
    if (phoneOpen) return;
    setMenu(false);
    screen.classList.remove('is-sheet', 'is-push');
    clearTimeout(saveTimer); saveTimer = 0;
    confirmBtn.classList.remove('is-loading');
    confirmBtn.textContent = 'تأیید نوبت';
    clearPicks();
    scroller.scrollTop = 0;
  }
  screen.addEventListener('click', function (e) {
    if (!phoneOpen) return;
    var el = e.target.closest('button, [data-act]');
    if (!el || !screen.contains(el) || el.disabled) return;
    var group = el.parentNode.getAttribute('data-pick');
    if (group) { choose(group, el); return; }
    var kb = e.detail === 0;                 /* Enter or Space: move focus along with it */
    switch (el.getAttribute('data-act')) {
      case 'menu': setMenu(true); if (kb) screen.querySelector('[data-act="menu-close"]').focus({ preventScroll: true }); break;
      case 'menu-close': setMenu(false); if (kb) menuBtn.focus({ preventScroll: true }); break;
      case 'goto': setMenu(false); if (kb) menuBtn.focus({ preventScroll: true }); goTo(el.getAttribute('data-to')); break;
      case 'book': setMenu(false); openSheet(el.getAttribute('data-service'), kb); break;
      case 'sheet-close': case 'done': closeSheet(); break;
      case 'confirm': confirmBooking(); break;
    }
  });

  /* the next six days in the Persian calendar; the clinic is closed on Fridays */
  (function fillDays() {
    var box = sheet.querySelector('[data-pick="day"]');
    var names = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
    var dayFmt = null;
    try { dayFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' }); } catch (err) { /* names only */ }
    var now = new Date(), html = '';
    for (var i = 1; i <= 6; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      var name = names[d.getDay()], date = dayFmt ? dayFmt.format(d) : '';
      if (d.getDay() === 5) {
        html += '<button type="button" disabled aria-label="' + name + '، تعطیل">' + name + '<small>تعطیل</small></button>';
      } else {
        html += '<button type="button" data-v="' + name + (date ? ' ' + date : '') + '" aria-pressed="false">' +
          (i === 1 ? 'فردا' : name) + '<small>' + (date || name) + '</small></button>';
      }
    }
    box.innerHTML = html;
  })();

  /* a hint, once, that the phone can be used */
  function showTip() {
    if (tipShown || phoneOpen) return;
    tipShown = true;
    hero.classList.add('show-tip');
    tipTimer = setTimeout(hideTip, 4200);
  }
  function hideTip() { clearTimeout(tipTimer); hero.classList.remove('show-tip'); }

  document.addEventListener('keydown', function (e) {
    /* the full-size overlay is a modal dialog: Tab goes round inside it */
    if (e.key === 'Tab' && modalOpen) {
      var all = modal.querySelectorAll('button:not([disabled])'), list = [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].offsetParent !== null && getComputedStyle(all[i]).visibility !== 'hidden') list.push(all[i]);
      }
      var first = list[0], lastOne = list[list.length - 1], at = document.activeElement;
      if (e.shiftKey && (at === first || !modal.contains(at))) { lastOne.focus(); e.preventDefault(); }
      else if (!e.shiftKey && (at === lastOne || !modal.contains(at))) { first.focus(); e.preventDefault(); }
      return;
    }
    if (e.key !== 'Escape') return;
    if (phoneOpen) {
      if (screen.classList.contains('is-sheet')) closeSheet();
      else if (screen.classList.contains('is-menu')) { setMenu(false); menuBtn.focus({ preventScroll: true }); }
      else closePhone();
    } else if (hero.classList.contains('is-exploded') && !building) {
      setLayers(false);
    }
  });

  /* ── pointer: who a press belongs to ─────────────────────────────
     A press on the phone's screen while it is in use belongs to the
     phone. Anything else on the stage is a drag that turns the scene,
     or — if it doesn't move — a click: on the phone it brings the phone
     forward, elsewhere it closes the phone or toggles the layers view. */
  var drag = null, dx = 0, dy = 0, lastPointer = -1e9;
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  stage.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    if (phoneOpen && e.target.closest('.sj-p-screen')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, onPhone: !!e.target.closest('.sj-phone') };
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
  });
  stage.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var mx = e.clientX - drag.x, my = e.clientY - drag.y;
    if (!drag.moved && Math.abs(mx) + Math.abs(my) > 6) {
      drag.moved = true;
      stage.classList.add('is-dragging');
    }
    if (drag.moved) {
      dy = clamp(mx * 0.32, -40, 40);
      dx = clamp(-my * 0.22, -22, 22);
    }
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var click = !drag.moved && e.type === 'pointerup', onPhone = drag.onPhone;
    drag = null;
    dx = dy = 0;
    stage.classList.remove('is-dragging');
    lastPointer = performance.now();
    if (!click) return;
    if (phoneOpen) { if (!onPhone) closePhone(); }
    else if (onPhone && !hero.classList.contains('is-exploded')) openPhone(false);
    else toggleLayers();
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(visual);
  else window.addEventListener('resize', fit);
  fit();

  if (reduced) {
    hero.classList.add('is-in');
    setTimeout(showTip, 600);
    return;
  }

  /* ── 3 · tilt, sway, drag; the background follows ──────────────── */
  var MAX_X = 9, MAX_Y = 16;               /* how far the pointer turns it, in degrees */
  var ax = 0, ay = 0, vx = 0, vy = 0;      /* current rotateX / rotateY and their speed */
  var px = 0, py = 0;                      /* where the pointer asks it to face */
  var t0 = performance.now();
  var running = false, onScreen = true, entered = false, last = 0, raf = 0;

  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    last = now;
    /* nobody pointing for a while: a slow sway, so it reads as 3D. With
       the phone in use it holds almost still, so it can be read. */
    var idle = !drag && now - lastPointer > 2600;
    var calm = phoneOpen ? 0.15 : 1;
    var tx = ((idle ? Math.cos((now - t0) / 2600) * 2.2 : px) + dx) * calm;
    var ty = ((idle ? Math.sin((now - t0) / 1900) * 4.5 : py) + dy) * calm;
    /* a soft spring, a little under critical damping, stepped 1/60 s at
       a time so that on a slow device it keeps time instead of lagging */
    for (var n = Math.ceil(dt / 0.0167), h = dt / n; n > 0; n--) {
      vx += ((tx - ax) * 36 - vx * 9.5) * h; ax += vx * h;
      vy += ((ty - ay) * 36 - vy * 9.5) * h; ay += vy * h;
    }
    tilt.style.transform = 'rotateX(' + ax.toFixed(2) + 'deg) rotateY(' + ay.toFixed(2) + 'deg)';
    /* the floor turns under the scene; the light stays put on the glass */
    floor.style.setProperty('--fx', (ax * 0.6).toFixed(2) + 'deg');
    floor.style.setProperty('--fz', (-ay * 0.5).toFixed(2) + 'deg');
    var gx = (60 - ay * 2.6).toFixed(1) + '%', gy = (ax * 3).toFixed(1) + '%';
    for (var i = 0; i < glares.length; i++) {
      glares[i].style.setProperty('--gx', gx);
      glares[i].style.setProperty('--gy', gy);
    }
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    var should = entered && onScreen && !document.hidden;
    if (should && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!should && running) { running = false; cancelAnimationFrame(raf); }   /* never two loops */
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { onScreen = entries[0].isIntersecting; sync(); }).observe(hero);
  }
  document.addEventListener('visibilitychange', sync);

  /* a mouse anywhere over the hero: the scene turns to face it, and the
     glow in the background follows */
  var glowAt = [0, 0], glowRaf = 0;
  function moveGlow() {
    glowRaf = 0;
    glow.style.transform = 'translate3d(' + glowAt[0] + 'px,' + glowAt[1] + 'px,0)';
  }
  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var h = hero.getBoundingClientRect();
    glowAt = [e.clientX - h.left, e.clientY - h.top];
    if (!glowRaf) glowRaf = requestAnimationFrame(moveGlow);
    hero.classList.add('has-pointer');
    if (drag) return;
    var s = stage.getBoundingClientRect();
    py = clamp((e.clientX - (s.left + s.width / 2)) / (h.width / 2), -1, 1) * MAX_Y;
    px = clamp(-(e.clientY - (s.top + s.height / 2)) / (h.height / 2), -1, 1) * MAX_X;
    lastPointer = performance.now();
  });
  hero.addEventListener('pointerleave', function (e) {
    if (e.pointerType !== 'mouse') return;
    px = py = 0;
    hero.classList.remove('has-pointer');
  });

  /* ── 2 · entrance ──────────────────────────────────────────────── */
  /* lay the pulled-apart scene out before anyone sees it, without travel */
  building = true;
  hero.classList.add('sj-instant', 'is-pre', 'is-exploded', 'is-building');
  void stage.offsetWidth;
  hero.classList.remove('sj-instant');

  function enter() {
    if (entered) return;
    entered = true;
    hero.classList.add('is-in');
    hero.classList.remove('is-pre');                        /* fade in, still apart */
    sync();
    setTimeout(function () { hero.classList.remove('is-exploded'); }, 900);   /* …and together */
    setTimeout(function () { hero.classList.remove('is-building'); building = false; }, 2200);
    setTimeout(showTip, 2700);
  }

  var preloader = document.getElementById('preloader');
  if (!preloader || !document.body.classList.contains('locked')) {
    requestAnimationFrame(enter);
  } else {
    /* main.js removes body.locked as the preloader lifts */
    var mo = new MutationObserver(function () {
      if (!document.body.classList.contains('locked')) { mo.disconnect(); setTimeout(enter, 250); }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setTimeout(enter, 4000);              /* safety net */
  }
})();
