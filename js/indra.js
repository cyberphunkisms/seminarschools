// ============================================================================
// INDRA — site-wide geometric substrate + aliveness bootstrap (June 12 2026)
// One engine, one mathematics (js/mandala.js: Descartes circle theorem,
// complex centers), intensity dialed per page register. Professional pages
// run subtle; experimental pages run prominent. Pages that already mount
// their own mandala (#geo present or inline buildGeo) keep theirs; this
// script only adds the aliveness layer there.
// Bandwidth: this file + alive.css ≈ 6KB total, cached site-wide, no images.
// Motion: transform-only on a fixed compositor layer, rAF-throttled,
// disabled under prefers-reduced-motion.
// ============================================================================
(function () {
  'use strict';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile = window.innerWidth < 768;

  // --- Register map: path prefix → tier ------------------------------------
  // subtle = professional register; prominent = experimental register.
  var TIERS = [
    ['/polymyth/', 'prominent'],
    ['/bookwormcard', 'prominent'],
    ['/bb', 'prominent'],
    ['/campaigns', 'prominent'],
    ['/aa', 'prominent'],
    ['/ohm-dome', 'prominent'],
    ['/agora', 'prominent'],
    ['/florilegium', 'prominent'],
    ['/leizu', 'subtle'],
    ['/saul', 'subtle'],
    ['/apply', 'subtle'],
    ['/polymythseminars', 'subtle'],
    ['/seminars', 'subtle'],
    ['/polymythseminars', 'subtle'],
    ['/teacherresources', 'subtle'],
    ['/marginalia', 'subtle'],
    ['/nutrition', 'subtle'],
    ['/calendar', 'subtle'],
    ['/sitemap', 'subtle'],
    ['/main', 'off'],   // home keeps its bespoke dual-camera rig; every other page gets this animated Indra layer
    ['/', 'subtle']
  ];
  function tierFor(path) {
    if (path === '/' || path === '/index.html') return 'prominent';
    for (var i = 0; i < TIERS.length; i++) {
      if (path === TIERS[i][0] || path.indexOf(TIERS[i][0]) === 0) return TIERS[i][1];
    }
    return 'subtle';
  }

  // Deterministic per-path seed so each page gets a distinct but stable web.
  function seedOf(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
  }

  function mountGeometry() {
    // VISIBLE_GEOMETRY_GUARD: every public page may mount Indra's Web, including CV pages; print hides it in CSS.
    if (!window.PolymythMandala || !window.PolymythMandala.build) return;
    // ONE engine, ONE layer for the whole site. Pages running the bespoke home
    // rig keep theirs (#geo present); '/main' opts out by tier. Everything else
    // mounts the single #indraLayer below. A page's project- color class no
    // longer suppresses the web, since the web is now the only geometry it has.
    if (document.getElementById('geo')) return;
    var tier = tierFor(window.location.pathname);
    if (tier === 'off') return;

    // ONE canonical gasket, byte-identical on every page. Distinctness comes
    // entirely from the per-page FOCUS below: a stable offset, zoom, and
    // rotation into this same gasket. The geometry is the same; each page
    // looks through a different window onto it.
    function canonOpts() {
      return {
        gaskets: [
          { rot: 0,                  scale: 1,                op: 0.62 },
          { rot: Math.PI * 0.42,     scale: 1 / 1.618,        op: 0.46 },
          { rot: Math.PI * 0.78,     scale: 1 / (1.618 * 1.618), op: 0.34 }
        ],
        flowers: !mobile, jewels: true,
        maxDepth: mobile ? 5 : 7, minRadius: mobile ? 2.4 : 0.9
      };
    }

    var seed = seedOf(window.location.pathname);
    // Decorrelated focus params drawn from the path hash, so each page frames a
    // different region of the identical gasket and the framing is stable across
    // reloads. Scroll drifts on top so the substrate is never static.
    var fScale = 1.55 + ((seed % 1000) / 1000) * 1.35;            // 1.55 .. 2.90
    var fTx    = (((seed >>> 10) % 360) - 180);                   // -180 .. 180
    var fTy    = (((seed >>> 19) % 360) - 180);                   // -180 .. 180
    var fRot   = (seed % 360);                                    // 0 .. 360
    // Register sets visibility, not shape: experimental pages read the web
    // louder, professional pages quieter, over the same gasket.
    var requestedOpacity = parseFloat(document.body && document.body.getAttribute('data-indra-intensity'));
    var op = Number.isFinite(requestedOpacity) ? Math.max(0.045, Math.min(0.24, requestedOpacity)) : (tier === 'prominent' ? 0.18 : 0.105);

    var layer = document.createElement('div');
    layer.id = 'indraLayer';
    layer.setAttribute('aria-hidden', 'true');
    // The home page can adjust this variable when a constellation project is selected.
    layer.style.opacity = 'var(--indra-opacity, ' + op.toFixed(3) + ')';
    layer.style.transformOrigin = '50% 50%';
    layer.innerHTML = window.PolymythMandala.build(canonOpts());
    document.body.appendChild(layer);

    // The geometry follows a SMOOTHED scroll value, not the raw one, so it glides
    // instead of stepping with each discrete wheel tick. A per-frame approach toward
    // the real scrollY is an exponential ease-out, the same character as the home
    // rig's Lenis easing. curY chases scrollY; the loop sleeps once it settles.
    // Breathing parameters: slow enough to feel like sleep, not motion.
    var BREATH_PERIOD = 10000;   // 10s full cycle
    var BREATH_SCALE  = 0.003;   // ±0.003 scale oscillation
    var BREATH_ROT    = 0.25;    // ±0.25° rotation oscillation (sway)
    var BREATH_X      = 0.4;     // ±0.4px lateral sway
    var BREATH_Y      = 0.3;     // ±0.3px vertical sway
    var SPIN_RATE     = 360 / 420000; // deg/ms -> ~7min per full turn, slow CW
    var TWO_PI = Math.PI * 2;

    // Cursor lean state (computed in tick, fed by mousemove listener below)
    var mouseX = 0, mouseY = 0, leanX = 0, leanY = 0;
    var LEAN_EASE = 0.008, LEAN_DEG = 0.15, LEAN_PX = 0.8;

    // Tidal pulse target (SVG element, set after layer is appended)
    var tidalSvg = null;
    var TIDAL_PERIOD = 20000, TIDAL_AMP = 0.001;

    function transformFor(y, t) {
      var docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var p = Math.min(1, y / docH);
      var driftDeg = tier === 'prominent' ? 8 : 3;
      // Time-based breath: two detuned sine waves for organic irregularity
      var phase1 = t / BREATH_PERIOD * TWO_PI;
      var phase2 = t / (BREATH_PERIOD * 1.37) * TWO_PI; // detuned golden ratio
      var bScale = Math.sin(phase1) * BREATH_SCALE;
      var bRot   = Math.cos(phase2) * BREATH_ROT;
      var bX     = Math.sin(phase2) * BREATH_X;
      var bY     = Math.cos(phase1 * 0.7) * BREATH_Y;
      var spin   = (t * SPIN_RATE) % 360; // slow continuous monotonic rotation
      var tx = fTx + bX;
      var ty = fTy - y * (tier === 'prominent' ? 0.14 : 0.075) + bY;
      var rot = fRot + p * driftDeg + bRot + spin;
      var sc = fScale + p * 0.18 + bScale;
      return 'translate(' + (tx + leanX * LEAN_PX).toFixed(2) + 'px,' + (ty + leanY * LEAN_PX).toFixed(2) + 'px)' +
             ' rotate(' + (rot + leanX * LEAN_DEG).toFixed(3) + 'deg)' +
             ' scale(' + sc.toFixed(4) + ')';
    }

    if (reduced) { layer.style.transform = transformFor(window.scrollY || 0, 0); return; }

    var curY = window.scrollY || 0;
    var raf = 0;
    var EASE = 0.085;
    var lastMotion = Date.now();
    var IDLE_AFTER = 100000000;
    // The layer stays softly alive while the page is visible, matching the main page
    // background: slow breathing, slow spin, no hard stop after a click.
    function tick() {
      raf = 0;
      if (document.hidden) return;
      var now = Date.now();
      var target = window.scrollY || 0;
      curY += (target - curY) * EASE;
      if (Math.abs(target - curY) < 0.15) { curY = target; }
      leanX += (mouseX - leanX) * LEAN_EASE;
      leanY += (mouseY - leanY) * LEAN_EASE;
      layer.style.transform = transformFor(curY, now);
      if (tidalSvg) {
        var tt = now / TIDAL_PERIOD * Math.PI * 2;
        tidalSvg.style.transform = 'scale(' + (1 + Math.sin(tt) * TIDAL_AMP).toFixed(5) + ')';
      }
      if (Math.abs(target - curY) > 0.15 || Math.abs(mouseX - leanX) > 0.003 || Math.abs(mouseY - leanY) > 0.003 || now - lastMotion < IDLE_AFTER) {
        raf = requestAnimationFrame(tick);
      }
    }
    function kick() {
      lastMotion = Date.now();
      layer.style.transform = transformFor(window.scrollY || 0, lastMotion);
      if (!raf && !document.hidden) { raf = requestAnimationFrame(tick); }
    }
    window.addEventListener('scroll', kick, { passive: true });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
    kick();
    var rT;
    window.addEventListener('resize', function () {
      clearTimeout(rT);
      rT = setTimeout(function () {
        mobile = window.innerWidth < 768;
        layer.innerHTML = window.PolymythMandala.build(canonOpts());
        curY = window.scrollY || 0;
        layer.style.transform = transformFor(curY);
        // Rebuild replaced every circle; re-seat the ecosystem on fresh nodes.
        mountEcosystem(layer);
      }, 220);
    }, { passive: true });

    // Assign tidal SVG target (vars declared above, before tick)
    tidalSvg = layer.querySelector('svg');

    // Cursor lean: the web tilts imperceptibly toward the pointer.
    document.addEventListener('mousemove', function(e) {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      kick();
    }, { passive: true });
    // Lean is computed inside the unified tick loop below.
  }

  // --- Click ripple: interaction enters the web itself ----------------------
  function mountRipple() {
    if (reduced) return;
    document.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      var r = document.createElement('span');
      r.className = 'indra-ripple';
      r.style.left = e.clientX + 'px';
      r.style.top = e.clientY + 'px';
      document.body.appendChild(r);
      setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 700);
    }, { passive: true });
  }

  // --- Reveal-on-scroll aliveness -------------------------------------------
  // Conservative targets only; .iv-pre is applied by JS so no-JS users see
  // everything. Transform+opacity only.
  function mountReveal() {
    if (reduced || !('IntersectionObserver' in window)) return;
    var sel = 'main section, main article, .card, .entry, .lecture, .event, .sec, .block-card, .tile, .faq-item, .leg-item, .tier-table, .preamble, blockquote, figure, .leaves li';
    var els = document.querySelectorAll(sel);
    if (!els.length || els.length > 400) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('iv-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight) { el.classList.add('iv-in'); return; }
      el.classList.add('iv-pre');
      io.observe(el);
    });
  }

  // --- ECOSYSTEM: spatial prisoner's dilemma on the web itself -------------
  // The gasket's tangency graph is the habitat. Each suitable circle is an
  // agent playing C or D against its tangent neighbors (Nowak-May payoffs,
  // b = 1.65, the regime of persistent dynamic mosaics). Cooperator clusters
  // bloom (fill), defector fronts fade them; the mosaic never freezes and
  // never collapses. Gestures perturb it: a click seeds cooperation at the
  // nearest jewels, fast scrolling raises the world's tempo for a moment.
  function ecoStep(strat, adj, b, rand) {
    var n = strat.length;
    var pay = new Array(n).fill(0);
    // Snowdrift (hawk-dove) payoffs, cost-to-benefit ratio r = b:
    //   C-C: 1 each.  C-D: C gets 1-r, D gets 1+r.  D-D: 0.
    // Chosen over the literal prisoner's dilemma after proof runs showed PD
    // fixating to all-defect on this small sparse habitat under every
    // standard dynamics. Snowdrift's interior equilibrium (cooperator
    // fraction 1-r in the well-mixed limit) is a coexistence attractor:
    // the ecosystem holds its balance and churns forever by construction.
    for (var i = 0; i < n; i++) {
      var nb = adj[i];
      for (var k = 0; k < nb.length; k++) {
        var j = nb[k];
        if (strat[i] === 1) { pay[i] += (strat[j] === 1) ? 1 : (1 - b); }
        else { if (strat[j] === 1) pay[i] += (1 + b); }
      }
    }
    // Degree-normalized (average) payoff: on the gasket's heterogeneous
    // sparse graph, raw totals hand defectors the table (Santos-Pacheco).
    for (var d0 = 0; d0 < n; d0++) { if (adj[d0].length) pay[d0] /= adj[d0].length; }
    // Fermi pairwise comparison (Szabo-Toke): each agent compares against ONE
    // random neighbor and adopts that strategy with probability
    // 1/(1+exp(-(payNb-payMe)/K)). Stochastic selection at temperature K is
    // what sustains cooperator-defector coexistence on sparse graphs, where
    // deterministic best-response fixates. Mutation keeps the mosaic moving.
    var K = 0.25;
    var next = new Array(n);
    for (var i2 = 0; i2 < n; i2++) {
      next[i2] = strat[i2];
      var nb2 = adj[i2];
      if (nb2.length) {
        var pick = nb2[Math.floor(rand() * nb2.length)];
        var prob = 1 / (1 + Math.exp(-(pay[pick] - pay[i2]) / K));
        if (rand() < prob) next[i2] = strat[pick];
      }
      if (rand() < 0.02) next[i2] = 1 - next[i2];
    }
    return next;
  }

  // Gesture listeners attach ONCE (see end of file), reading the live mount
  // through these holders so resize re-mounts swap state instead of stacking
  // new window listeners.
  var ecoTimer = null, ecoState = null;

  function mountEcosystem(layer) {
    if (reduced || !layer) return;
    if (ecoTimer) { clearTimeout(ecoTimer); ecoTimer = null; }
    var svg = layer.querySelector('svg');
    if (!svg) { ecoState = null; return; }
    var all = Array.prototype.slice.call(svg.querySelectorAll('circle'));
    var cap = mobile ? 50 : 120;
    var nodes = all.map(function (c) {
      return { el: c, x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r') };
    }).filter(function (n) { return n.r >= 2.5 && n.r <= 90; }).slice(0, cap);
    if (nodes.length < 12) { ecoState = null; return; }
    var adj = nodes.map(function () { return []; });
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        var sum = nodes[i].r + nodes[j].r;
        if (Math.abs(d - sum) < 0.18 * sum ||
            Math.abs(d - Math.abs(nodes[i].r - nodes[j].r)) < 0.6) {
          adj[i].push(j); adj[j].push(i);
        }
      }
    }
    var seed = seedOf(window.location.pathname);
    var strat = nodes.map(function () {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return (seed / 4294967296) < 0.85 ? 1 : 0;
    });
    // Assign depth-band classes for opacity layering + phase stagger
    for (var b = 0; b < nodes.length; b++) {
      var r = nodes[b].r;
      nodes[b].el.classList.add(r > 30 ? 'depth-far' : r > 10 ? 'depth-mid' : 'depth-near');
    }
    function paint() {
      for (var k = 0; k < nodes.length; k++) {
        nodes[k].el.classList.toggle('eco-c', strat[k] === 1);
        nodes[k].el.classList.toggle('eco-d', strat[k] === 0);
      }
    }
    var base = mobile ? 10000 : 8000;
    var hot = 0;
    // Published state the once-attached gesture listeners read and mutate.
    ecoState = {
      svg: svg, nodes: nodes, adj: adj, strat: strat, paint: paint,
      bumpTempo: function () { hot = 4; }
    };
    function tick() {
      if (!document.hidden) { strat = ecoStep(strat, adj, 0.3, Math.random); ecoState.strat = strat; paint(); }
      var tempo = hot > 0 ? base * 0.45 : base; hot = Math.max(0, hot - 1);
      ecoTimer = setTimeout(tick, tempo);
    }
    // Glacial ecosystem: steps every 8 seconds so changes are almost
    // imperceptible. The old fast loop flickered; this one drifts.
    paint();
    tick();
  }

  // Click reveals tangent connections near the touch point, then dissolves.
  // Also seeds cooperation at the nearest jewels (ecosystem interaction).
  document.addEventListener('pointerdown', function (e) {
    if (reduced || !ecoState || (e.button && e.button !== 0)) return;
    var s = ecoState, svg = s.svg;
    var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    var m = svg.getScreenCTM(); if (!m) return;
    var p = pt.matrixTransform(m.inverse());
    var bi = -1, bd = Infinity;
    for (var k = 0; k < s.nodes.length; k++) {
      var d = Math.hypot(s.nodes[k].x - p.x, s.nodes[k].y - p.y);
      if (d < bd) { bd = d; bi = k; }
    }
    if (bi >= 0) {
      // Seed cooperation
      s.strat[bi] = 1;
      var seeded = 0;
      s.adj[bi].forEach(function (j) { if (seeded < 2) { s.strat[j] = 1; seeded++; } });
      s.paint();
      // Reveal tangent lines from this node to its neighbors
      var ns = 'http://www.w3.org/2000/svg';
      var lines = [];
      s.adj[bi].forEach(function (j) {
        var line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', s.nodes[bi].x);
        line.setAttribute('y1', s.nodes[bi].y);
        line.setAttribute('x2', s.nodes[j].x);
        line.setAttribute('y2', s.nodes[j].y);
        line.setAttribute('stroke', 'currentColor');
        line.setAttribute('stroke-width', '0.3');
        line.style.opacity = '0';
        line.style.transition = 'opacity 0.8s ease-in';
        svg.appendChild(line);
        lines.push(line);
        // Fade in
        requestAnimationFrame(function() { line.style.opacity = '0.06'; });
      });
      // Dissolve after 2 seconds
      setTimeout(function() {
        lines.forEach(function(l) { l.style.transition = 'opacity 4s ease-out'; l.style.opacity = '0'; });
        // Remove from DOM after fade
        setTimeout(function() {
          lines.forEach(function(l) { if (l.parentNode) l.parentNode.removeChild(l); });
        }, 4500);
      }, 2000);
    }
  }, { passive: true });

  // Fast scroll briefly quickens the world; attached once for the page.
  var ecoLastY = 0;
  window.addEventListener('scroll', function () {
    if (reduced || !ecoState) return;
    var y = window.scrollY || 0;
    if (Math.abs(y - ecoLastY) > 220) ecoState.bumpTempo();
    ecoLastY = y;
  }, { passive: true });

  function boot() {
    mountGeometry();
    mountEcosystem(document.getElementById('indraLayer'));
    mountRipple();
    mountReveal();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
