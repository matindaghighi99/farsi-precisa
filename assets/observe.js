/* Precisa Solutions — first-party observability
   Captures pageviews, JS errors, performance timings, Core Web Vitals
   (LCP/CLS/INP), and CTA clicks into a localStorage ring buffer that the
   Workshop's "Site Health" view reads. No cookies, no third parties.
   To ship events to a real collector later, set MSObserve.endpoint to a
   same-origin URL (and widen connect-src in the CSP if cross-origin). */
(function () {
  'use strict';

  var KEY = 'ms_telemetry_v1';
  var MAX_EVENTS = 500;

  var buf;
  try { buf = JSON.parse(localStorage.getItem(KEY)) || []; }
  catch (e) { buf = []; }
  if (!Array.isArray(buf)) buf = [];

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(buf.slice(-MAX_EVENTS))); }
    catch (e) { /* storage full/blocked — keep in memory only */ }
  }

  function sessionId() {
    var id = sessionStorage.getItem('ms_sid');
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('ms_sid', id);
    }
    return id;
  }

  function page() {
    var p = location.pathname.split('/').pop() || 'index.html';
    return p;
  }

  function log(type, data) {
    buf.push({ t: Date.now(), type: type, page: page(), sid: sessionId(), data: data || {} });
    if (buf.length > MAX_EVENTS) buf = buf.slice(-MAX_EVENTS);
    persist();
    send();
  }

  /* Optional remote sink (disabled until endpoint is set) */
  var pending = [];
  function send() {
    if (!MSObserve.endpoint) return;
    pending.push(buf[buf.length - 1]);
    if (pending.length >= 10) flush();
  }
  function flush() {
    if (!MSObserve.endpoint || !pending.length || !navigator.sendBeacon) return;
    try {
      navigator.sendBeacon(MSObserve.endpoint, JSON.stringify(pending));
      pending = [];
    } catch (e) { /* keep pending for next try */ }
  }

  var MSObserve = window.MSObserve = {
    endpoint: '',
    log: log,
    getAll: function () { return buf.slice(); },
    clear: function () { buf = []; pending = []; persist(); }
  };

  /* ---- pageview ---- */
  log('pageview', {
    ref: document.referrer ? document.referrer.slice(0, 120) : null,
    vw: window.innerWidth,
    lang: navigator.language
  });

  /* ---- JS errors ---- */
  window.addEventListener('error', function (e) {
    log('error', {
      msg: String(e.message || 'Script error').slice(0, 220),
      src: e.filename ? e.filename.split('/').pop().slice(0, 60) : '',
      line: e.lineno || 0
    });
  });
  window.addEventListener('unhandledrejection', function (e) {
    var reason = e.reason && e.reason.message ? e.reason.message : String(e.reason);
    log('error', { msg: ('Unhandled promise: ' + reason).slice(0, 220), src: '', line: 0 });
  });

  /* ---- load performance ---- */
  window.addEventListener('load', function () {
    setTimeout(function () {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav) {
        log('perf', {
          ttfb: Math.round(nav.responseStart),
          dcl: Math.round(nav.domContentLoadedEventEnd),
          load: Math.round(nav.loadEventEnd),
          transfer: Math.round(nav.transferSize || 0)
        });
      }
    }, 0);
  });

  /* ---- Core Web Vitals ---- */
  var lcp = 0, cls = 0, inp = 0, vitalsSent = false;
  try {
    new PerformanceObserver(function (list) {
      var entries = list.getEntries();
      if (entries.length) lcp = Math.round(entries[entries.length - 1].startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (en) {
        if (!en.hadRecentInput) cls += en.value;
      });
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (en) {
        var d = en.processingEnd - en.startTime;
        if (d > inp) inp = Math.round(d);
      });
    }).observe({ type: 'event', buffered: true, durationThreshold: 40 });
  } catch (e) {}

  function reportVitals() {
    if (vitalsSent || (!lcp && !cls && !inp)) return;
    vitalsSent = true;
    log('vitals', { lcp: lcp, cls: Math.round(cls * 1000) / 1000, inp: inp });
    flush();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') reportVitals();
  });
  window.addEventListener('pagehide', reportVitals);

  /* ---- CTA / interaction tracking ---- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest(
      '[data-track], .btn-gold, .btn-primary, .btn-ghost, .nav-cta, .nav-portal, .filter-btn'
    );
    if (!el) return;
    var label = el.getAttribute('data-track') ||
      (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48) ||
      el.getAttribute('aria-label') || 'unlabeled';
    log('click', { label: label });
  }, true);

  /* ---- session heartbeat: time on page ---- */
  var t0 = Date.now();
  window.addEventListener('pagehide', function () {
    log('engagement', { seconds: Math.round((Date.now() - t0) / 1000) });
    flush();
  });
})();
