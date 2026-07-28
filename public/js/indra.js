// ============================================================================
// INDRA SCROLL GEOMETRY — site-wide geometric wayfinding layer (2026-07-23)
//
// Design contract:
//   • Every real page receives the same geometric language.
//   • Geometry responds only to scrolling and resizing; it never runs an idle
//     animation loop, follows the pointer, ripples on click, or moves content.
//   • The layer is fixed, edge-masked, pointer-safe, and transform-only.
//   • Reduced-motion users receive the same ornament in a static position.
//   • Per-route framing and intensity preserve character without changing the
//     underlying geometry.
// ============================================================================
(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  if (!body || document.getElementById('indraLayer')) return;

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var path = window.location.pathname || '/';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function seedOf(value) {
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash;
  }

  function routeTier(route) {
    if (/^\/(polymyth|bb|bookwormcard|campaigns|aa|ohm-dome|agora|florilegium)(\/|$)/.test(route)) return 'expressive';
    if (/^\/(leizu|saul|teacherresources|polymythseminars|seminars|marginalia|reviews)(\/|$)/.test(route)) return 'quiet';
    return route === '/' || route === '/index.html' ? 'expressive' : 'standard';
  }

  var tier = routeTier(path);
  var requested = parseFloat(body.getAttribute('data-indra-intensity'));
  var defaultOpacity = tier === 'expressive' ? 0.105 : tier === 'quiet' ? 0.060 : 0.075;
  var opacity = Number.isFinite(requested) ? clamp(requested, 0.04, 0.13) : defaultOpacity;
  // Pages with their own foreground geometry keep the shared layer quieter,
  // rather than losing the site-wide scroll language entirely.
  if (document.getElementById('geo') || document.getElementById('geo2')) opacity *= 0.72;

  var seed = seedOf(path);
  var baseRotation = ((seed % 1600) / 1600) * 24 - 12;
  var baseScale = (tier === 'expressive' ? 1.16 : 1.08) + ((seed >>> 10) % 100) / 1000;
  var baseX = (((seed >>> 8) % 81) - 40);
  var baseY = (((seed >>> 17) % 61) - 30);

  function fallbackSvg() {
    return '<svg viewBox="-400 -400 800 800" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<g class="geo-stroke" fill="none" stroke="currentColor" stroke-width="1">' +
      '<circle cx="0" cy="0" r="300"/><circle cx="-150" cy="0" r="150"/>' +
      '<circle cx="150" cy="0" r="150"/><circle cx="0" cy="-173" r="127"/>' +
      '<circle cx="0" cy="173" r="127"/><circle cx="0" cy="0" r="82"/>' +
      '</g></svg>';
  }

  function geometryMarkup() {
    if (!window.PolymythMandala || typeof window.PolymythMandala.build !== 'function') return fallbackSvg();
    return window.PolymythMandala.build({
      gaskets: [
        { rot: 0, scale: 1, op: 0.64 },
        { rot: Math.PI * 0.42, scale: 1 / 1.6180339887, op: 0.44 },
        { rot: Math.PI * 0.78, scale: 1 / (1.6180339887 * 1.6180339887), op: 0.30 }
      ],
      flowers: false,
      jewels: !coarse,
      maxDepth: coarse ? 4 : 5,
      minRadius: coarse ? 3.2 : 2.2
    });
  }

  // VISIBLE_GEOMETRY_GUARD: every non-redirect page mounts this shared layer.
  var layer = document.createElement('div');
  layer.id = 'indraLayer';
  layer.className = 'indra-scroll-geometry';
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('role', 'presentation');
  layer.setAttribute('data-geometry-engine', 'scroll');
  layer.style.pointerEvents = 'none';
  layer.style.setProperty('--indra-opacity', opacity.toFixed(3));
  layer.innerHTML = geometryMarkup();
  body.appendChild(layer);

  root.setAttribute('data-geometry-ready', 'true');
  body.setAttribute('data-geometry-engine', 'scroll');

  var raf = 0;
  var lastProgress = -1;
  var geometryWidth = window.innerWidth;
  var geometryCoarse = coarse;

  function readProgress() {
    var scrollTop = window.scrollY || root.scrollTop || 0;
    var range = Math.max(1, root.scrollHeight - window.innerHeight);
    return clamp(scrollTop / range, 0, 1);
  }

  function paint() {
    raf = 0;
    var progress = readProgress();
    if (Math.abs(progress - lastProgress) < 0.0002 && lastProgress >= 0) return;
    lastProgress = progress;

    var centered = progress - 0.5;
    var travel = tier === 'expressive' ? 34 : tier === 'quiet' ? 20 : 26;
    if (coarse) travel *= 0.72;
    var x = baseX + centered * travel * 0.38;
    var y = baseY - centered * travel;
    var rotation = baseRotation + centered * (tier === 'expressive' ? 4.2 : 2.6);
    var scale = baseScale + progress * (tier === 'expressive' ? 0.045 : 0.028);

    layer.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) rotate(' +
      rotation.toFixed(3) + 'deg) scale(' + scale.toFixed(4) + ')';
    layer.style.setProperty('--indra-progress', progress.toFixed(4));
  }

  function schedule() {
    if (!raf) raf = window.requestAnimationFrame(paint);
  }

  paint();
  if (!reduced) window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('pageshow', schedule, { passive: true });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      var nextCoarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      var nextWidth = window.innerWidth;
      if (nextCoarse !== geometryCoarse || Math.abs(nextWidth - geometryWidth) > 1) {
        coarse = nextCoarse;
        geometryCoarse = nextCoarse;
        geometryWidth = nextWidth;
        layer.innerHTML = geometryMarkup();
      }
      lastProgress = -1;
      schedule();
    }, 160);
  }, { passive: true });
})();
