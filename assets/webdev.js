/* ============================================================
   Precisa Solutions — discipline showcase runtime
   Drives every .wd-stage on the page (web development, software
   development, AI automations):
     · the active layout builds block by block on scroll-in
     · the layouts inside a stage rotate on a loop, pausing whenever
       the stage is off-screen or the tab is hidden
     · the frame tilts fractionally toward the pointer
   Each stage is independent: its own timer, its own dot row (the
   .wd-dots inside the same .wd-visual), its own hold time via
   data-hold.
   Everything is progressive: with this file absent the first layout
   of each stage renders finished and static, because the
   pre-animation states are scoped to .wd-js, which only this file adds.
   Styles: assets/enhance.css, "the layout showcase".
   ============================================================ */
(function () {
  'use strict';

  var stages = document.querySelectorAll('.wd-stage');
  if (!stages.length) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine    = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  Array.prototype.forEach.call(stages, function (stage) { setup(stage); });

  function setup(stage) {
    var visual  = stage.closest ? stage.closest('.wd-visual') : null;
    var dots    = (visual || stage.parentNode).querySelector('.wd-dots');
    var layouts = stage.querySelectorAll('.wd-lay');
    var HOLD    = parseInt(stage.getAttribute('data-hold'), 10) || 3100;

    /* ---- 1 · rotate the layouts ------------------------------------ */
    var index = 0;
    var timer = null;

    function show(i) {
      index = (i + layouts.length) % layouts.length;
      Array.prototype.forEach.call(layouts, function (lay, n) {
        lay.classList.toggle('on', n === index);
      });
      if (dots) {
        Array.prototype.forEach.call(dots.children, function (dot, n) {
          dot.classList.toggle('on', n === index);
        });
      }
      /* Restart the wireframe + scan pass for the incoming structure.
         The reflow between the two class writes is required: without it
         the browser coalesces them and no animation replays. Deferring to
         rAF instead would leave the frame blank for a couple of frames,
         which reads as a flicker — one forced layout per rotation is the
         cheaper trade. */
      stage.classList.remove('is-built');
      void stage.offsetWidth;
      stage.classList.add('is-built');
    }

    function run() {
      if (timer || reduced || layouts.length < 2) return;
      timer = setInterval(function () {
        if (document.hidden) return;               /* don't cycle unseen */
        show(index + 1);
      }, HOLD);
    }
    function halt() { clearInterval(timer); timer = null; }

    /* ---- 2 · start when the stage is reached ----------------------- */
    if (reduced) {
      stage.classList.add('is-built');
      return;
    }

    stage.classList.add('wd-js');                  /* arm the pre-states */

    var started = false;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (!started) {
              started = true;
              stage.classList.add('is-built');
            }
            run();
          } else {
            halt();                                /* pause while off-screen */
          }
        });
      }, { threshold: 0.3 });
      io.observe(stage);
    } else {
      stage.classList.add('is-built');
      run();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) halt();
      else if (started) run();
    });

    /* ---- 3 · pointer tilt (fine pointers only) --------------------- */
    if (!fine) return;

    var frameEl = stage.querySelector('.wd-browser');
    if (!frameEl) return;

    var rect = null, rafId = null, tiltX = 0, tiltY = 0, eased = true;

    function apply() {
      rafId = null;
      frameEl.style.transform =
        'perspective(1400px) rotateX(' + tiltX.toFixed(2) + 'deg) rotateY(' + tiltY.toFixed(2) + 'deg)';
    }
    function schedule() { if (rafId === null) rafId = requestAnimationFrame(apply); }

    /* the cached rect goes stale the moment the page scrolls under the
       pointer, which skews the tilt toward one corner */
    function forget() { rect = null; }
    window.addEventListener('scroll', forget, { passive: true });
    window.addEventListener('resize', forget, { passive: true });

    stage.addEventListener('pointerenter', function () {
      rect = stage.getBoundingClientRect();
      frameEl.style.transition = 'transform .5s cubic-bezier(0.22, 1, 0.36, 1)';
      eased = true;
    });
    stage.addEventListener('pointermove', function (e) {
      if (!rect) rect = stage.getBoundingClientRect();
      var dx = (e.clientX - rect.left) / rect.width  - .5;
      var dy = (e.clientY - rect.top)  / rect.height - .5;
      tiltY =  dx * 5.5;                           /* max ~2.75deg each way */
      tiltX = -dy * 4;
      if (eased) {                                 /* only once, not per move */
        frameEl.style.transition = '';             /* follow the pointer directly */
        eased = false;
      }
      schedule();
    }, { passive: true });
    stage.addEventListener('pointerleave', function () {
      rect = null;
      tiltX = tiltY = 0;
      frameEl.style.transition = 'transform .7s cubic-bezier(0.22, 1, 0.36, 1)';
      eased = true;
      schedule();
    });
  }
})();
