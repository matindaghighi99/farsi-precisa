/* Precisa Solutions — card checkout interaction concept.
   Extracted from an inline <script> so the page satisfies the site CSP
   (script-src 'self'); the behaviour is unchanged. */
(function () {
  const $ = (id) => document.getElementById(id);

  // Embedded on projects.html inside an iframe: the panel around it already
  // supplies a title, so ?embed=1 drops the page furniture and tightens up.
  if (/(^|[?&])embed=1(&|$)/.test(location.search)) {
    document.documentElement.classList.add("is-embed");
  }

  const checkout = $("checkout");
  const cardSlot = $("cardSlot");
  const cardTilt = $("cardTilt");
  const cardInner = $("cardInner");
  const glow = $("glow");

  const nameInput = $("ccName");
  const panInput = $("ccNumber");
  const expiryInput = $("ccExpiry");
  const cvcInput = $("ccCvc");
  const brandBadge = $("brandBadge");

  const panDisplay = $("panDisplay");
  const nameDisplay = $("nameDisplay");
  const expiryDisplay = $("expiryDisplay");
  const cvcDisplay = $("cvcDisplay");

  const payForm = $("payForm");
  const payLock = $("payLock");
  const payBtn = $("payBtn");
  const formMsg = $("formMsg");
  const statusTitle = $("statusTitle");
  const statusSub = $("statusSub");
  const retryBtn = $("retryBtn");

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const digitsOnly = (s) => s.replace(/\D/g, "");

  // Same deal as the order page: Windows exposes its "Animation
  // effects" accessibility switch as prefers-reduced-motion, which
  // was freezing the flip, tilt and processing choreography on any
  // machine with it off. Flip HONOR_REDUCED_MOTION to true to serve
  // those machines the motion-free version; while false, everyone
  // gets the full experience. Read live, never frozen at load.
  const HONOR_REDUCED_MOTION = false;
  const reducedMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  const calm = () => HONOR_REDUCED_MOTION && reducedMotionMQ.matches;
  const syncCalm = () =>
    document.documentElement.classList.toggle("reduce-motion", calm());
  syncCalm();
  if (reducedMotionMQ.addEventListener) {
    reducedMotionMQ.addEventListener("change", syncCalm);
  }

  // Reformats an input's value while keeping the caret sitting after the
  // same DIGIT it was after before - otherwise editing a typo mid-string
  // (rather than at the end) bounces the caret to the end on every key.
  function reformatPreservingCaret(input, formatter) {
    const prevCaret = input.selectionStart ?? input.value.length;
    const digitsBeforeCaret = digitsOnly(input.value.slice(0, prevCaret)).length;
    const digits = digitsOnly(input.value);
    const next = formatter(digits);
    input.value = next;

    if (digitsBeforeCaret === 0) {
      input.setSelectionRange(0, 0);
      return digits;
    }
    let seen = 0, pos = next.length;
    for (let i = 0; i < next.length; i++) {
      if (/\d/.test(next[i])) seen++;
      if (seen === digitsBeforeCaret) { pos = i + 1; break; }
    }
    input.setSelectionRange(pos, pos);
    return digits;
  }

  // ---------- formatting ----------
  function formatPAN(digits) {
    return digits.slice(0, 16).match(/.{1,4}/g)?.join(" ") ?? "";
  }

  function formatExpiry(digits) {
    digits = digits.slice(0, 4);
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + " / " + digits.slice(2);
  }

  function luhnValid(num) {
    if (num.length < 13) return false;
    let sum = 0, alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let d = parseInt(num[i], 10);
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  // ---------- card face sync ----------
  function renderPAN() {
    const digits = digitsOnly(panInput.value);
    brandBadge.classList.toggle("show", digits.startsWith("4"));

    const groups = [];
    for (let i = 0; i < 16; i += 4) {
      const g = digits.slice(i, i + 4);
      groups.push(g.length ? g.padEnd(4, "•") : "••••");
    }
    panDisplay.innerHTML = groups
      .map((g, i) => {
        const has = digits.slice(i * 4, i * 4 + 4).length > 0;
        return `<span class="pan__group${has ? "" : " pan__group--empty"}">${g}</span>`;
      })
      .join(" ");

    updateGlow(digits);
  }

  function updateGlow(digits) {
    const state =
      digits.length >= 13 && luhnValid(digits) ? "ok"
      : digits.length >= 16 ? "bad"
      : "";
    // --on carries the fade; the colour class is sticky so a glow
    // fading OUT still has a shadow to fade with (removing the colour
    // in the same frame made it vanish instead of fade).
    glow.classList.toggle("glow--on", state !== "");
    if (state) {
      glow.classList.toggle("glow--ok", state === "ok");
      glow.classList.toggle("glow--bad", state === "bad");
    }
  }

  function renderName() {
    const v = nameInput.value.trim().toUpperCase();
    nameDisplay.textContent = v.length ? v : "YOUR NAME";
  }

  function renderExpiry() {
    const digits = digitsOnly(expiryInput.value).slice(0, 4);
    if (digits.length >= 3) {
      expiryDisplay.textContent = digits.slice(0, 2) + "/" + digits.slice(2);
    } else {
      expiryDisplay.textContent = "••/••";
    }
  }

  function renderCvc() {
    cvcDisplay.textContent = digitsOnly(cvcInput.value).slice(0, 4);
  }

  // ---------- flip ----------
  function flip(toBack) {
    cardInner.classList.toggle("flipped", toBack);
  }

  // ---------- input wiring ----------
  panInput.addEventListener("input", () => {
    reformatPreservingCaret(panInput, formatPAN);
    renderPAN();
  });

  expiryInput.addEventListener("input", () => {
    reformatPreservingCaret(expiryInput, formatExpiry);
    renderExpiry();
  });

  cvcInput.addEventListener("input", () => {
    cvcInput.value = digitsOnly(cvcInput.value).slice(0, 4);
    renderCvc();
  });

  nameInput.addEventListener("input", renderName);

  cvcInput.addEventListener("focus", () => flip(true));
  cvcInput.addEventListener("blur", () => {
    if (!checkout.classList.contains("is-processing")) flip(false);
  });

  // ---------- tilt ----------
  {
    let tiltFrame = 0;

    cardSlot.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch" || calm()) return;
      cardTilt.classList.add("is-tracking");
      const x = e.clientX, y = e.clientY;
      cancelAnimationFrame(tiltFrame);
      tiltFrame = requestAnimationFrame(() => {
        const r = cardSlot.getBoundingClientRect();
        const px = (x - r.left) / r.width - 0.5;
        const py = (y - r.top) / r.height - 0.5;
        cardTilt.style.setProperty("--ry", (px * 14).toFixed(2) + "deg");
        cardTilt.style.setProperty("--rx", (-py * 10).toFixed(2) + "deg");
        // unitless percents for the shine sweep and hologram refraction
        cardTilt.style.setProperty("--sx", (px * 58).toFixed(1));
        cardTilt.style.setProperty("--sy", (py * 58).toFixed(1));
      });
    });

    cardSlot.addEventListener("pointerleave", () => {
      cancelAnimationFrame(tiltFrame);
      cardTilt.classList.remove("is-tracking");
      cardTilt.style.setProperty("--ry", "0deg");
      cardTilt.style.setProperty("--rx", "0deg");
      cardTilt.style.setProperty("--sx", "0");
      cardTilt.style.setProperty("--sy", "0");
    });
  }

  // ---------- validation ----------
  function validate() {
    const digits = digitsOnly(panInput.value);
    const panOk = luhnValid(digits) && digits.length >= 13;

    const expDigits = digitsOnly(expiryInput.value);
    let expOk = false;
    if (expDigits.length === 4) {
      const mm = parseInt(expDigits.slice(0, 2), 10);
      const yy = parseInt(expDigits.slice(2), 10);
      if (mm >= 1 && mm <= 12) {
        const now = new Date();
        const curYY = now.getFullYear() % 100;
        const curMM = now.getMonth() + 1;
        expOk = yy > curYY || (yy === curYY && mm >= curMM);
      }
    }

    const cvcOk = digitsOnly(cvcInput.value).length >= 3;
    const nameOk = nameInput.value.trim().length > 1;

    [nameInput, panInput, expiryInput, cvcInput].forEach((el) => {
      el.classList.remove("invalid");
      el.removeAttribute("aria-invalid");
    });
    if (!nameOk) { nameInput.classList.add("invalid"); nameInput.setAttribute("aria-invalid", "true"); }
    if (!panOk) { panInput.classList.add("invalid"); panInput.setAttribute("aria-invalid", "true"); }
    if (!expOk) { expiryInput.classList.add("invalid"); expiryInput.setAttribute("aria-invalid", "true"); }
    if (!cvcOk) { cvcInput.classList.add("invalid"); cvcInput.setAttribute("aria-invalid", "true"); }

    return { ok: panOk && expOk && cvcOk && nameOk, digits };
  }

  // ---------- submit / processing flow ----------
  let processing = false;
  let resultTimer = 0;
  let unlockTimer = 0;

  payForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (processing) return;

    const { ok, digits } = validate();
    if (!ok) {
      formMsg.textContent = "Check the highlighted fields.";
      payBtn.classList.remove("shake");
      void payBtn.offsetWidth;
      payBtn.classList.add("shake");
      return;
    }

    formMsg.textContent = "";
    processing = true;
    flip(false);

    // Freeze the form's laid-out width before the columns move: the
    // shrinking track then clips it (overflow: hidden in the
    // processing state) instead of re-wrapping every line of text on
    // every frame of the 0.5s collapse. That re-wrap was the main
    // desktop cost — mobile never ran it, staying single-column.
    clearTimeout(unlockTimer);
    checkout.classList.remove("is-expanding");
    payLock.style.width = payLock.offsetWidth + "px";

    checkout.classList.add("is-processing");
    checkout.classList.remove("is-approved", "is-declined");
    statusTitle.textContent = "Authorising with your bank";
    const last4 = digits.slice(-4);
    statusSub.textContent = "Visa •••• " + last4 + " · $1,248.00";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Measured off the slot, which is NEVER transformed: a rotated
        // card's rect is its bounding BOX, not its size.
        const from = cardSlot.getBoundingClientRect();
        const target = checkout.getBoundingClientRect();
        const grow = clamp((target.width * 0.44) / from.width, 1, 1.34);
        cardSlot.style.setProperty("--grow", grow.toFixed(3));
      });
    });

    resultTimer = setTimeout(() => {
      const declined = digits === "4000000000000002";
      if (declined) {
        checkout.classList.add("is-declined");
        statusTitle.textContent = "Payment declined";
        statusSub.textContent = "Your bank declined this card.";
        retryBtn.textContent = "Try again";
      } else {
        checkout.classList.add("is-approved");
        statusTitle.textContent = "Payment approved";
        statusSub.textContent = "Visa •••• " + last4 + " · $1,248.00";
        retryBtn.textContent = "Make another payment";
      }
      processing = false;
      // the form is hidden and the one actionable control just
      // appeared — hand keyboard focus to it instead of leaving
      // focus stranded on the now-invisible pay button
      retryBtn.focus({ preventScroll: true });
    }, 1700);
  });

  function resetFlow() {
    // Cancel any in-flight "result" so it can't fire on stale digits
    // after the user has already backed out — previously that left
    // `processing` stuck true (dead pay button) until the old timer
    // fired, then stamped an approve/decline from the old attempt.
    clearTimeout(resultTimer);
    processing = false;
    checkout.classList.remove("is-processing", "is-approved", "is-declined");
    cardSlot.style.setProperty("--grow", "1");
    // hold the width lock through the expand so the text doesn't
    // re-wrap mid-animation, keep it clipped meanwhile, then release
    clearTimeout(unlockTimer);
    checkout.classList.add("is-expanding");
    unlockTimer = setTimeout(() => {
      payLock.style.width = "";
      checkout.classList.remove("is-expanding");
    }, 550);
  }

  retryBtn.addEventListener("click", () => {
    resetFlow();
    cvcInput.focus();
  });

  // ---------- demo fill pills ----------
  document.querySelectorAll(".pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      resetFlow();
      panInput.value = formatPAN(btn.dataset.fill);
      renderPAN();
      cvcInput.focus();
    });
  });

  // ---------- init ----------
  renderPAN();
  renderName();
  renderExpiry();
  renderCvc();
})();
