/* Precisa Solutions — OTP verification interaction concept.
   Extracted from an inline <script> so the page satisfies the site CSP
   (script-src 'self'); the behaviour is unchanged. */
(function () {
  const $ = (id) => document.getElementById(id);

  // Embedded on projects.html inside an iframe: the panel around it already
  // supplies a title and caption, so ?embed=1 hides the page furniture.
  if (/(^|[?&])embed=1(&|$)/.test(location.search)) {
    document.documentElement.classList.add("is-embed");
  }

  const card = $("card");
  const orbit = $("orbit");
  const hub = $("hub");
  const field = $("field");
  const seal = $("seal");
  const msg = $("msg");
  const toast = $("toast");
  const fillBtn = $("fill");
  const resendBtn = $("resend");
  const continueBtn = $("continue");

  const CODE = "4719";
  const LEN = CODE.length;
  const ORBIT_MS = 19000;   // one lazy revolution
  const RESEND_S = 24;

  // Same deal as the card page: Windows exposes its "Animation effects"
  // accessibility switch as prefers-reduced-motion, which would freeze the
  // orbit, the collapse and the verdict on any machine with it off. Flip
  // HONOR_REDUCED_MOTION to true to serve those machines the still version;
  // while false everyone gets the full choreography. Read live, never
  // frozen at load.
  const HONOR_REDUCED_MOTION = false;
  const reducedMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  const calm = () => HONOR_REDUCED_MOTION && reducedMotionMQ.matches;
  const syncCalm = () =>
    document.documentElement.classList.toggle("reduce-motion", calm());
  syncCalm();
  if (reducedMotionMQ.addEventListener) {
    reducedMotionMQ.addEventListener("change", syncCalm);
  }

  const WINDUP = "cubic-bezier(0.72, 0, 0.16, 1)";
  const state = () => card.dataset.state;
  const setState = (s) => { card.dataset.state = s; };

  // ---------- build the four slots ----------
  const slots = CODE.split("").map((digit, i) => {
    const wrap = document.createElement("label");
    wrap.className = "slot";

    const face = document.createElement("span");
    face.className = "slot__face";

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.maxLength = 1;
    input.setAttribute("aria-label", "Digit " + (i + 1) + " of " + LEN);
    // only the first carries it: the platform fills the rest from that one
    if (i === 0) input.autocomplete = "one-time-code";

    const ghost = document.createElement("span");
    ghost.className = "slot__ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.textContent = digit;

    // The acknowledgement stroke. pathLength normalises the perimeter to
    // 100 so the dash maths never has to know the tile's real size, which
    // changes at the breakpoints; rx matches the face's % radius exactly.
    const NS = "http://www.w3.org/2000/svg";
    const trace = document.createElementNS(NS, "svg");
    trace.setAttribute("class", "slot__trace");
    trace.setAttribute("viewBox", "0 0 100 100");
    trace.setAttribute("preserveAspectRatio", "none");
    trace.setAttribute("aria-hidden", "true");
    const ring = document.createElementNS(NS, "rect");
    ring.setAttribute("class", "slot__trace-path");
    ring.setAttribute("x", "1");
    ring.setAttribute("y", "1");
    ring.setAttribute("width", "98");
    ring.setAttribute("height", "98");
    ring.setAttribute("rx", "29");
    ring.setAttribute("pathLength", "100");
    ring.setAttribute("vector-effect", "non-scaling-stroke");
    trace.append(ring);

    face.append(trace, input, ghost);
    wrap.append(face);
    field.append(wrap);
    return { el: wrap, face, input, ghost, trace: ring };
  });

  // ---------- geometry ----------
  // Measured, never assumed: the slots sit in their natural row and every
  // orbit position is expressed as a transform away from it. That way
  // "collapsed" is just the identity transform, so the row is always exact.
  let geo = [];

  function measure() {
    // An inline style cannot out-rank a running animation, so anything still
    // playing has to be lifted off before the row can be measured at all -
    // measuring through a live orbit reads the ring back as the row, and
    // every angle computed from it is then wrong. Callers re-apply.
    stopOrbit();
    slots.forEach((s) => {
      s.el.getAnimations().forEach((a) => a.cancel());
      s.face.getAnimations().forEach((a) => a.cancel());
      s.input.getAnimations().forEach((a) => a.cancel());
      s.el.style.transform = "none";
      s.face.style.transform = "none";
    });

    const h = hub.getBoundingClientRect();
    const hx = h.left + h.width / 2;
    const hy = h.top + h.height / 2;
    const R = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue("--ring-r")) || 66;

    geo = slots.map((s, i) => {
      const r = s.el.getBoundingClientRect();
      // vector from the hub to where this slot naturally sits
      const vx = r.left + r.width / 2 - hx;
      const vy = r.top + r.height / 2 - hy;
      // reading the ring from the left, clockwise, spells the code
      const phi = ((180 + i * 90) * Math.PI) / 180;
      return {
        vx, vy,
        // the hub, in this slot's own coordinates - park the origin here
        // and a plain rotate() traces an exact circle
        ox: r.width / 2 - vx,
        oy: r.height / 2 - vy,
        dx: R * Math.cos(phi) - vx,
        dy: R * Math.sin(phi) - vy,
      };
    });

    slots.forEach((s) => {
      s.el.style.transform = "";
      s.face.style.transform = "";
    });
  }

  // ---------- the orbit ----------
  // Never sample a turn frame by frame: move the origin to the hub and two
  // keyframes of plain rotate() draw a perfect circle. The face counter-turns
  // by the same amount so the tiles stay upright the whole way round.
  //
  // The same turn serves twice - lazily at rest, and fast while the code is
  // being checked. Only the speed and the angle it starts from differ.
  let idle = [];
  let orbitDur = ORBIT_MS;
  let orbitFrom = 0;

  function startOrbit(dur, from) {
    stopOrbit();
    if (calm()) return;
    orbitDur = dur || ORBIT_MS;
    orbitFrom = from || 0;
    slots.forEach((s, i) => {
      const g = geo[i];
      const ride = " translate(" + g.dx + "px, " + g.dy + "px)";
      s.el.style.transformOrigin = g.ox + "px " + g.oy + "px";
      idle.push(s.el.animate([
        { transform: "rotate(" + orbitFrom + "deg)" + ride },
        { transform: "rotate(" + (orbitFrom + 360) + "deg)" + ride },
      ], { duration: orbitDur, easing: "linear", iterations: Infinity }));
      idle.push(s.face.animate([
        { transform: "rotate(" + -orbitFrom + "deg)" },
        { transform: "rotate(" + -(orbitFrom + 360) + "deg)" },
      ], { duration: orbitDur, easing: "linear", iterations: Infinity }));
    });
  }

  // where the ring has got to right now
  function angleNow() {
    if (!idle.length) return orbitFrom;
    return orbitFrom + (360 * ((idle[0].currentTime || 0) % orbitDur)) / orbitDur;
  }

  function stopOrbit() {
    idle.forEach((a) => a.cancel());
    idle = [];
  }

  function parkOnRing() {
    // the still version of the orbit, for measure-time and calm mode
    slots.forEach((s, i) => {
      const g = geo[i];
      s.el.style.transformOrigin = g.ox + "px " + g.oy + "px";
      s.el.style.transform = "translate(" + g.dx + "px, " + g.dy + "px)";
      s.face.style.transform = "none";
    });
  }

  function clearTransforms() {
    slots.forEach((s) => {
      s.el.style.transform = "";
      s.el.style.transformOrigin = "";
      s.face.style.transform = "";
    });
  }

  // ---------- orbit -> row ----------
  let collapsing = false;

  function collapse(seed) {
    if (state() !== "orbit" || collapsing) return;
    if (!geo.length) measure();
    collapsing = true;
    const flight = [];

    const land = () => {
      // whatever else has been started meanwhile, the row is the truth now
      stopOrbit();
      flight.forEach((a) => a.cancel());
      collapsing = false;
      clearTransforms();
      setState("entry");
      slots[0].input.focus();
      if (seed) accept(0, seed);
      armToast();
    };

    if (calm()) { stopOrbit(); land(); return; }

    const theta = angleNow();
    stopOrbit();

    // The landing rotation has to be a whole number of turns or the slots
    // come to rest somewhere along the ring instead of in the row. So we
    // finish the turn we are in and add one more, which also buys the
    // wind-up its runway.
    const sweep = 360 - (theta % 360) + 360;
    const dur = 520 + sweep * 0.62;

    slots.forEach((s, i) => {
      const g = geo[i];
      s.el.style.transformOrigin = g.ox + "px " + g.oy + "px";
      flight.push(s.el.animate([
        { transform: "rotate(" + theta + "deg) translate(" + g.dx + "px, " + g.dy + "px)" },
        { transform: "rotate(" + (theta + sweep) + "deg) translate(0px, 0px)" },
      ], { duration: dur, easing: WINDUP, fill: "forwards" }));
      flight.push(s.face.animate([
        { transform: "rotate(" + -theta + "deg)" },
        { transform: "rotate(" + -(theta + sweep) + "deg)" },
      ], { duration: dur, easing: WINDUP, fill: "forwards" }));
    });

    setTimeout(land, dur);
  }

  // ---------- entering the code ----------
  const digitsOnly = (s) => s.replace(/\D/g, "");
  const value = () => slots.map((s) => s.input.value).join("");

  function paint() {
    slots.forEach((s) => s.el.classList.toggle("is-filled", s.input.value !== ""));
  }

  // One digit landing in one box. The box acknowledges it by drawing a line
  // right around itself - every entry path goes through here so the receipt
  // is the same whether you typed it, pasted it, or let the message fill it.
  const TRACE_MS = 560;

  function place(i, ch, delay) {
    slots[i].input.value = ch;
    paint();
    if (calm()) return;
    const t = slots[i].trace;
    t.getAnimations().forEach((a) => a.cancel());
    t.animate([
      { strokeDashoffset: "100", opacity: 1 },
      { strokeDashoffset: "0", opacity: 1, offset: 0.62 },
      { strokeDashoffset: "0", opacity: 0 },
    ], { duration: TRACE_MS, delay: delay || 0, easing: "cubic-bezier(0.4, 0, 0.2, 1)" });
  }

  function accept(i, ch) {
    place(i, ch);
    if (i + 1 < LEN) slots[i + 1].input.focus();
    else slots[i].input.blur();
    maybeVerify();
  }

  function clearAll(focusFirst) {
    slots.forEach((s) => { s.input.value = ""; });
    paint();
    if (focusFirst) slots[0].input.focus();
  }

  function spread(text, from) {
    const d = digitsOnly(text);
    if (!d) return;
    for (let k = 0; k < d.length && from + k < LEN; k++) {
      // staggered, so a paste reads as four digits arriving, not one blink
      place(from + k, d[k], k * 70);
    }
    paint();
    const next = Math.min(from + d.length, LEN - 1);
    slots[next].input.focus();
    maybeVerify();
  }

  slots.forEach((s, i) => {
    s.input.addEventListener("focus", () => {
      s.face.classList.add("is-focus");
      s.input.select();
    });
    s.input.addEventListener("blur", () => s.face.classList.remove("is-focus"));

    s.input.addEventListener("input", () => {
      hideMsg();
      const d = digitsOnly(s.input.value);
      if (!d) { s.input.value = ""; paint(); return; }
      // a platform autofill can drop the whole code into one box
      if (d.length > 1) { spread(d, i); return; }
      accept(i, d);
    });

    s.input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace") {
        if (s.input.value === "" && i > 0) {
          e.preventDefault();
          slots[i - 1].input.value = "";
          slots[i - 1].input.focus();
          paint();
        }
        hideMsg();
        return;
      }
      if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); slots[i - 1].input.focus(); }
      if (e.key === "ArrowRight" && i + 1 < LEN) { e.preventDefault(); slots[i + 1].input.focus(); }
    });

    s.input.addEventListener("paste", (e) => {
      e.preventDefault();
      spread((e.clipboardData || window.clipboardData).getData("text"), i);
    });
  });

  // ---------- verdict ----------
  function showMsg(text) { msg.textContent = text; msg.classList.add("show"); }
  function hideMsg() {
    msg.classList.remove("show");
    if (state() === "error") setState("entry");
  }

  function maybeVerify() {
    if (value().length !== LEN) return;
    hideMsg();
    verify();
  }

  // The check reads as three beats: the four you typed are thrown back onto
  // the ring, they spin there while the code is checked, then they either
  // wind into the hub and become the tick, or fly back to the row rejected.
  const LAUNCH_MS = 520;
  const LAUNCH_DEG = 200;
  const SPIN_MS = 1150;    // one revolution while spinning
  const SPIN_HOLD = 820;
  const MERGE_MS = 640;
  const MERGE_SCALE = 0.92; // lands exactly on the seal tile behind it
  const MERGE_DEG = 420;
  const RECALL_SPEED = 0.9; // deg per ms on the way back to the row

  // A spin stalls at its seams. An ease-in-out lands at zero speed and the
  // next animation starts from zero again, so the ring visibly stops dead
  // twice on the way through. These build the easing so its slope AT THE
  // SEAM equals the cruise speed - that is what makes the handover vanish.
  const CRUISE = 360 / SPIN_MS; // degrees per ms while spinning
  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  // slope at t=1 is (1 - y2) / (1 - x2): solve for the y2 that cruises out
  function easeIntoCruise(sweep, dur, x1, x2) {
    const y2 = clamp01(1 - ((CRUISE * dur) / sweep) * (1 - x2));
    return "cubic-bezier(" + x1 + ", 0, " + x2 + ", " + y2.toFixed(4) + ")";
  }

  // slope at t=0 is y1 / x1: solve for the y1 that picks up at cruise speed
  function easeOutOfCruise(sweep, dur, x1, x2) {
    const y1 = clamp01(((CRUISE * dur) / sweep) * x1);
    return "cubic-bezier(" + x1 + ", " + y1.toFixed(4) + ", " + x2 + ", 1)";
  }

  const LAUNCH_EASE = easeIntoCruise(LAUNCH_DEG, LAUNCH_MS, 0.35, 0.4);
  const MERGE_EASE = easeOutOfCruise(MERGE_DEG, MERGE_MS, 0.35, 0.3);

  function verify() {
    setState("verify");
    hideToast();
    // let go of the caret - a focus ring on a tile that is about to leave
    // the row reads as an input still waiting for you
    slots.forEach((s) => s.input.blur());

    const ok = value() === CODE;

    if (calm()) {
      setTimeout(() => (ok ? land() : reject()), 300);
      return;
    }

    // beat one: back out onto the ring, picking up the spin on the way
    slots.forEach((s, i) => {
      const g = geo[i];
      s.el.style.transformOrigin = g.ox + "px " + g.oy + "px";
      s.el.animate([
        { transform: "rotate(0deg) translate(0px, 0px)" },
        { transform: "rotate(" + LAUNCH_DEG + "deg) translate(" + g.dx + "px, " + g.dy + "px)" },
      ], { duration: LAUNCH_MS, easing: LAUNCH_EASE, fill: "forwards" });
      s.face.animate([
        { transform: "rotate(0deg)" },
        { transform: "rotate(" + -LAUNCH_DEG + "deg)" },
      ], { duration: LAUNCH_MS, easing: LAUNCH_EASE, fill: "forwards" });
    });

    // beat two: cruise. Handing over at the angle the launch ended on keeps
    // the seam invisible.
    setTimeout(() => {
      if (state() !== "verify") return;
      startOrbit(SPIN_MS, LAUNCH_DEG);
    }, LAUNCH_MS);

    // beat three: the verdict
    setTimeout(() => {
      if (state() !== "verify") return;
      if (ok) merge(); else recall();
    }, LAUNCH_MS + SPIN_HOLD);
  }

  // The four wind into the hub and fade out over the seal that is fading in
  // behind them, so the numbers do not vanish and get replaced - they turn
  // into the tick.
  function merge() {
    const theta = angleNow();
    stopOrbit();
    card.dataset.phase = "merge";

    const sweep = MERGE_DEG;
    const s2 = MERGE_SCALE;

    slots.forEach((s, i) => {
      const g = geo[i];
      // land the centre exactly on the hub: with the origin parked there,
      // the offset that cancels the slot's own vector is -scale * v
      const home = "translate(" + -s2 * g.vx + "px, " + -s2 * g.vy + "px) scale(" + s2 + ")";
      s.el.style.transformOrigin = g.ox + "px " + g.oy + "px";
      s.el.animate([
        { transform: "rotate(" + theta + "deg) translate(" + g.dx + "px, " + g.dy + "px) scale(1)" },
        { transform: "rotate(" + (theta + sweep) + "deg) " + home },
      ], { duration: MERGE_MS, easing: MERGE_EASE, fill: "forwards" });

      // identical easing on the counter-turn, so the tile is upright at
      // every frame of the way in and not just at the ends
      s.face.animate([
        { transform: "rotate(" + -theta + "deg)" },
        { transform: "rotate(" + -(theta + sweep) + "deg)" },
      ], { duration: MERGE_MS, easing: MERGE_EASE, fill: "forwards" });

      // the digits go first, on the way in - four of them stacked on one
      // point is a smudge, not a merge. The tiles themselves fade last,
      // uncovering the seal that has been coming up behind them.
      s.input.animate([
        { opacity: 1 },
        { opacity: 0 },
      ], { duration: MERGE_MS * 0.55, easing: "ease-in", fill: "forwards" });

      s.face.animate([
        { opacity: 1 },
        { opacity: 0 },
      ], { duration: MERGE_MS * 0.45, delay: MERGE_MS * 0.55, easing: "ease-in", fill: "forwards" });
    });

    setTimeout(land, MERGE_MS);
  }

  // rejected: no merge, they just fly back to the row and own up
  function recall() {
    const theta = angleNow();
    stopOrbit();

    // Finish the turn and add one more, so it lands square in the row; the
    // duration follows the sweep, which keeps the pick-up speed constant
    // however far round the ring the spin happened to stop.
    const sweep = 360 - (theta % 360) + 360;
    const dur = sweep / RECALL_SPEED;
    const ease = easeOutOfCruise(sweep, dur, 0.35, 0.3);

    slots.forEach((s, i) => {
      const g = geo[i];
      s.el.style.transformOrigin = g.ox + "px " + g.oy + "px";
      s.el.animate([
        { transform: "rotate(" + theta + "deg) translate(" + g.dx + "px, " + g.dy + "px)" },
        { transform: "rotate(" + (theta + sweep) + "deg) translate(0px, 0px)" },
      ], { duration: dur, easing: ease, fill: "forwards" });
      s.face.animate([
        { transform: "rotate(" + -theta + "deg)" },
        { transform: "rotate(" + -(theta + sweep) + "deg)" },
      ], { duration: dur, easing: ease, fill: "forwards" });
    });

    setTimeout(reject, dur);
  }

  function land() {
    setState("done");
    delete card.dataset.phase;
    document.body.classList.add("is-done");
    setTimeout(() => continueBtn.focus(), 700);
  }

  function reject() {
    slots.forEach((s) => {
      s.el.getAnimations().forEach((a) => a.cancel());
      s.face.getAnimations().forEach((a) => a.cancel());
      s.input.getAnimations().forEach((a) => a.cancel());
      s.el.style.transform = "";
      s.el.style.transformOrigin = "";
      s.face.style.transform = "";
    });
    setState("error");
    showMsg("That code doesn't match. Try again.");
    clearAll(true);
  }

  // ---------- the message ----------
  let toastTimer = 0;

  function armToast() {
    clearTimeout(toastTimer);
    // a beat after you start, the way a real SMS lands mid-typing
    toastTimer = setTimeout(() => {
      if (state() === "entry" && value() !== CODE) toast.classList.add("show");
    }, 2600);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    toast.classList.remove("show");
  }

  fillBtn.addEventListener("click", () => {
    hideToast();
    clearAll(false);
    // typed in, not pasted - the fill should look like the phone doing it
    CODE.split("").forEach((d, i) => {
      setTimeout(() => {
        place(i, d);
        if (i === LEN - 1) maybeVerify();
        else slots[i + 1].input.focus();
      }, calm() ? 0 : i * 95);
    });
  });

  // ---------- resend ----------
  let left = RESEND_S;
  let tick = 0;

  function runCountdown() {
    clearInterval(tick);
    left = RESEND_S;
    resendBtn.disabled = true;
    resendBtn.textContent = "Resend in " + left + "s";
    tick = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(tick);
        resendBtn.disabled = false;
        resendBtn.textContent = "Resend";
        return;
      }
      resendBtn.textContent = "Resend in " + left + "s";
    }, 1000);
  }

  resendBtn.addEventListener("click", () => {
    if (resendBtn.disabled) return;
    runCountdown();
    clearAll(true);
    hideMsg();
    armToast();
  });

  // ---------- what wakes the ring up ----------
  orbit.addEventListener("pointerdown", () => collapse());

  document.addEventListener("focusin", (e) => {
    if (state() === "orbit" && field.contains(e.target)) collapse();
  });

  // start typing anywhere and the first keystroke is not thrown away
  document.addEventListener("keydown", (e) => {
    if (state() !== "orbit") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^\d$/.test(e.key)) { e.preventDefault(); collapse(e.key); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); collapse(); }
  });

  continueBtn.addEventListener("click", () => {
    // a concept page, so the verdict hands the ring back rather than dead-ends
    document.body.classList.remove("is-done");
    clearAll(false);
    slots.forEach((s) => {
      s.el.getAnimations().forEach((a) => a.cancel());
      s.face.getAnimations().forEach((a) => a.cancel());
      s.input.getAnimations().forEach((a) => a.cancel());
    });
    hideMsg();
    hideToast();
    setState("orbit");
    measure();
    parkOnRing();
    startOrbit();
    runCountdown();
  });

  // ---------- the platform, if it wants to help ----------
  if ("OTPCredential" in window && navigator.credentials) {
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: new AbortController().signal })
      .then((otp) => { if (otp && otp.code) { collapse(); spread(otp.code, 0); } })
      .catch(() => {});
  }

  // ---------- the sparks ----------
  (function seedSparks() {
    const N = 16;
    for (let i = 0; i < N; i++) {
      const dot = document.createElement("span");
      dot.className = "spark";
      // spread around the dial with a little jitter so it never looks stamped
      const a = (360 / N) * i + (Math.random() * 14 - 7);
      dot.style.setProperty("--a", a.toFixed(1) + "deg");
      dot.style.setProperty("--d", (78 + Math.random() * 46).toFixed(0) + "px");
      dot.style.setProperty("--sd", (Math.random() * 0.34).toFixed(2) + "s");
      const size = (3 + Math.random() * 3).toFixed(1) + "px";
      dot.style.width = size;
      dot.style.height = size;
      seal.append(dot);
    }
  })();

  // ---------- go ----------
  // Measured immediately rather than behind the font promise: a click that
  // beats the fonts would otherwise collapse a ring with no geometry. The
  // fonts only change the tile metrics, so re-measuring after them is enough.
  function remeasure() {
    // Any time the tiles are in flight, re-measuring would cancel the
    // choreography out from under them and leave them wherever it stopped -
    // and mid-collapse it would restart the orbit they are trying to leave,
    // so they would never reach the row at all.
    if (state() === "verify" || state() === "done" || collapsing) return;
    if (state() !== "orbit") { measure(); return; }
    const at = idle.length ? (idle[0].currentTime || 0) % orbitDur : 0;
    measure();
    parkOnRing();
    startOrbit(orbitDur, orbitFrom);
    idle.forEach((a) => { a.currentTime = at; });
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(remeasure, 140);
  });

  measure();
  parkOnRing();
  startOrbit();
  runCountdown();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(remeasure);
  }
})();
