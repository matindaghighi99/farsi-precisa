/* Precisa Solutions — System Vault behaviors
   (schematic activation, 3D tilt, filter a11y, preview modal,
    choose-your-bottleneck recommender) */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* strings this script writes, in the page's language (fa/ is Persian) */
  var T = document.documentElement.lang === 'fa' ? {
    livePreview: 'پیش‌نمایش زنده‌ی سایت', sysPreview: 'پیش‌نمایش سامانه',
    recommended: ' — سامانه‌ی پیشنهادی', builtFor: ' دقیقاً برای همین ساخته شده است.',
    preview: 'پیش‌نمایش این سامانه', call: 'یا یک جلسه‌ی مشاوره رزرو کنید'
  } : {
    livePreview: 'Live site preview', sysPreview: 'System preview',
    recommended: ' — recommended system', builtFor: ' is built for this.',
    preview: 'Preview this system', call: 'or book a strategy call'
  };

  /* ---------- Schematics: reusable hub-diagram component ----------
     Any `.schematic` SVG (the featured system's automation map, or one
     dropped into a future page) gets, with zero extra config:
       1. a one-time reveal — wires draw in and nodes fade up the
          first time the diagram scrolls into view;
       2. hover/focus highlighting — a node with data-wire="wire-N"
          lights that wire (and itself); data-wire="all" (the hub
          node) lights every wire in the diagram.
     Markup contract: .wire.wire-N paths, .mnode [data-wire] groups,
     .pulse-dot[data-wire] traveling dots (optional). See the "Reusable
     hub schematic component" header in projects.css for the full spec. */
  function initSchematics() {
    document.querySelectorAll('.schematic').forEach(function (svg) {
      if (reduceMotion) {
        svg.classList.add('active');
      } else {
        var obs = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              svg.classList.add('active');
              obs.disconnect();
            }
          });
        }, { threshold: 0.3 });
        obs.observe(svg);
      }

      svg.querySelectorAll('.mnode[data-wire]').forEach(function (node) {
        var key = node.getAttribute('data-wire');
        var targets = key === 'all'
          ? svg.querySelectorAll('.wire, .pulse-dot')
          : svg.querySelectorAll('.wire.' + key + ', .pulse-dot[data-wire="' + key + '"]');

        function on()  { node.classList.add('hot');  targets.forEach(function (t) { t.classList.add('hot'); }); }
        function off() { node.classList.remove('hot'); targets.forEach(function (t) { t.classList.remove('hot'); }); }

        node.addEventListener('mouseenter', on);
        node.addEventListener('mouseleave', off);
        node.addEventListener('focus', on);
        node.addEventListener('blur', off);
      });
    });
  }
  initSchematics();

  /* ---------- 3D tilt + glare on system capsules ---------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.sys-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        card.style.transform =
          'translateY(-6px) perspective(1100px)' +
          ' rotateX(' + ((0.5 - py) * 3.2).toFixed(2) + 'deg)' +
          ' rotateY(' + ((px - 0.5) * 3.2).toFixed(2) + 'deg)';
        card.style.setProperty('--mx', (px * 100) + '%');
        card.style.setProperty('--my', (py * 100) + '%');
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  }

  /* ---------- "Live in production": hover-to-scroll live embeds ----------
     Each .live-media ships a still screenshot as its poster. The first time
     the pointer *settles* on one, we swap in a real iframe of the site so the
     visitor can wheel-scroll the actual page in place.

     Two deliberate choices:
       · DWELL before activating. A cursor that merely sweeps across the panel
         while the visitor is scrolling the page must not have its wheel events
         swallowed by the embed, so the iframe stays pointer-events:none until
         the pointer has rested for DWELL ms (and goes inert again on leave).
       · FIXED 1440x900 VIEWPORT, scaled by --live-scale. Sizing the iframe to
         the container instead would hand the site a ~600px viewport and it
         would render its mobile layout — the opposite of showing the work.

     Touch devices and reduced-motion keep the poster: there is no hover to
     resolve, and three live sites is a lot of weight to load unasked. */
  var LIVE_W = 1440, LIVE_H = 900, DWELL = 350;

  function initLivePreviews() {
    var frames = document.querySelectorAll('.live-media[data-live-src]');
    if (!frames.length) return;

    function rescale(frame) {
      var view = frame.querySelector('.live-view');
      if (view) frame.style.setProperty('--live-scale', view.clientWidth / LIVE_W);
    }
    frames.forEach(rescale);

    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function (entries) {
        entries.forEach(function (e) { rescale(e.target.closest('.live-media')); });
      });
      frames.forEach(function (f) {
        var v = f.querySelector('.live-view');
        if (v) ro.observe(v);
      });
    } else {
      window.addEventListener('resize', function () { frames.forEach(rescale); });
    }

    if (!finePointer || reduceMotion) return;   /* poster only */

    frames.forEach(function (frame) {
      var view = frame.querySelector('.live-view');
      if (!view) return;
      var timer = null, loaded = false;

      function activate() {
        if (!loaded) {
          loaded = true;
          rescale(frame);
          var f = document.createElement('iframe');
          f.title = frame.getAttribute('data-live-title') || T.livePreview;
          f.setAttribute('loading', 'lazy');
          f.setAttribute('referrerpolicy', 'no-referrer');
          f.addEventListener('load', function () { frame.classList.add('is-loaded'); });
          f.src = frame.getAttribute('data-live-src');
          view.appendChild(f);
        }
        frame.classList.add('is-live');
      }

      frame.addEventListener('mouseenter', function () {
        timer = window.setTimeout(activate, DWELL);
      });
      frame.addEventListener('mouseleave', function () {
        window.clearTimeout(timer);
        frame.classList.remove('is-live');   /* inert again — page scroll wins */
      });
    });
  }
  initLivePreviews();

  /* ---------- Filter buttons: aria-pressed sync ---------- */
  var filterBar = document.getElementById('filterBar');
  if (filterBar) {
    var btns = filterBar.querySelectorAll('.filter-btn');
    btns.forEach(function (b) {
      b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
      b.addEventListener('click', function () {
        btns.forEach(function (o) {
          o.setAttribute('aria-pressed', o.classList.contains('active') ? 'true' : 'false');
        });
      });
    });
  }

  /* ---------- System preview modal ---------- */
  var modal = document.getElementById('sysModal');
  var modalBody = document.getElementById('sysModalBody');
  var lastFocus = null;

  function openModal(sysId) {
    if (!modal || !modalBody) return;
    var tpl = document.querySelector('template[data-sys-tpl="' + sysId + '"]');
    if (!tpl) return;

    modalBody.innerHTML = '';
    modalBody.appendChild(tpl.content.cloneNode(true));

    var title = modalBody.querySelector('.smx-title');
    if (title) {
      title.id = 'sysModalTitle';
      modal.setAttribute('aria-labelledby', 'sysModalTitle');
      modal.removeAttribute('aria-label');
    } else {
      modal.removeAttribute('aria-labelledby');
      modal.setAttribute('aria-label', T.sysPreview);
    }

    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    var closeBtn = modal.querySelector('.sys-modal-close');
    if (closeBtn) closeBtn.focus();
    if (window.MSObserve) MSObserve.log('click', { label: 'preview_system:' + sysId });
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    modalBody.innerHTML = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }

  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-modal-close]')) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (modal.hidden) return;
      if (e.key === 'Escape') {
        closeModal();
        return;
      }
      if (e.key === 'Tab') {
        var focusables = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  /* capsule "Preview System" buttons */
  document.querySelectorAll('.sys-card .sys-cta').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.sys-card');
      if (card && card.dataset.sys) openModal(card.dataset.sys);
    });
  });

  /* ---------- Choose-your-bottleneck recommender ---------- */
  var recPanel = document.getElementById('recPanel');
  var recChips = document.querySelectorAll('.rec-chip');

  function renderRecommendation(chip) {
    var sysId = chip.dataset.rec;
    var wrap = document.createElement('div');
    wrap.className = 'rec-result';

    var code = document.createElement('span');
    code.className = 'rec-code';
    code.textContent = chip.dataset.recCode + T.recommended;
    wrap.appendChild(code);

    var h3 = document.createElement('h3');
    var em = document.createElement('em');
    em.textContent = chip.dataset.recName;
    h3.appendChild(em);
    h3.appendChild(document.createTextNode(T.builtFor));
    wrap.appendChild(h3);

    var why = document.createElement('p');
    why.className = 'rec-why';
    why.textContent = chip.dataset.recWhy;
    wrap.appendChild(why);

    var actions = document.createElement('div');
    actions.className = 'rec-actions';

    var previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'rec-preview-btn';
    previewBtn.textContent = T.preview;
    previewBtn.addEventListener('click', function () { openModal(sysId); });
    actions.appendChild(previewBtn);

    var call = document.createElement('a');
    call.className = 'link-arrow';
    call.href = 'contact.html';
    call.textContent = T.call;
    actions.appendChild(call);

    wrap.appendChild(actions);

    recPanel.innerHTML = '';
    recPanel.appendChild(wrap);
  }

  if (recPanel && recChips.length) {
    recChips.forEach(function (chip) {
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', function () {
        recChips.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        chip.setAttribute('aria-pressed', 'true');
        renderRecommendation(chip);
        if (window.MSObserve) MSObserve.log('click', { label: 'recommend:' + chip.dataset.rec });
      });
    });
  }
})();
