// ============================================================================
// INDRA SCROLL GEOMETRY — site-wide geometric wayfinding layer (2026-07-23)
//
// Design contract:
//   • Every real page receives the same geometric language.
//   • Geometry responds only to scrolling and resizing; it never runs an idle
//     animation loop, follows the pointer, ripples on click, or moves content.
//   • The layer is fixed, edge-masked, pointer-safe, and transform-only.
//   • Reduced-motion users receive the same ornament in a static position.
//   • Per-route framing, route-family flavor, and intensity preserve character.
//   • This shared layer is the universal all-page scroll geometry requirement.
//     It does not claim to prove a separate page-meaning doctrine.
// ============================================================================
(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  if (!body || document.getElementById('indraLayer')) return;

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var path = window.location.pathname || '/';
  var routeType = String(body.getAttribute('data-route-type') || 'unclassified');
  var roleList = String(body.getAttribute('data-geometry-role') || 'relation')
    .trim().split(/\s+/).filter(Boolean);
  var roleSet = Object.create(null);
  for (var roleIndex = 0; roleIndex < roleList.length; roleIndex++) roleSet[roleList[roleIndex]] = true;
  function hasRole(role) { return !!roleSet[role]; }

  var MAX_MARKUP_BYTES = 180000;
  var MAX_SHAPES = 1600;

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

  function pageStructureFacts() {
    var local = Object.create(null);
    var anchors = document.querySelectorAll('a[href]');
    for (var anchorIndex = 0; anchorIndex < anchors.length; anchorIndex++) {
      var href = String(anchors[anchorIndex].getAttribute('href') || '');
      if (/^(?:\/|\.\.?\/|#)/.test(href) && href !== '#') local[href] = true;
    }
    return {
      links: Object.keys(local).length,
      groups: document.querySelectorAll('section,article,details,[role="region"],[role="list"]').length,
      headings: document.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
      controls: document.querySelectorAll('button,input,select,textarea,summary,[aria-expanded],[data-action],[data-filter],[data-view],[data-tab]').length
    };
  }

  // The shared scroll layer is parameterized by route and surface facts so
  // pages have stable local variation without requiring a semantic proof.
  var structure = pageStructureFacts();
  var structuralSignature = [
    routeType,
    roleList.join('.'),
    structure.links,
    structure.groups,
    structure.headings,
    structure.controls
  ].join(':');

  function routeTier(route) {
    if (/^\/(polymyth|bb|bookwormcard|campaigns|aa|ohm-dome|agora|florilegium)(\/|$)/.test(route)) return 'expressive';
    if (/^\/(leizu|saul|teacherresources|polymythseminars|seminars|marginalia|reviews)(\/|$)/.test(route)) return 'quiet';
    return route === '/' || route === '/index.html' ? 'expressive' : 'standard';
  }

  var tier = routeTier(path);
  var requested = parseFloat(body.getAttribute('data-indra-intensity'));
  var defaultOpacity = tier === 'expressive' ? 0.105 : tier === 'quiet' ? 0.060 : 0.075;
  var opacity = Number.isFinite(requested) ? clamp(requested, 0.04, 0.13) : defaultOpacity;
  // A verified foreground geometry may quiet the shared scroll layer to 0.025.
  var structuralForeground = document.getElementById('geo') ||
    document.getElementById('geo2') ||
    document.getElementById('geoLayer') ||
    document.getElementById('projectMap') ||
    document.querySelector('[data-geometry-foreground="structural"]');
  if (structuralForeground) opacity = Math.max(0.025, opacity * 0.72);

  var seed = seedOf(path + '|' + structuralSignature);
  var baseRotation = ((seed % 1600) / 1600) * 24 - 12;
  var baseScale = (tier === 'expressive' ? 1.16 : 1.08)
    + (hasRole('synthesis') ? 0.035 : 0)
    + ((seed >>> 10) % 100) / 1000;
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

  function countShapes(markup) {
    var matches = String(markup).match(/<(?:circle|path|line|polygon|polyline|rect)\b/g);
    return matches ? matches.length : 0;
  }

  function boundedGeometry(markup, fallbackReason) {
    var shapes = countShapes(markup);
    if (markup.length <= MAX_MARKUP_BYTES && shapes <= MAX_SHAPES) {
      return { markup: markup, shapes: shapes, fallback: fallbackReason || '' };
    }
    return null;
  }

  function geometryMarkup() {
    if (!window.PolymythMandala || typeof window.PolymythMandala.build !== 'function') {
      var fallback = fallbackSvg();
      return { markup: fallback, shapes: countShapes(fallback), fallback: 'mandala-unavailable' };
    }
    var relationPhase = (structure.links % 11) / 11;
    var hierarchyPhase = (Math.max(1, structure.headings) % 9) / 9;
    var gaskets = [{ rot: hierarchyPhase * Math.PI * 0.12, scale: 1, op: 0.64 }];
    if (hasRole('relation') || hasRole('synthesis')) {
      gaskets.push({ rot: Math.PI * (0.36 + relationPhase * 0.12), scale: 1 / 1.6180339887, op: 0.44 });
    }
    if (hasRole('return') || hasRole('synthesis')) {
      gaskets.push({ rot: Math.PI * (0.72 + hierarchyPhase * 0.12), scale: 1 / (1.6180339887 * 1.6180339887), op: 0.30 });
    }
    var maxDepth = coarse ? 4 : (hasRole('movement') &&
      (structure.groups + structure.controls) > 0 ? 5 : 4);
    var markup = window.PolymythMandala.build({
      gaskets: gaskets,
      flowers: false,
      jewels: hasRole('relation') && !coarse,
      maxDepth: maxDepth,
      minRadius: coarse ? 3.2 : 2.2
    });
    var bounded = boundedGeometry(markup, '');
    if (bounded) return bounded;

    // Complexity fallback stays structurally parameterized by the same gasket
    // set while dropping recursion and jewels. It never grows without a bound.
    markup = window.PolymythMandala.build({
      gaskets: gaskets,
      flowers: false,
      jewels: false,
      maxDepth: 3,
      minRadius: coarse ? 3.2 : 2.2
    });
    bounded = boundedGeometry(markup, 'complexity-reduced');
    if (bounded) return bounded;

    var fallbackMarkup = fallbackSvg();
    return { markup: fallbackMarkup, shapes: countShapes(fallbackMarkup), fallback: 'complexity-fallback' };
  }

  function paintMarkup(target) {
    var geometry = geometryMarkup();
    target.innerHTML = geometry.markup;
    target.setAttribute('data-geometry-shapes', String(geometry.shapes));
    // Measure the DOM serialization the browser actually mounted. SVG
    // parsing expands self-closing tags, so the source-string length is not
    // an honest runtime budget and can disagree by more than a kilobyte.
    var mountedMarkup = target.innerHTML;
    var mountedBytes = typeof TextEncoder === 'function'
      ? new TextEncoder().encode(mountedMarkup).length
      : unescape(encodeURIComponent(mountedMarkup)).length;
    target.setAttribute('data-geometry-markup-bytes', String(mountedBytes));
    if (geometry.fallback) target.setAttribute('data-geometry-fallback', geometry.fallback);
    else target.removeAttribute('data-geometry-fallback');
  }

  // VISIBLE_GEOMETRY_GUARD: every non-redirect page mounts this shared layer.
  var layer = document.createElement('div');
  layer.id = 'indraLayer';
  layer.className = 'indra-scroll-geometry';
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('role', 'presentation');
  layer.setAttribute('data-geometry-engine', 'scroll');
  layer.setAttribute('data-geometry-role', roleList.join(' '));
  layer.setAttribute('data-geometry-kind', 'shared-scroll-layer');
  layer.setAttribute('data-geometry-source', 'shared-scroll-layer');
  layer.setAttribute('data-geometry-input', 'path-route-scroll');
  layer.setAttribute('data-geometry-proof', 'all-page-scroll');
  layer.setAttribute('data-geometry-signature', structuralSignature);
  layer.style.pointerEvents = 'none';
  layer.style.setProperty('--indra-opacity', opacity.toFixed(3));
  paintMarkup(layer);
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
    if (hasRole('movement')) travel *= 1.12 + Math.min(0.14, (structure.groups + structure.controls) * 0.01);
    if (coarse) travel *= 0.72;
    var x = baseX + centered * travel * 0.38;
    var y = baseY - centered * travel;
    var rotation = baseRotation + centered * (tier === 'expressive' ? 4.2 : 2.6)
      * (hasRole('return') ? 1.22 : 1);
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
        paintMarkup(layer);
      }
      lastProgress = -1;
      schedule();
    }, 160);
  }, { passive: true });
})();
