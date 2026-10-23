/* Precisa Solutions — cookie consent banner
   First-party only. Stores the visitor's choice for a year and re-shows
   nothing once a decision is made. Reopen anytime via MSCookies.open()
   or by clicking any element with [data-cookie-settings]. */
(function () {
  'use strict';

  var STORAGE_KEY = 'ms_cookie_consent';
  var MAX_AGE = 60 * 60 * 24 * 365; // 1 year, in seconds

  // localStorage is a fallback for contexts where document.cookie doesn't
  // persist across page loads (e.g. local file:// testing).
  function readLocalStorage() {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function writeLocalStorage(value) {
    try {
      if (value) window.localStorage.setItem(STORAGE_KEY, value);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  function readConsent() {
    var match = document.cookie.match(/(?:^|;\s*)ms_cookie_consent=([^;]+)/);
    return (match ? decodeURIComponent(match[1]) : null) || readLocalStorage();
  }

  function writeConsent(value) {
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      STORAGE_KEY + '=' + encodeURIComponent(value) +
      '; Max-Age=' + MAX_AGE + '; Path=/; SameSite=Lax' + secure;
    writeLocalStorage(value);
  }

  function log(action) {
    if (window.MSObserve && typeof MSObserve.log === 'function') {
      MSObserve.log('cookie_consent', { choice: action });
    }
  }

  // The Persian pages live one folder down (fa/) and link the English policy.
  var T = document.documentElement.lang === 'fa' ? {
    label: 'اطلاعیه کوکی', title: 'یادداشتی کوتاه درباره کوکی‌ها',
    body: 'ما فقط از کوکی‌های ضروری خودِ سایت استفاده می‌کنیم تا سایت درست کار کند ' +
      'و همین انتخاب شما را به خاطر بسپارد. هیچ داده‌ای فروخته یا به اشتراک گذاشته نمی‌شود. ' +
      '<a href="https://precisasolutions.ca/privacy.html" hreflang="en">سیاست حریم خصوصی (انگلیسی)</a> را ببینید.',
    decline: 'نمی‌پذیرم', accept: 'می‌پذیرم'
  } : {
    label: 'Cookie notice', title: 'A quiet note on cookies',
    body: 'We use only essential first-party cookies to keep the site working ' +
      'and to remember this choice. Nothing is sold or shared. ' +
      'See our <a href="privacy.html">Privacy Policy</a>.',
    decline: 'Decline', accept: 'Accept'
  };

  function build() {
    var banner = document.createElement('aside');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', T.label);
    banner.innerHTML =
      '<div class="cookie-banner-inner">' +
        '<div class="cookie-banner-copy">' +
          '<span class="cookie-banner-title">' + T.title + '</span>' +
          '<p>' + T.body + '</p>' +
        '</div>' +
        '<div class="cookie-banner-actions">' +
          '<button type="button" class="cookie-btn cookie-btn-ghost" data-cookie-choice="declined">' + T.decline + '</button>' +
          '<button type="button" class="cookie-btn cookie-btn-gold" data-cookie-choice="accepted">' + T.accept + '</button>' +
        '</div>' +
      '</div>';
    return banner;
  }

  var current = null;

  function open() {
    if (current) { current.classList.add('is-visible'); return; }
    var banner = build();
    document.body.appendChild(banner);
    current = banner;

    banner.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cookie-choice]');
      if (!btn) return;
      var choice = btn.getAttribute('data-cookie-choice');
      writeConsent(choice);
      log(choice);
      close();
    });

    // Animate in on next frame so the transition runs.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { banner.classList.add('is-visible'); });
    });
  }

  function close() {
    if (!current) return;
    current.classList.remove('is-visible');
    var el = current;
    current = null;
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 450);
  }

  // Public API — lets a "Cookie settings" link reopen the banner.
  window.MSCookies = {
    open: open,
    reset: function () {
      writeConsent('');
      document.cookie = STORAGE_KEY + '=; Max-Age=0; Path=/';
      open();
    },
    choice: readConsent
  };

  function init() {
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-cookie-settings]')) {
        e.preventDefault();
        open();
      }
    });

    if (!readConsent()) open();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
