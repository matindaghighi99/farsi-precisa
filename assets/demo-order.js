/* Precisa Solutions — "depot van" order button interaction concept.
   Extracted from an inline <script> so the page satisfies the site CSP
   (script-src 'self'); the behaviour is unchanged. */

// Embedded on projects.html inside an iframe — ?embed=1 tightens the frame.
if (/(^|[?&])embed=1(&|$)/.test(location.search)) {
  document.documentElement.classList.add("is-embed");
}

// ---------------- order section ----------------
const UNIT_PRICE = 24;
const MAX_QTY = 9;

const orderForm = document.getElementById("orderForm");
const qtyValue = document.getElementById("qtyValue");
const qtyUp = document.getElementById("qtyUp");
const qtyDown = document.getElementById("qtyDown");
const subtotalEl = document.getElementById("subtotal");
const totalEl = document.getElementById("total");
const message = document.getElementById("message");

let qty = 1;

const money = (n) => "$" + n.toFixed(2);

function renderOrder() {
  qtyValue.textContent = qty;
  subtotalEl.textContent = money(qty * UNIT_PRICE);
  totalEl.textContent = money(qty * UNIT_PRICE); // delivery is free
  qtyDown.disabled = qty <= 1;
  qtyUp.disabled = qty >= MAX_QTY;
}

qtyDown.addEventListener("click", () => {
  if (qty > 1) { qty--; renderOrder(); }
});

qtyUp.addEventListener("click", () => {
  if (qty < MAX_QTY) { qty++; renderOrder(); }
});

orderForm.addEventListener("submit", function (e) {
  e.preventDefault();
  message.textContent = "";
  Depot.play();
});

renderOrder();

// ================= premium "depot van" button =================
// One rAF timeline drives every part, so the van, its wheels, its
// suspension and its cargo can never drift out of sync.
const Depot = (function () {
  const label = document.getElementById("ctaLabel");
  const text = document.getElementById("ctaText");
  const btn = document.getElementById("orderBtn");
  const ground = document.getElementById("ground");
  const van = document.getElementById("van");
  const body = document.getElementById("vanBody");
  const door = document.getElementById("door");
  const lights = document.getElementById("lights");
  const box = document.getElementById("box");
  const boxHome = document.getElementById("boxHome");
  const boxSlotFly = document.getElementById("boxSlotFly");
  const boxSlotBay = document.getElementById("boxSlotBay");
  const boxShadow = document.getElementById("boxShadow");
  const wheels = [
    document.getElementById("wheelA"),
    document.getElementById("wheelB"),
  ];
  const scene = document.querySelector(".cta__scene");

  // --- geometry (SVG user units) ---
  const VX_START = -150;  // van fully clear of the left edge
  const VX_STOP = 94;     // parked, cargo door facing the parcel
  const VX_END = 380;     // fully clear of the right edge
  const GY_HIDE = 32;     // road + parcel parked below the frame
  const DOOR_H = 36;      // full travel of the roll-up door

  const WHEEL_R = 9.5;
  const DEG_PER_UNIT = 180 / (Math.PI * WHEEL_R); // rolls, never slides

  const BOX_ROAD = { x: 144, y: 77 };  // on the road, van-local
  const BOX_APEX = { x: 62, y: 6 };    // top of the leap, above the bay
  const BOX_BAY = { x: 62, y: 50 };    // settled inside the cargo bay
  const HOP_SPLIT = 0.62;              // leap ends / drop begins

  // --- score (ms from the press) ---
  const GROUND_UP = [0, 400];
  const DRIVE_IN = [380, 1020];
  const DOOR_OPEN = [1520, 340];
  const HOP = [1900, 560];
  const DOOR_SHUT = [2600, 340];
  const LIGHTS = [3000, 260];
  const DRIVE_OUT = [3160, 940];
  const GROUND_DOWN = [4100, 380];
  const DONE_AT = 4160;
  const RESET_AT = 5700;

  // The OS-level "reduce motion" accessibility flag (Windows:
  // Settings → Accessibility → Visual effects → Animation effects;
  // iOS: Reduce Motion). Flip HONOR_REDUCED_MOTION to true to give
  // machines with that switch off the static cross-fade instead of
  // the drive-in; while false, everyone gets the full animation.
  const HONOR_REDUCED_MOTION = false;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Newton-Raphson cubic-bezier solver, so these curves read exactly like
  // their CSS equivalents.
  function bezier(x1, y1, x2, y2) {
    const A = (a, b) => 1 - 3 * b + 3 * a;
    const B = (a, b) => 3 * b - 6 * a;
    const C = (a) => 3 * a;
    const at = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const dx = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) {
        const d = dx(t, x1, x2);
        if (Math.abs(d) < 1e-6) break;
        t -= (at(t, x1, x2) - x) / d;
      }
      return at(t, y1, y2);
    };
  }

  const easeSlideUp = bezier(0.16, 1, 0.3, 1);
  const easeSlideDown = bezier(0.7, 0, 0.84, 0);
  const easeArrive = bezier(0.08, 0.62, 0.16, 1);  // enters fast, brakes long
  const easeDepart = bezier(0.55, 0, 0.86, 0.4);   // leans in, then pulls away
  const easeDoorUp = bezier(0.2, 0.9, 0.25, 1);
  const easeDoorDown = bezier(0.55, 0, 0.35, 1);
  const easeLamp = bezier(0.3, 0, 0.2, 1);

  const outQuad = (p) => 1 - (1 - p) * (1 - p);
  const outQuint = (p) => 1 - Math.pow(1 - p, 5);
  const inQuad = (p) => p * p;

  function seg(t, span, from, to, ease) {
    const p = (t - span[0]) / span[1];
    if (p <= 0) return from;
    if (p >= 1) return to;
    return from + (to - from) * ease(p);
  }

  // Sampled straight off the timeline rather than off the previous frame,
  // so frame jitter can never surface as suspension wobble.
  function vxAt(t) {
    if (t >= DRIVE_OUT[0]) return seg(t, DRIVE_OUT, VX_STOP, VX_END, easeDepart);
    return seg(t, DRIVE_IN, VX_START, VX_STOP, easeArrive);
  }

  function gyAt(t) {
    if (t >= GROUND_DOWN[0]) return seg(t, GROUND_DOWN, 0, GY_HIDE, easeSlideDown);
    return seg(t, GROUND_UP, GY_HIDE, 0, easeSlideUp);
  }

  function doorAt(t) {
    if (t >= DOOR_SHUT[0]) return seg(t, DOOR_SHUT, -DOOR_H, 0, easeDoorDown);
    return seg(t, DOOR_OPEN, 0, -DOOR_H, easeDoorUp);
  }

  // Leap, then drop. Both halves reach zero velocity at the apex, so the
  // two curves meet without a kink.
  function hopAt(p) {
    if (p <= HOP_SPLIT) {
      const a = p / HOP_SPLIT;
      return {
        x: BOX_ROAD.x + (BOX_APEX.x - BOX_ROAD.x) * outQuad(a),
        y: BOX_ROAD.y + (BOX_APEX.y - BOX_ROAD.y) * outQuint(a),
      };
    }
    const b = (p - HOP_SPLIT) / (1 - HOP_SPLIT);
    return {
      x: BOX_APEX.x,
      y: BOX_APEX.y + (BOX_BAY.y - BOX_APEX.y) * inQuad(b),
    };
  }

  let raf = 0;
  let t0 = 0;
  let playing = false;
  let aboard = false;
  let landedAt = -1;
  let slammed = false;
  let pitch = 0, pitchV = 0, dip = 0, dipV = 0;
  let stepsDone = 0; // fixed-timestep counter for the springs

  function setBox(x, y, rot, sx, sy) {
    box.setAttribute(
      "transform",
      `translate(${x} ${y}) rotate(${rot}) scale(${sx} ${sy})`
    );
  }

  function idle() {
    cancelAnimationFrame(raf);
    playing = false;
    aboard = false;
    slammed = false;
    landedAt = -1;
    pitch = pitchV = dip = dipV = 0;
    stepsDone = 0;

    if (box.parentNode !== boxHome) boxHome.appendChild(box);
    setBox(VX_STOP + BOX_ROAD.x, BOX_ROAD.y, 0, 1, 1);
    boxShadow.style.opacity = "1";
    scene.style.opacity = "";

    ground.setAttribute("transform", `translate(0 ${GY_HIDE})`);
    boxHome.setAttribute("transform", `translate(0 ${GY_HIDE})`);
    van.setAttribute("transform", `translate(${VX_START} 0)`);
    body.setAttribute("transform", "translate(0 0) rotate(0)");
    door.setAttribute("transform", "translate(0 0)");
    lights.setAttribute("opacity", "0");
    wheels.forEach((w) => w.setAttribute("transform", "rotate(0)"));

    text.textContent = "Order Now";
    label.dataset.state = "idle";
  }

  function frame(now) {
    const t = now - t0;

    // --- road deck, and the parcel riding on it ---
    const gy = gyAt(t).toFixed(3);
    ground.setAttribute("transform", `translate(0 ${gy})`);
    if (!aboard) boxHome.setAttribute("transform", `translate(0 ${gy})`);

    // --- van, with wheels rolled from that exact position ---
    const vx = vxAt(t);
    van.setAttribute("transform", `translate(${vx.toFixed(3)} 0)`);
    const spin = (vx * DEG_PER_UNIT).toFixed(3);
    wheels.forEach((w) => w.setAttribute("transform", `rotate(${spin})`));

    // --- roll-up cargo door ---
    const dy = doorAt(t);
    door.setAttribute("transform", `translate(0 ${dy.toFixed(3)})`);
    if (!slammed && t >= DOOR_SHUT[0] + DOOR_SHUT[1]) {
      slammed = true;
      dipV += 0.4; // the door lands
    }

    // --- headlights ---
    lights.setAttribute("opacity", seg(t, LIGHTS, 0, 1, easeLamp).toFixed(3));

    // --- suspension: pitch comes off the timeline's 2nd derivative, so
    //     braking dips the nose and pulling away lifts it, for free.
    //     The springs integrate at a fixed 60 Hz timestep: the damping
    //     constants were tuned per-step, so stepping once per rendered
    //     frame made a 144 Hz monitor 2.4x stiffer than a 60 Hz one and
    //     turned the wobble nervous. ---
    const h = 16;
    const accel = (vxAt(t + h) - 2 * vx + vxAt(t - h)) / (h * h);
    const target = Math.max(-3, Math.min(3, -accel * 2600));
    const STEP = 1000 / 60;
    let due = Math.floor(t / STEP) - stepsDone;
    if (due > 4) { stepsDone += due - 4; due = 4; } // drop debt after a hitch
    while (due-- > 0) {
      stepsDone++;
      pitchV += (target - pitch) * 0.14 - pitchV * 0.3;
      pitch += pitchV;
      dipV += (0 - dip) * 0.16 - dipV * 0.26;
      dip += dipV;
    }
    body.setAttribute(
      "transform",
      `translate(0 ${dip.toFixed(3)}) rotate(${pitch.toFixed(3)})`
    );

    // --- the parcel leaps in while the van stands still ---
    const hp = (t - HOP[0]) / HOP[1];
    if (hp > 0 && !aboard) {
      aboard = true;
      boxSlotFly.appendChild(box); // hand it from the road to the van
      boxShadow.style.opacity = "0";
    }
    if (aboard && hp < 1) {
      const p = Math.max(0, hp);
      const at = hopAt(p);
      setBox(at.x, at.y, -20 * Math.sin(p * Math.PI), 1, 1);
    } else if (aboard && landedAt < 0) {
      landedAt = t;
      dipV += 0.8; // the van takes the weight
      // Now fully inside the bay, where both slots render identically —
      // so this drop behind the door is invisible, and the door can
      // close over the parcel.
      boxSlotBay.appendChild(box);
    }
    if (landedAt >= 0) {
      const k = Math.exp(-(t - landedAt) / 90) * Math.cos((t - landedAt) / 38);
      setBox(BOX_BAY.x, BOX_BAY.y, 0, 1 + 0.16 * k, 1 - 0.16 * k);
    }

    if (t >= DONE_AT && label.dataset.state !== "done") {
      text.textContent = "Order Completed";
      label.dataset.state = "done";
    }

    if (t < RESET_AT) {
      raf = requestAnimationFrame(frame);
    } else {
      label.dataset.state = "run";
      setTimeout(idle, 340);
    }
  }

  // ---- reduced-motion fallback ----
  // Reduced motion means "no travel", not "no feedback": skipping
  // straight to the label made the button look broken on machines
  // with the OS switch off. Instead the scene cross-fades in already
  // delivered — van parked, door shut, lamps lit — holds, and fades
  // back out. Opacity fades are the accepted stand-in for motion.
  function fadeScene(from, to, dur) {
    const start = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - start) / dur);
      scene.style.opacity = (from + (to - from) * easeLamp(p)).toFixed(3);
      if (p < 1 && playing) raf = requestAnimationFrame(step);
    })(start);
  }

  function calmPlay() {
    idle();
    playing = true;
    label.dataset.state = "run";

    // Compose the delivered pose directly.
    ground.setAttribute("transform", "translate(0 0)");
    boxHome.setAttribute("transform", "translate(0 0)");
    van.setAttribute("transform", `translate(${VX_STOP} 0)`);
    wheels.forEach((w) =>
      w.setAttribute("transform", `rotate(${(VX_STOP * DEG_PER_UNIT).toFixed(3)})`)
    );
    lights.setAttribute("opacity", "1");
    boxShadow.style.opacity = "0";
    boxSlotBay.appendChild(box);
    setBox(BOX_BAY.x, BOX_BAY.y, 0, 1, 1);

    fadeScene(0, 1, 280);
    setTimeout(() => {
      text.textContent = "Order Completed";
      label.dataset.state = "done";
    }, 620);
    setTimeout(() => fadeScene(1, 0, 280), 2300);
    setTimeout(idle, 2650);
  }

  function play() {
    if (playing) return;

    if (HONOR_REDUCED_MOTION && reducedMotion.matches) {
      calmPlay();
      return;
    }

    idle();
    playing = true;
    label.dataset.state = "run";
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }

  idle();
  return { play };
})();
