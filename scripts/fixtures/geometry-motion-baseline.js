// ============================================================================
// INDRA — the original Polymyth Mandala field on every non-star public route.
//
// The SVG is identical everywhere: three phi-scaled Apollonian gaskets,
// flowers grown from tangencies, and prismatic Indra jewels. Two independent
// cameras revisit the old rainbow field from opposite regions. A normalized
// path selects stable views into that same web; scroll moves both cameras and
// carries their line colour through the original spectrum. Nothing here
// changes layout or runs an idle animation loop.
// ============================================================================
(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  if (!body
      || body.getAttribute('data-geometry') !== 'indra-web'
      || body.hasAttribute('data-shared-geometry-exempt')
      || body.getAttribute('data-star-file-page') === 'true'
      || document.getElementById('indraLayer')) return;

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var canonicalId = window.PolymythMandala && window.PolymythMandala.canonicalId || 'polymyth-mandala-main-v32';
  var MAX_SHAPES_PER_CAMERA = 1400;
  var MAX_MARKUP_BYTES_PER_CAMERA = 265000;

  /* The subdued spectrum is the original /main/ geometry palette. It belongs
     to the background field alone; foreground page colours and the homepage
     project constellation remain independently owned. */
  var RAINBOW_HEX = Object.freeze([
    '#8a4a32', '#c47a2e', '#a09030', '#3d8a5a',
    '#4070a8', '#6850a0', '#9050a0', '#a84858'
  ]);
  var RAINBOW_PALETTE = Object.freeze(RAINBOW_HEX.map(function (hex) {
    return Object.freeze([
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ]);
  }));
  var MIN_OPACITY = 0.020;
  var MAX_OPACITY = 0.200;

  var CAMERA_PRIMARY = [
    { x: 120, y: 30, zoom: 7 },
    { x: 40, y: -30, zoom: 5 },
    { x: 10, y: -130, zoom: 10 },
    { x: 0, y: 50, zoom: 12 },
    { x: -110, y: 50, zoom: 8 },
    { x: -60, y: 120, zoom: 11 },
    { x: 20, y: -10, zoom: 6 },
    { x: 70, y: -100, zoom: 9 }
  ];
  var CAMERA_SECONDARY = [
    { x: -100, y: 40, zoom: 6 },
    { x: 0, y: 50, zoom: 8 },
    { x: 80, y: 100, zoom: 8 },
    { x: -120, y: -80, zoom: 7 },
    { x: 40, y: -110, zoom: 9 },
    { x: 100, y: -30, zoom: 8 },
    { x: -80, y: 100, zoom: 9 },
    { x: -40, y: 20, zoom: 7 }
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(value) {
    var t = clamp(value, 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function normalizePath(value) {
    var path = String(value || '/').split(/[?#]/, 1)[0] || '/';
    try { path = decodeURI(path); } catch (_) {}
    path = ('/' + path.replace(/^\/+/, '')).replace(/\/{2,}/g, '/');
    path = path.replace(/\/index\.html$/i, '/');
    if (path !== '/' && !/\.[a-z0-9]+$/i.test(path) && !/\/$/.test(path)) path += '/';
    return path;
  }

  function seedOf(value) {
    var hash = 2166136261;
    for (var index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }

  function seedPair(value, explicit) {
    var clean = String(explicit || '').replace(/[^a-fA-F0-9]/g, '');
    var first = clean.length >= 8 ? parseInt(clean.slice(0, 8), 16) >>> 0 : seedOf(value);
    var second = clean.length >= 16 ? parseInt(clean.slice(8, 16), 16) >>> 0 : seedOf(value + '|opposite');
    return { first: first, second: second };
  }

  function routeRegister(path) {
    if (/^\/polymyth\/coherence(?:\/|$)/.test(path)) return 'quiet';
    if (/^\/(?:polymyth|bb|bookwormcard|campaigns|aa|ohm-dome|agora|florilegium)(?:\/|$)/.test(path) || path === '/') return 'expressive';
    if (/^\/(?:about|leizu|saul|teacherresources|polymythseminars|seminars|writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships|marginalia|reviews)(?:\/|$)/.test(path)) return 'quiet';
    return 'standard';
  }

  function routeProfile() {
    return 'dual-field';
  }

  function rainbowColor(progress) {
    var scaled = clamp(progress, 0, 1) * (RAINBOW_PALETTE.length - 1);
    var index = Math.min(RAINBOW_PALETTE.length - 2, Math.floor(scaled));
    var local = scaled - index;
    var start = RAINBOW_PALETTE[index];
    var end = RAINBOW_PALETTE[index + 1];
    return 'rgb(' + [0, 1, 2].map(function (channel) {
      return Math.round(start[channel] + (end[channel] - start[channel]) * local);
    }).join(',') + ')';
  }

  function byteLength(value) {
    return typeof TextEncoder === 'function'
      ? new TextEncoder().encode(String(value)).length
      : unescape(encodeURIComponent(String(value))).length;
  }

  function countShapes(markup) {
    var matches = String(markup).match(/<(?:circle|path|line|polygon|polyline|rect)\b/g);
    return matches ? matches.length : 0;
  }

  function canonicalHash(markup) {
    var normalized = String(markup)
      .replace(/indra-(?:primary|secondary)-jewel-(?:core|prism)/g, 'indra-camera-jewel')
      .replace(/\s+/g, ' ');
    return ('00000000' + seedOf(normalized).toString(16)).slice(-8);
  }

  function fallbackSvg() {
    return '<svg viewBox="-400 -400 800 800" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<g class="geo-stroke" fill="none" stroke="currentColor" stroke-width="1">' +
      '<circle cx="0" cy="0" r="300"/><circle cx="-150" cy="0" r="150"/>' +
      '<circle cx="150" cy="0" r="150"/><circle cx="0" cy="-173" r="127"/>' +
      '<circle cx="0" cy="173" r="127"/><circle cx="0" cy="0" r="82"/>' +
      '</g></svg>';
  }

  var routeType = String(body.getAttribute('data-route-type') || 'unclassified');
  var geometryKey = normalizePath(body.getAttribute('data-geometry-key') || window.location.pathname || '/');
  var seeds = seedPair(geometryKey, body.getAttribute('data-geometry-seed'));
  var register = String(body.getAttribute('data-geometry-register') || routeRegister(geometryKey));
  if (!/^(?:quiet|standard|expressive)$/.test(register)) register = routeRegister(geometryKey);
  var profile = String(body.getAttribute('data-geometry-profile') || routeProfile(geometryKey, routeType));
  if (profile !== 'dual-field') profile = 'dual-field';
  var requestedOpacity = parseFloat(body.getAttribute('data-indra-intensity'));
  var registerOpacity = register === 'expressive' ? 0.200 : register === 'quiet' ? 0.115 : 0.135;
  var requestedFadeSource = String(body.getAttribute('data-indra-fade-source') || '');
  var pageCssOpacity = NaN;
  if (typeof window.getComputedStyle === 'function') {
    pageCssOpacity = parseFloat(window.getComputedStyle(body).getPropertyValue('--indra-opacity'));
  }
  function validOpacity(value) {
    return Number.isFinite(value) && value >= MIN_OPACITY && value <= MAX_OPACITY;
  }
  var pageRequested = validOpacity(requestedOpacity)
    && (requestedFadeSource === 'page' || Math.abs(requestedOpacity - registerOpacity) > 0.001);
  var opacity = validOpacity(pageCssOpacity)
    ? pageCssOpacity
    : pageRequested ? requestedOpacity : registerOpacity;
  var fadeSource = validOpacity(pageCssOpacity) || pageRequested ? 'page' : 'route-register';

  body.setAttribute('data-geometry-key', geometryKey);
  body.setAttribute('data-geometry-register', register);
  body.setAttribute('data-geometry-profile', profile);
  body.setAttribute('data-indra-intensity', opacity.toFixed(3));
  body.setAttribute('data-indra-fade-source', fadeSource);
  body.setAttribute('data-geometry-engine', 'canonical-scroll-camera');

  var layer = document.createElement('div');
  layer.id = 'indraLayer';
  layer.className = 'indra-field';
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('role', 'presentation');
  layer.setAttribute('data-geometry-engine', 'canonical-scroll-camera');
  layer.setAttribute('data-geometry-kind', 'shared-background-web');
  layer.setAttribute('data-geometry-source', 'polymyth-mandala-main-v32');
  layer.setAttribute('data-geometry-input', 'normalized-path-scroll');
  layer.setAttribute('data-geometry-proof', 'eligible-page-scroll');
  layer.setAttribute('data-geometry-register', register);
  layer.setAttribute('data-geometry-profile', profile);
  layer.setAttribute('data-geometry-key', geometryKey);
  layer.setAttribute('data-geometry-canonical-id', canonicalId);
  layer.setAttribute('data-geometry-palette', RAINBOW_HEX.join(','));
  layer.setAttribute('data-geometry-fade-source', fadeSource);
  layer.setAttribute('data-geometry-motion-source', reduced ? 'reduced-motion' : 'window-scroll');
  layer.style.pointerEvents = 'none';
  layer.style.setProperty('--indra-opacity-resolved', opacity.toFixed(3));

  var cameras = [];
  var fallbackReason = '';
  var canonicalMarkup;
  if (window.PolymythMandala && typeof window.PolymythMandala.buildCanonical === 'function') {
    canonicalMarkup = window.PolymythMandala.buildCanonical({ idPrefix: 'indra-shared' });
  } else {
    canonicalMarkup = fallbackSvg();
    fallbackReason = 'canonical-mandala-unavailable';
  }
  var canonicalShapes = countShapes(canonicalMarkup);
  var canonicalBytes = byteLength(canonicalMarkup);
  var canonicalMarkupHash = canonicalHash(canonicalMarkup);
  var canonicalOpen = canonicalMarkup.indexOf('>');
  var canonicalClose = canonicalMarkup.lastIndexOf('</svg>');
  var canonicalContents = canonicalOpen >= 0 && canonicalClose > canonicalOpen
    ? canonicalMarkup.slice(canonicalOpen + 1, canonicalClose)
    : canonicalMarkup;
  var definitionBank = document.createElement('div');
  definitionBank.className = 'indra-definition-bank';
  definitionBank.setAttribute('aria-hidden', 'true');
  definitionBank.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" width="0" height="0">' +
    '<defs><symbol id="indra-canonical-symbol" viewBox="-380 -380 760 760">' + canonicalContents + '</symbol></defs></svg>';
  layer.appendChild(definitionBank);

  function mountCamera(name, secondary) {
    var camera = document.createElement('div');
    camera.className = 'indra-camera indra-camera--' + name;
    camera.setAttribute('data-geometry-camera', name);
    camera.setAttribute('data-geometry-canonical-id', canonicalId);
    camera.setAttribute('data-geometry-instance', 'canonical-use');
    camera.innerHTML = '<svg class="polymyth-mandala polymyth-mandala-instance" data-canonical-web="' + canonicalId + '" ' +
      'viewBox="-380 -380 760 760" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<use href="#indra-canonical-symbol" x="-380" y="-380" width="760" height="760"></use></svg>';
    camera.setAttribute('data-geometry-shapes', String(canonicalShapes));
    camera.setAttribute('data-geometry-markup-bytes', String(canonicalBytes));
    camera.setAttribute('data-geometry-canonical-hash', canonicalMarkupHash);
    camera.setAttribute('data-geometry-gaskets', ['0', '1', '2'].filter(function (value) {
      return canonicalMarkup.indexOf('data-gasket="' + value + '"') >= 0;
    }).join(','));
    camera.setAttribute('data-geometry-flowers', String((canonicalMarkup.match(/geo-flower(?:\s|"|-)/g) || []).length));
    camera.setAttribute('data-geometry-jewels', String((canonicalMarkup.match(/geo-jewel-core/g) || []).length));
    camera.setAttribute('data-geometry-prisms', String((canonicalMarkup.match(/geo-jewel-prism/g) || []).length));
    if (canonicalShapes > MAX_SHAPES_PER_CAMERA || canonicalBytes > MAX_MARKUP_BYTES_PER_CAMERA) {
      camera.setAttribute('data-geometry-budget', 'exceeded');
    } else {
      camera.setAttribute('data-geometry-budget', 'within');
    }
    if (secondary) camera.style.setProperty('--indra-camera-opacity', '0.58');
    layer.appendChild(camera);
    cameras.push({ element: camera, secondary: secondary });
  }

  mountCamera('primary', false);
  mountCamera('secondary', true);

  layer.setAttribute('data-geometry-canonical-hash', canonicalMarkupHash);
  layer.setAttribute('data-geometry-shapes', String(canonicalShapes));
  layer.setAttribute('data-geometry-markup-bytes', String(canonicalBytes));
  layer.setAttribute('data-geometry-cameras', String(cameras.length));
  layer.setAttribute('data-geometry-field', 'fine-line-rainbow-dual');
  layer.setAttribute('data-geometry-coverage-surfaces', '0');
  layer.setAttribute('data-geometry-camera-signature', [geometryKey, register, profile, seeds.first.toString(16), seeds.second.toString(16)].join(':'));
  if (fallbackReason) layer.setAttribute('data-geometry-fallback', fallbackReason);
  body.appendChild(layer);

  function cameraPointFor(bank, seed, detailSeed, registerName, secondary, progress) {
    var offset = seed % bank.length;
    var direction = ((seed >>> 7) & 1) ? 1 : -1;
    var segments = 5;
    var scaled = clamp(progress, 0, 1) * segments;
    var segment = Math.min(segments - 1, Math.floor(scaled));
    var local = smoothstep(scaled - segment);
    function point(step) {
      var index = (offset + direction * step) % bank.length;
      if (index < 0) index += bank.length;
      return bank[index];
    }
    var current = point(segment);
    var next = point(segment + 1);
    var registerZoom = registerName === 'expressive' ? 1 : registerName === 'quiet' ? 0.74 : 0.86;
    /* A phone viewport needs a wider camera window than a desktop viewport.
       This is a viewport-wide optical correction, never a route exception:
       all routes keep the same bank, seed, direction, and full canonical web. */
    var viewportZoom = window.innerWidth < 640 ? 0.40 : window.innerWidth < 900 ? 0.50 : 0.45;
    var zoom = (current.zoom + (next.zoom - current.zoom) * local) * registerZoom * viewportZoom;
    var x = current.x + (next.x - current.x) * local;
    var y = current.y + (next.y - current.y) * local;
    var centered = progress - 0.5;
    var travel = registerName === 'expressive' ? 200 : registerName === 'quiet' ? 90 : 135;
    var rotationTravel = secondary ? -3.4 : 4.2;
    var baseRotation = (seed / 4294967296) * 360 - 180;
    var rotation = baseRotation + centered * rotationTravel;
    var angle = rotation * Math.PI / 180;
    var scaledX = x * zoom;
    var scaledY = y * zoom;
    var rotatedX = scaledX * Math.cos(angle) - scaledY * Math.sin(angle);
    var rotatedY = scaledX * Math.sin(angle) + scaledY * Math.cos(angle);
    var first = point(0);
    var last = point(segments);
    var firstAngle = (baseRotation - 0.5 * rotationTravel) * Math.PI / 180;
    var lastAngle = (baseRotation + 0.5 * rotationTravel) * Math.PI / 180;
    var firstZoom = first.zoom * registerZoom * viewportZoom;
    var lastZoom = last.zoom * registerZoom * viewportZoom;
    var firstBaseY = -(first.x * firstZoom * Math.sin(firstAngle) + first.y * firstZoom * Math.cos(firstAngle));
    var lastBaseY = -(last.x * lastZoom * Math.sin(lastAngle) + last.y * lastZoom * Math.cos(lastAngle));
    var flowSign = lastBaseY - firstBaseY < 0 ? -1 : 1;
    var routeOffsetX = ((detailSeed & 65535) / 65535 - 0.5) * 48;
    var routeOffsetY = (((detailSeed >>> 16) & 65535) / 65535 - 0.5) * 48;
    return {
      x: -rotatedX + routeOffsetX + centered * travel * (secondary ? -0.18 : 0.22),
      y: -rotatedY + routeOffsetY + centered * travel * flowSign,
      zoom: zoom,
      rotation: rotation,
      travel: travel
    };
  }

  function cameraPoint(which, progress) {
    var secondary = which > 0;
    return cameraPointFor(
      secondary ? CAMERA_SECONDARY : CAMERA_PRIMARY,
      secondary ? seeds.second : seeds.first,
      secondary ? seeds.first : seeds.second,
      register,
      secondary,
      progress
    );
  }

  function paintAt(progress) {
    layer.style.setProperty('--indra-color', rainbowColor(progress));
    for (var index = 0; index < cameras.length; index++) {
      var state = cameraPoint(index, progress);
      cameras[index].element.style.transform = 'translate3d(' + state.x.toFixed(2) + 'px,' + state.y.toFixed(2) + 'px,0) rotate(' +
        state.rotation.toFixed(3) + 'deg) scale(' + state.zoom.toFixed(4) + ')';
      cameras[index].element.style.setProperty('--indra-progress', progress.toFixed(4));
      cameras[index].element.style.setProperty('--indra-travel', state.travel.toFixed(2));
    }
    layer.setAttribute('data-geometry-progress', progress.toFixed(4));
  }

  /* Most routes scroll the document, but several real projects deliberately
     keep the document fixed and scroll a panel or pan/zoom a full-screen
     working surface. Treat the input the visitor actually moves as the camera
     driver. This remains event-driven: no observer sweep and no idle loop. */
  var activeScrollElement = null;
  var virtualProgress = 0.32;
  var motionSource = 'window-scroll';
  var panPointerId = null;
  var panLastX = 0;
  var panLastY = 0;

  function numeric(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function elementScrollProgress(element) {
    if (!element || element === document || element === root || element === body) return null;
    var verticalRange = Math.max(0, numeric(element.scrollHeight) - numeric(element.clientHeight));
    if (verticalRange > 1) return clamp(numeric(element.scrollTop) / verticalRange, 0, 1);
    var horizontalRange = Math.max(0, numeric(element.scrollWidth) - numeric(element.clientWidth));
    if (horizontalRange > 1) return clamp(numeric(element.scrollLeft) / horizontalRange, 0, 1);
    return null;
  }

  function documentScrollProgress() {
    var scrollTop = numeric(window.scrollY || root.scrollTop || body.scrollTop);
    var documentHeight = Math.max(numeric(root.scrollHeight), numeric(body.scrollHeight));
    var range = Math.max(0, documentHeight - numeric(window.innerHeight));
    return range > 1 ? clamp(scrollTop / range, 0, 1) : 0.32;
  }

  function readProgress() {
    if (motionSource === 'element-scroll') {
      var elementProgress = elementScrollProgress(activeScrollElement);
      if (elementProgress !== null) return elementProgress;
      activeScrollElement = null;
      motionSource = 'window-scroll';
    }
    if (motionSource === 'wheel' || motionSource === 'pan') return virtualProgress;
    return documentScrollProgress();
  }

  function setMotionSource(source) {
    motionSource = source;
    layer.setAttribute('data-geometry-motion-source', source);
  }

  function parentElement(node) {
    return node && (node.parentElement || node.parentNode) || null;
  }

  function computedValue(element, property, camelName) {
    if (!element || typeof window.getComputedStyle !== 'function') return '';
    var style;
    try { style = window.getComputedStyle(element); } catch (_) { return ''; }
    return String((style && style[camelName]) || (style && style.getPropertyValue && style.getPropertyValue(property)) || '');
  }

  function scrollableAncestor(start) {
    var element = start;
    while (element && element !== body && element !== root && element !== document) {
      var verticalRange = Math.max(0, numeric(element.scrollHeight) - numeric(element.clientHeight));
      var horizontalRange = Math.max(0, numeric(element.scrollWidth) - numeric(element.clientWidth));
      var overflowY = computedValue(element, 'overflow-y', 'overflowY');
      var overflowX = computedValue(element, 'overflow-x', 'overflowX');
      if ((verticalRange > 1 && /^(?:auto|scroll|overlay)$/.test(overflowY))
          || (horizontalRange > 1 && /^(?:auto|scroll|overlay)$/.test(overflowX))) return element;
      element = parentElement(element);
    }
    return null;
  }

  function panSurface(start) {
    var element = start;
    while (element && element !== body && element !== root && element !== document) {
      var touchAction = computedValue(element, 'touch-action', 'touchAction');
      var cursor = computedValue(element, 'cursor', 'cursor');
      if (touchAction === 'none' || /^(?:grab|grabbing)$/.test(cursor)) return element;
      element = parentElement(element);
    }
    return null;
  }

  var raf = 0;
  var paintFallbackTimer = 0;
  var SCROLL_PAINT_FALLBACK_MS = 48;
  var lastProgress = -1;
  function paint() {
    if (paintFallbackTimer) {
      window.clearTimeout(paintFallbackTimer);
      paintFallbackTimer = 0;
    }
    raf = 0;
    var progress = readProgress();
    if (lastProgress >= 0 && Math.abs(progress - lastProgress) < 0.0002) return;
    lastProgress = progress;
    paintAt(progress);
  }

  function schedule() {
    if (raf || paintFallbackTimer) return;
    raf = window.requestAnimationFrame(paint);
    paintFallbackTimer = window.setTimeout(function () {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      paintFallbackTimer = 0;
      paint();
    }, SCROLL_PAINT_FALLBACK_MS);
  }

  function onWindowScroll() {
    activeScrollElement = null;
    setMotionSource('window-scroll');
    schedule();
  }

  function onElementScroll(event) {
    var target = event && event.target;
    if (!target || target === document || target === root || target === body) {
      onWindowScroll();
      return;
    }
    if (elementScrollProgress(target) === null) return;
    activeScrollElement = target;
    setMotionSource('element-scroll');
    schedule();
  }

  function advanceVirtual(delta, source) {
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.00001) return;
    if (motionSource !== 'wheel' && motionSource !== 'pan') virtualProgress = readProgress();
    virtualProgress = clamp(virtualProgress + delta, 0, 1);
    activeScrollElement = null;
    setMotionSource(source);
    schedule();
  }

  function onWheel(event) {
    if (scrollableAncestor(event && event.target)) return;
    var documentHeight = Math.max(numeric(root.scrollHeight), numeric(body.scrollHeight));
    var documentRange = Math.max(0, documentHeight - numeric(window.innerHeight));
    if (documentRange > 1) return;
    var deltaY = numeric(event && event.deltaY);
    var deltaX = numeric(event && event.deltaX);
    var delta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
    advanceVirtual(delta / Math.max(1200, numeric(window.innerHeight) * 4), 'wheel');
  }

  function onPointerDown(event) {
    if (!event || event.isPrimary === false || scrollableAncestor(event.target) || !panSurface(event.target)) return;
    panPointerId = event.pointerId === undefined ? 0 : event.pointerId;
    panLastX = numeric(event.clientX);
    panLastY = numeric(event.clientY);
    if (motionSource !== 'wheel' && motionSource !== 'pan') virtualProgress = readProgress();
  }

  function onPointerMove(event) {
    var pointerId = event && event.pointerId === undefined ? 0 : event && event.pointerId;
    if (panPointerId === null || !event || pointerId !== panPointerId) return;
    var nextX = numeric(event.clientX);
    var nextY = numeric(event.clientY);
    var deltaX = nextX - panLastX;
    var deltaY = nextY - panLastY;
    panLastX = nextX;
    panLastY = nextY;
    var delta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
    advanceVirtual(delta / Math.max(1200, numeric(window.innerHeight) * 3), 'pan');
  }

  function onPointerEnd(event) {
    var pointerId = event && event.pointerId === undefined ? 0 : event && event.pointerId;
    if (panPointerId !== null && pointerId === panPointerId) panPointerId = null;
  }

  if (reduced) {
    /* Path start is already checked for composed visibility on every surface.
       Route seeds still select a distinct bank/direction/rotation; only motion
       progress is fixed so reduced-motion users get a proven rich still. */
    var stillProgress = 0;
    paintAt(stillProgress);
    layer.setAttribute('data-geometry-motion', 'static-reduced');
    layer.setAttribute('data-geometry-motion-source', 'reduced-motion');
  } else {
    paint();
    layer.setAttribute('data-geometry-motion', 'scroll-responsive');
    window.addEventListener('scroll', onWindowScroll, { passive: true });
    document.addEventListener('scroll', onElementScroll, { passive: true, capture: true });
    document.addEventListener('wheel', onWheel, { passive: true, capture: true });
    document.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
    document.addEventListener('pointerup', onPointerEnd, { passive: true, capture: true });
    document.addEventListener('pointercancel', onPointerEnd, { passive: true, capture: true });
    window.addEventListener('resize', function () {
      lastProgress = -1;
      schedule();
    }, { passive: true });
    window.addEventListener('pageshow', schedule, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) schedule();
      else if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    });
  }

  root.setAttribute('data-geometry-ready', 'true');
  window.PolymythIndra = Object.freeze({
    canonicalId: canonicalId,
    palette: RAINBOW_HEX,
    normalizePath: normalizePath,
    seedOf: seedOf,
    cameraAt: function (progress, secondary) { return cameraPoint(secondary ? 1 : 0, progress); },
    rainbowAt: rainbowColor,
    cameraForKey: function (key, registerName, progress, secondary) {
      var normalized = normalizePath(key);
      var pair = seedPair(normalized, '');
      var isSecondary = !!secondary;
      return cameraPointFor(
        isSecondary ? CAMERA_SECONDARY : CAMERA_PRIMARY,
        isSecondary ? pair.second : pair.first,
        isSecondary ? pair.first : pair.second,
        /^(?:quiet|standard|expressive)$/.test(registerName) ? registerName : routeRegister(normalized),
        isSecondary,
        progress
      );
    },
    cameraForSeed: function (key, explicitSeed, registerName, progress, secondary) {
      var normalized = normalizePath(key);
      var pair = seedPair(normalized, explicitSeed);
      var isSecondary = !!secondary;
      return cameraPointFor(
        isSecondary ? CAMERA_SECONDARY : CAMERA_PRIMARY,
        isSecondary ? pair.second : pair.first,
        isSecondary ? pair.first : pair.second,
        /^(?:quiet|standard|expressive)$/.test(registerName) ? registerName : routeRegister(normalized),
        isSecondary,
        progress
      );
    }
  });
})();
