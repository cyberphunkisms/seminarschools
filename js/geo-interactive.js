// ============================================================================
// GEO-INTERACTIVE — bouncy interactive zoom for the unified gasket field.
// One substrate (js/mandala.js Apollonian gaskets + Indra's Net), driven by a
// critically underdamped spring so every zoom overshoots and settles. Scroll
// springs the zoom and spin. Drag throws and pans with elastic edges. Pinch
// and Cmd/Ctrl+wheel push zoom directly. Hue walks the spectrum with depth.
//
// Mount: page must contain  <div id="geo"><div id="geoStage"></div></div>.
// Its presence makes js/indra.js stand down (it yields to any #geo owner).
// Safe under prefers-reduced-motion: renders the field static, no engine.
// ============================================================================
(function () {
  'use strict';

  var geo = document.getElementById('geo');
  var stage = document.getElementById('geoStage');
  if (!geo || !stage || !window.PolymythMandala || !window.PolymythMandala.build) return;

  var PHI = 1.6180339887;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile = window.innerWidth < 768;

  // Three gaskets at golden-ratio scales. Prominent enough to read on white,
  // light enough that the cards stay legible over it.
  function buildOpts() {
    return {
      gaskets: [
        { rot: 0,              scale: 1,            op: 0.78 },
        { rot: Math.PI * 0.42, scale: 1 / PHI,      op: 0.6 },
        { rot: Math.PI * 0.78, scale: 1 / (PHI * PHI), op: 0.46 }
      ],
      flowers: !mobile,
      jewels: true,
      maxDepth: mobile ? 5 : 7,
      minRadius: mobile ? 2.0 : 0.6,
      spiral: true
    };
  }

  function render() { stage.innerHTML = window.PolymythMandala.build(buildOpts()); }
  render();

  // Spectrum the hue walks as the field zooms. currentColor flows into every
  // stroke and jewel core, so a single color value recolors the whole field.
  var SPECTRUM = [
    [0xD7, 0x26, 0x3D], [0xE8, 0x59, 0x0C], [0xE6, 0xB8, 0x1E],
    [0x2B, 0x93, 0x48], [0x10, 0x98, 0xAD], [0x18, 0x64, 0xAB], [0x70, 0x48, 0xE8]
  ];
  function hueAt(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var seg = t * (SPECTRUM.length - 1);
    var i = Math.floor(seg), f = seg - i;
    var a = SPECTRUM[i], b = SPECTRUM[Math.min(i + 1, SPECTRUM.length - 1)];
    var r = Math.round(a[0] + (b[0] - a[0]) * f);
    var g = Math.round(a[1] + (b[1] - a[1]) * f);
    var bl = Math.round(a[2] + (b[2] - a[2]) * f);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  if (reduced) { stage.style.color = hueAt(0.2); return; }

  // ---- spring state --------------------------------------------------------
  // pos = current, tar = target, vel = velocity. Low damping leaves overshoot.
  var S = {
    scale: 1.0, scaleTar: 1.0, scaleVel: 0,
    rot: 0,     rotTar: 0,     rotVel: 0,
    px: 0,      pxTar: 0,      pxVel: 0,
    py: 0,      pyTar: 0,      pyVel: 0
  };

  // user-driven zoom multiplier (pinch, modifier-wheel, double-tap pulse),
  // multiplied onto the scroll-driven base so both inputs combine cleanly.
  var userZoom = 1.0;
  var ZOOM_MIN = 0.55, ZOOM_MAX = 3.4;     // hard elastic bounds
  var PAN_LIMIT = 520;                       // px before the edge pulls back

  var BASE = 1.0, RANGE = mobile ? 0.9 : 1.45; // scroll maps base..base+range

  // ---- scroll drive --------------------------------------------------------
  function scrollProgress() {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    return Math.min(1, y / max);
  }

  // ---- input: drag to pan and throw ---------------------------------------
  var interactive = 'a,button,input,textarea,select,label,summary,[role="button"]';
  var dragging = false, lastX = 0, lastY = 0, moved = 0;

  function isInteractive(el) {
    while (el && el !== document.body) {
      if (el.matches && el.matches(interactive)) return true;
      el = el.parentNode;
    }
    return false;
  }

  // two-pointer pinch tracking
  var pointers = {}, pinchStart = 0, pinchZoom0 = 1;

  function pinchDist() {
    var ks = Object.keys(pointers);
    if (ks.length < 2) return 0;
    var a = pointers[ks[0]], b = pointers[ks[1]];
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  window.addEventListener('pointerdown', function (e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(pointers).length === 2) {
      pinchStart = pinchDist(); pinchZoom0 = userZoom; dragging = false; return;
    }
    if (e.pointerType === 'touch') return;     // single-finger touch stays page scroll
    if (isInteractive(e.target)) return;       // links and buttons stay clickable
    dragging = true; lastX = e.clientX; lastY = e.clientY; moved = 0;
  }, { passive: true });

  window.addEventListener('pointermove', function (e) {
    if (pointers[e.pointerId]) { pointers[e.pointerId].x = e.clientX; pointers[e.pointerId].y = e.clientY; }

    if (Object.keys(pointers).length === 2 && pinchStart > 0) {
      var d = pinchDist();
      if (d > 0) {
        userZoom = clampSoft(pinchZoom0 * (d / pinchStart));
        e.preventDefault && e.preventDefault();
      }
      return;
    }
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    S.pxTar += dx; S.pyTar += dy;
    S.pxVel += dx * 0.4; S.pyVel += dy * 0.4;        // feed the throw
    S.rotTar += dx * 0.02;                            // horizontal drag adds spin
  }, { passive: false });

  function endPointer(e) {
    delete pointers[e.pointerId];
    if (Object.keys(pointers).length < 2) pinchStart = 0;
    if (dragging && moved < 4) pulse(e.clientX, e.clientY); // a tap pulses a bounce
    dragging = false;
  }
  window.addEventListener('pointerup', endPointer, { passive: true });
  window.addEventListener('pointercancel', endPointer, { passive: true });

  // double interaction sends a springy zoom pulse
  var lastTap = 0;
  function pulse() {
    var now = Date.now();
    if (now - lastTap < 320) { userZoom = clampSoft(userZoom * 1.45); S.scaleVel += 0.12; }
    lastTap = now;
  }

  // ---- input: wheel. plain wheel scrolls the page (which springs the zoom);
  // Cmd/Ctrl+wheel pushes zoom directly without moving the page. ------------
  window.addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      userZoom = clampSoft(userZoom * (e.deltaY < 0 ? 1.08 : 0.93));
    }
  }, { passive: false });

  function clampSoft(z) {
    // allow a little travel past the bound so the spring can bounce back in
    if (z < ZOOM_MIN * 0.82) return ZOOM_MIN * 0.82;
    if (z > ZOOM_MAX * 1.18) return ZOOM_MAX * 1.18;
    return z;
  }
  function clampPan(v) {
    if (v > PAN_LIMIT * 1.25) return PAN_LIMIT * 1.25;
    if (v < -PAN_LIMIT * 1.25) return -PAN_LIMIT * 1.25;
    return v;
  }

  // ---- engine --------------------------------------------------------------
  var t0 = performance.now();
  function spring(pos, tar, vel, k, damp) {
    vel = (vel + (tar - pos) * k) * damp;
    return [pos + vel, vel];
  }

  function frame(now) {
    var t = (now - t0) / 1000;

    // scroll position sets the base zoom and spin target
    var p = scrollProgress();
    var breath = Math.sin(t * 0.6) * 0.02;                 // always-alive idle
    var base = (BASE + p * RANGE) * userZoom + breath;

    // elastic bounds: pull the target back inside if user pushed past
    if (base < ZOOM_MIN) base = ZOOM_MIN + (base - ZOOM_MIN) * 0.35;
    if (base > ZOOM_MAX) base = ZOOM_MAX + (base - ZOOM_MAX) * 0.35;
    S.scaleTar = base;
    S.rotTar = p * 26 + Math.sin(t * 0.25) * 1.2;

    // pan eases home with elastic edges when not dragging
    if (!dragging) {
      S.pxTar *= 0.96; S.pyTar *= 0.96;          // drift back toward center
      S.pxTar = clampPan(S.pxTar + S.pxVel);
      S.pyTar = clampPan(S.pyTar + S.pyVel);
      S.pxVel *= 0.90; S.pyVel *= 0.90;          // momentum decay (the throw)
    }

    var r;
    r = spring(S.scale, S.scaleTar, S.scaleVel, 0.10, 0.82); S.scale = r[0]; S.scaleVel = r[1];
    r = spring(S.rot,   S.rotTar,   S.rotVel,   0.06, 0.85); S.rot = r[0]; S.rotVel = r[1];
    r = spring(S.px,    S.pxTar,    S.pxVel,    0.07, 0.80); S.px = r[0];
    r = spring(S.py,    S.pyTar,    S.pyVel,    0.07, 0.80); S.py = r[0];

    stage.style.transform =
      'translate(' + S.px.toFixed(1) + 'px,' + S.py.toFixed(1) + 'px) ' +
      'scale(' + S.scale.toFixed(3) + ') rotate(' + S.rot.toFixed(2) + 'deg)';

    // hue tracks how deep the zoom has gone
    var depth = (S.scale - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN);
    stage.style.color = hueAt(depth);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // regenerate the field on resize so it refits at any window size or zoom
  var rT;
  window.addEventListener('resize', function () {
    clearTimeout(rT);
    rT = setTimeout(function () { mobile = window.innerWidth < 768; render(); }, 220);
  }, { passive: true });
})();
