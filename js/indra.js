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
    ['/main', 'off'],   // home runs its own dual-camera rig
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
    if (!window.PolymythMandala || !window.PolymythMandala.build) return;
    // ONE engine, ONE layer for the whole site. Pages running the bespoke home
    // rig keep theirs (#geo present); '/main' opts out by tier. Everything else
    // mounts the single #indraLayer below. A page's project- color class no
    // longer suppresses the web, since the web is now the only geometry it has.
    if (document.getElementById('geo') || document.getElementById('printCv')) return;
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
    var op = tier === 'prominent' ? 0.5 : 0.40;

    var layer = document.createElement('div');
    layer.id = 'indraLayer';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.opacity = op.toFixed(2);
    layer.style.transformOrigin = '50% 50%';
    layer.innerHTML = window.PolymythMandala.build(canonOpts());
    document.body.appendChild(layer);

    function baseTransform(p) {
      var y = window.scrollY || 0;
      var driftDeg = tier === 'prominent' ? 8 : 6;
      return 'translate(' + fTx.toFixed(1) + 'px,' + (fTy - y * (tier === 'prominent' ? 0.12 : 0.10)).toFixed(1) + 'px)' +
             ' rotate(' + (fRot + p * driftDeg).toFixed(2) + 'deg)' +
             ' scale(' + (fScale + p * 0.18).toFixed(3) + ')';
    }

    if (reduced) { layer.style.transform = baseTransform(0); return; }

    var ticking = false;
    function frame() {
      ticking = false;
      var y = window.scrollY || 0;
      var docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var p = Math.min(1, y / docH);
      layer.style.transform = baseTransform(p);
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    var rT;
    window.addEventListener('resize', function () {
      clearTimeout(rT);
      rT = setTimeout(function () {
        mobile = window.innerWidth < 768;
        layer.innerHTML = window.PolymythMandala.build(canonOpts());
        frame();
        // Rebuild replaced every circle; re-seat the ecosystem on fresh nodes.
        mountEcosystem(layer);
      }, 220);
    }, { passive: true });
    frame();
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
    function paint() {
      for (var k = 0; k < nodes.length; k++) {
        nodes[k].el.classList.toggle('eco-c', strat[k] === 1);
        nodes[k].el.classList.toggle('eco-d', strat[k] === 0);
      }
    }
    var base = mobile ? 2200 : 1600;
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
    // Paint the seeded state once and hold it. The perpetual step loop is
    // disabled because the per-tick class flip read as a flicker at rest.
    paint();
  }

  // Click seeds cooperation at the nearest jewels; attached once for the page.
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
      s.strat[bi] = 1;
      var seeded = 0;
      s.adj[bi].forEach(function (j) { if (seeded < 2) { s.strat[j] = 1; seeded++; } });
      s.paint();
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
