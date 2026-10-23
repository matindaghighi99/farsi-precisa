/* Precisa Solutions — System Intake Console (contact page)
   Multi-step wizard: step navigation, validation, live briefing panel,
   and real submission to /api/contact. */
(function () {
  'use strict';

  var form = document.getElementById('intakeForm');
  if (!form) return;

  /* every string the console writes, in the page's language (fa/ is Persian) */
  var fa = document.documentElement.lang === 'fa';
  var T = fa ? {
    steps: ['هویت', 'سامانه', 'مشخصات', 'شرح نیاز'],
    chars: ' حرف ثبت شد', ready: 'آماده‌ی ارسال', standby: 'در انتظار',
    errName: 'خطا — نام خود را وارد کنید.',
    errEmail: 'خطا — یک ایمیل معتبر لازم است.',
    errMessage: 'خطا — پیش از ارسال، گلوگاه کارتان را شرح دهید.',
    transmitting: 'در حال ارسال…', sending: 'در حال ارسال…', submit: 'ارسال درخواست',
    received: 'دریافت شد', complete: 'تکمیل شد', failed: 'ارسال ناموفق',
    retry: 'ارسال انجام نشد. دوباره تلاش کنید یا مستقیم ایمیل بزنید.', errPrefix: 'خطا — ',
    wrong: 'ارسال انجام نشد. دوباره تلاش کنید یا مستقیم ایمیل بزنید.'
  } : {
    steps: ['IDENTITY', 'SYSTEM', 'PARAMETERS', 'BRIEFING'],
    chars: ' chars logged', ready: 'READY TO TRANSMIT', standby: 'STANDBY',
    errName: 'ERR — operator name required.',
    errEmail: 'ERR — a valid work email is required.',
    errMessage: 'ERR — describe the bottleneck before transmitting.',
    transmitting: 'TRANSMITTING…', sending: 'Transmitting…', submit: 'Transmit Request',
    received: 'RECEIVED', complete: 'COMPLETE', failed: 'TRANSMISSION FAILED',
    retry: 'transmission failed. Please retry or email us directly.', errPrefix: 'ERR — ',
    wrong: 'Something went wrong. Please try again.'
  };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var steps = form.querySelectorAll('.ic-step');
  var railItems = form.querySelectorAll('.ic-rail-item');
  var stepNum = document.getElementById('icStepNum');
  var stepName = document.getElementById('icStepName');
  var progress = document.getElementById('icProgress');
  var errBox = document.getElementById('icError');
  var backBtn = document.getElementById('icBack');
  var nextBtn = document.getElementById('icNext');
  var submitBtn = document.getElementById('icSubmit');
  var statusEl = document.getElementById('icStatus');
  var counter = document.getElementById('icCount');
  var current = 0;
  var maxVisited = 0;

  /* ---------------- status panel ---------------- */
  function setStatus(cls, text) {
    statusEl.className = 'icp-status-value' + (cls ? ' ' + cls : '');
    statusEl.innerHTML = '<i aria-hidden="true"></i>';
    statusEl.appendChild(document.createTextNode(text));
  }

  function fieldValue(name) {
    var els = form.elements[name];
    if (!els) return '';
    if (els.length !== undefined && els.tagName === undefined) { // RadioNodeList
      return els.value || '';
    }
    return els.value || '';
  }

  /* The Persian page submits the English option values the server accepts,
     but shows the visitor the Persian label they picked. */
  function shown(key, val) {
    if (!fa || !val) return val;
    var picked = form.querySelector('input[type="radio"][name="' + key + '"]:checked');
    return picked ? picked.closest('label').textContent.trim() : val;
  }

  function updatePanel() {
    ['name', 'email', 'company', 'system', 'budget', 'timeline', 'message'].forEach(function (key) {
      var row = form.querySelector('.icp-row[data-track="' + key + '"]');
      if (!row) return;
      var val = fieldValue(key).trim();
      var out = row.querySelector('.icp-value');
      if (key === 'message') {
        out.textContent = val ? val.length + T.chars : '—';
      } else {
        out.textContent = shown(key, val) || '—';
      }
      row.classList.toggle('on', !!val);
    });

    var ready = fieldValue('name').trim() &&
                EMAIL_RE.test(fieldValue('email').trim()) &&
                fieldValue('message').trim();
    if (!statusEl.classList.contains('transmitting') &&
        !statusEl.classList.contains('received') &&
        !statusEl.classList.contains('failed')) {
      setStatus(ready ? 'ready' : '', ready ? T.ready : T.standby);
    }
  }

  /* ---------------- step navigation ---------------- */
  function showError(msg) {
    errBox.textContent = msg;
    errBox.hidden = false;
  }
  function clearError() {
    errBox.hidden = true;
    errBox.textContent = '';
  }

  function validateStep(i) {
    if (i === 0) {
      if (!fieldValue('name').trim()) return T.errName;
      if (!EMAIL_RE.test(fieldValue('email').trim())) return T.errEmail;
    }
    if (i === 3) {
      if (!fieldValue('message').trim()) return T.errMessage;
    }
    return null;
  }

  function showStep(i) {
    current = i;
    maxVisited = Math.max(maxVisited, i);
    clearError();

    steps.forEach(function (s) {
      s.classList.toggle('active', Number(s.dataset.step) === i);
    });
    railItems.forEach(function (r, idx) {
      r.classList.toggle('current', idx === i);
      r.classList.toggle('done', idx < i);
      r.disabled = idx > maxVisited && idx !== i;
    });

    stepNum.textContent = '0' + (i + 1);
    stepName.textContent = T.steps[i];
    progress.style.width = ((i + 1) / steps.length * 100) + '%';

    backBtn.hidden = i === 0;
    nextBtn.hidden = i === steps.length - 1;
    submitBtn.hidden = i !== steps.length - 1;

    var first = steps[i].querySelector('input:not([type="radio"]), textarea') ||
                steps[i].querySelector('input');
    if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 80);
  }

  nextBtn.addEventListener('click', function () {
    var err = validateStep(current);
    if (err) { showError(err); return; }
    if (window.MSObserve) MSObserve.log('click', { label: 'intake_step:' + (current + 2) });
    showStep(current + 1);
  });
  backBtn.addEventListener('click', function () { showStep(current - 1); });

  railItems.forEach(function (r, idx) {
    r.addEventListener('click', function () {
      if (idx > maxVisited) return;
      if (idx > current) {
        var err = validateStep(current);
        if (err) { showError(err); return; }
      }
      showStep(idx);
    });
  });

  /* Enter advances (except in the textarea and on buttons) */
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var t = e.target;
    if (t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON') return;
    e.preventDefault();
    if (current < steps.length - 1) nextBtn.click();
  });

  /* ---------------- live updates ---------------- */
  form.addEventListener('input', updatePanel);
  form.addEventListener('change', updatePanel);

  var msg = document.getElementById('cf-message');
  if (msg && counter) {
    msg.addEventListener('input', function () {
      counter.textContent = msg.value.length + ' / 2000';
    });
  }

  /* ---------------- submission ---------------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = validateStep(0) || validateStep(3);
    if (err) { showError(err); return; }
    clearError();

    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });

    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = T.sending;
    setStatus('transmitting', T.transmitting);

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok || !body.ok) throw new Error(body.error || T.wrong);
        });
      })
      .then(function () {
        setStatus('received', T.received);
        form.classList.add('done');
        var success = document.getElementById('icSuccess');
        success.hidden = false;
        stepName.textContent = T.complete;
        stepNum.textContent = '04';
        progress.style.width = '100%';
        success.focus && success.setAttribute('tabindex', '-1');
        success.focus();
        if (window.MSObserve) MSObserve.log('click', { label: 'intake_transmitted' });
      })
      .catch(function (error) {
        setStatus('failed', T.failed);
        showError(T.errPrefix + ((!fa && error.message) || T.retry));   /* server and network errors are English */
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = T.submit;
        if (window.MSObserve) MSObserve.log('click', { label: 'intake_failed' });
      });
  });

  /* ---------------- init ---------------- */
  updatePanel();
  showStep(0);
})();
