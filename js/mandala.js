// ============================================================================
// POLYMYTH MANDALA — APOLLONIAN GASKETS + INDRA'S NET
// Ported from seminarschools.com home page generator. Same substrate,
// per-project parameterization. Each project page calls buildMandala(opts).
//
// opts: {
//   gaskets: [{rot, scale, op}, ...]  — array of gasket configs (1-3+)
//   flowers: bool                       — petal blooms at tangent points
//   jewels: bool                        — Indra's Net at cross-gasket near-tangencies
//   maxDepth: int                       — recursion depth (default 7)
//   minRadius: float                    — smallest circle radius (default 0.4)
// }
// ============================================================================

(function(global) {
  const PHI = 1.6180339887;

  function descartesCurvature(k1, k2, k3, sign) {
    const s = k1*k2 + k2*k3 + k1*k3;
    return s < 0 ? null : k1 + k2 + k3 + sign * 2 * Math.sqrt(s);
  }

  function descartesCenter(c1, c2, c3, k4, sign) {
    const z1r=c1.x*c1.k, z1i=c1.y*c1.k;
    const z2r=c2.x*c2.k, z2i=c2.y*c2.k;
    const z3r=c3.x*c3.k, z3i=c3.y*c3.k;
    const sr=z1r+z2r+z3r, si=z1i+z2i+z3i;
    const p12r=z1r*z2r-z1i*z2i, p12i=z1r*z2i+z1i*z2r;
    const p23r=z2r*z3r-z2i*z3i, p23i=z2r*z3i+z2i*z3r;
    const p13r=z1r*z3r-z1i*z3i, p13i=z1r*z3i+z1i*z3r;
    const ir=p12r+p23r+p13r, ii=p12i+p23i+p13i;
    const mag=Math.sqrt(ir*ir+ii*ii), sm=Math.sqrt(mag), ha=Math.atan2(ii,ir)/2;
    const sqr=sm*Math.cos(ha), sqi=sm*Math.sin(ha);
    return { x:(sr+sign*2*sqr)/k4, y:(si+sign*2*sqi)/k4 };
  }

  function buildGasket(rot, scale, maxDepth, minRadius) {
    const circles = [];
    const R = 300 * scale;
    const rIn = R * Math.sqrt(3) / (Math.sqrt(3) + 2);
    const dC = 2 * rIn / Math.sqrt(3);
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    function rotPt(x, y) { return { x: x*cosR - y*sinR, y: x*sinR + y*cosR }; }

    const c0p = rotPt(0, 0);
    const seed = [{ x:c0p.x, y:c0p.y, k:-1/R, d:0 }];
    for (let i = 0; i < 3; i++) {
      const a = (i/3)*Math.PI*2 - Math.PI/2;
      const p = rotPt(Math.cos(a)*dC, Math.sin(a)*dC);
      seed.push({ x:p.x, y:p.y, k:1/rIn, d:0 });
    }
    seed.forEach(c => circles.push(c));

    const seen = new Set();
    const cKey = (x,y,r) => `${Math.round(x*8)},${Math.round(y*8)},${Math.round(r*8)}`;

    function fillGap(a, b, c, depth) {
      if (depth > maxDepth) return;
      const k4 = descartesCurvature(a.k, b.k, c.k, 1);
      if (k4 === null || k4 <= 0) return;
      const r4 = 1/k4;
      if (r4 < minRadius) return;
      const cen = descartesCenter(a, b, c, k4, 1);
      const key = cKey(cen.x, cen.y, r4);
      if (seen.has(key)) return;
      seen.add(key);
      const ok = [a,b,c].every(p => {
        const dd = Math.sqrt((cen.x-p.x)**2+(cen.y-p.y)**2);
        const rp = 1/Math.abs(p.k);
        const target = p.k < 0 ? Math.abs(rp-r4) : rp+r4;
        return Math.abs(dd-target) < Math.max(2, target*0.1);
      });
      if (!ok) return;
      const nc = { x:cen.x, y:cen.y, k:k4, d:depth };
      circles.push(nc);
      fillGap(a,b,nc,depth+1); fillGap(b,c,nc,depth+1); fillGap(a,c,nc,depth+1);
    }

    fillGap(seed[0],seed[1],seed[2],1);
    fillGap(seed[0],seed[2],seed[3],1);
    fillGap(seed[0],seed[1],seed[3],1);
    fillGap(seed[1],seed[2],seed[3],1);

    return circles;
  }

  function buildMandala(opts) {
    opts = opts || {};
    const gaskets = opts.gaskets || [
      { rot: 0,             scale: 1,            op: 0.78 },
      { rot: Math.PI*0.42,  scale: 1/PHI,        op: 0.58 },
      { rot: Math.PI*0.78,  scale: 1/(PHI*PHI),  op: 0.42 }
    ];
    const useFlowers = opts.flowers !== false;
    const useJewels = opts.jewels !== false;
    const maxDepth = opts.maxDepth || 7;
    const minRadius = opts.minRadius || 0.4;
    const offsetX = opts.offsetX || 0;
    const offsetY = opts.offsetY || 0;
    const useSpiral = opts.spiral === true;
    const centerVoid = opts.centerVoid || 0;
    const useVines = opts.vines === true;

    let geom = `<defs>
      <radialGradient id="jewelCore" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
        <stop offset="25%" stop-color="currentColor" stop-opacity="0.85"/>
        <stop offset="70%" stop-color="currentColor" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="currentColor" stop-opacity="0.25"/>
      </radialGradient>
    </defs>`;

    // Two rotation groups: depth-even circles spin one way, depth-odd the
    // other. Each <g> turns around the shared SVG center via its own CSS var,
    // driven opposite-handed in the mandala rAF loop. Interleaved gasket rings
    // therefore rotate against each other instead of as one rigid disc.
    let geomCW = '';   // depth-even -> group A
    let geomCCW = '';  // depth-odd  -> group B
    const allCircles = [];
    const flowerPositions = [];

    gaskets.forEach((g, gIdx) => {
      const circles = buildGasket(g.rot, g.scale, maxDepth, minRadius);
      circles.forEach(c => {
        const r = 1/Math.abs(c.k);
        // Skip circles inside the centerVoid radius (sabachtan: gnostic spark void)
        if (centerVoid > 0) {
          const dCenter = Math.sqrt(c.x*c.x + c.y*c.y);
          if (c.k > 0 && dCenter < centerVoid && r < centerVoid * 0.7) return;
        }
        const sw = c.k<0 ? 0.5 : Math.max(0.18, 0.75-(c.d||0)*0.07);
        const op = c.k<0 ? g.op*0.5 : Math.max(0.32, g.op - (c.d||0)*0.045);
        const x = (c.x + offsetX).toFixed(1);
        const y = (c.y + offsetY).toFixed(1);
        const circleSvg = `<circle class="geo-stroke" cx="${x}" cy="${y}" r="${r.toFixed(1)}" stroke-width="${sw.toFixed(2)}" opacity="${op.toFixed(2)}" fill="none"/>`;
        // Depth parity routes the circle to one of the two counter-rotating
        // groups. The bounding ring (k<0) stays in group A so the frame holds.
        if ((c.d || 0) % 2 === 0 || c.k < 0) { geomCW += circleSvg; } else { geomCCW += circleSvg; }
        if (r > 2) {
          for (let i = 0; i < 8; i++) {
            const a = (i/8)*Math.PI*2;
            allCircles.push({ x: c.x+offsetX+Math.cos(a)*r, y: c.y+offsetY+Math.sin(a)*r, g: gIdx });
          }
        }
      });

      if (useFlowers) {
        for (let i = 0; i < circles.length; i++) {
          const ci = circles[i];
          const ri = 1/Math.abs(ci.k);
          if (ri < 4) continue;
          for (let j = i+1; j < circles.length; j++) {
            const cj = circles[j];
            const rj = 1/Math.abs(cj.k);
            if (rj < 4) continue;
            const dx = cj.x-ci.x, dy = cj.y-ci.y;
            const dist = Math.sqrt(dx*dx+dy*dy);
            const targetExt = ri+rj;
            const targetInt = Math.abs(ri-rj);
            const isExtTangent = Math.abs(dist-targetExt) < Math.max(1.5, targetExt*0.06);
            const isIntTangent = Math.abs(dist-targetInt) < Math.max(1.5, targetInt*0.06);
            if (!isExtTangent && !isIntTangent) continue;
            const t = isExtTangent ? ri/dist : (ci.k<0 ? -ri/dist : ri/dist);
            const tx = ci.x + dx*t + offsetX;
            const ty = ci.y + dy*t + offsetY;
            const depth = Math.max(ci.d||0, cj.d||0);
            const flowerR = Math.min(ri, rj) * 0.35;
            if (flowerR < 1.5) continue;
            const nPetals = depth < 2 ? 7 : depth < 4 ? 6 : 5;
            const rotOff = (tx * 0.1 + ty * 0.07 + depth * 0.5);
            const flowerOp = Math.max(0.18, g.op * 0.55 - depth * 0.04);
            const flowerSw = Math.max(0.12, 0.38 - depth * 0.035);
            let petals = '';
            for (let p = 0; p < nPetals; p++) {
              const a = (p / nPetals) * Math.PI * 2 + rotOff;
              const dirX = Math.cos(a), dirY = Math.sin(a);
              const perpX = -dirY, perpY = dirX;
              const baseW = flowerR * 0.28;
              const sx = tx + perpX*baseW, sy = ty + perpY*baseW;
              const ex = tx - perpX*baseW, ey = ty - perpY*baseW;
              const tipX = tx + dirX*flowerR, tipY = ty + dirY*flowerR;
              petals += `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${tipX.toFixed(1)} ${tipY.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)} `;
            }
            geom += `<path class="geo-stroke" d="${petals}" stroke-width="${flowerSw.toFixed(2)}" opacity="${flowerOp.toFixed(2)}" fill="none"/>`;
            const dotR = Math.max(0.4, flowerR * 0.1);
            geom += `<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${dotR.toFixed(1)}" fill="currentColor" opacity="${(flowerOp*0.9).toFixed(2)}"/>`;
            flowerPositions.push({ x: tx, y: ty, r: flowerR, op: flowerOp });
          }
        }
      }
    });

    // Vines — bezier curves between adjacent flower pairs (nutrition)
    if (useVines && flowerPositions.length > 1) {
      const VINE_MAX_DIST = 60;
      const VINE_MIN_DIST = 12;
      for (let i = 0; i < flowerPositions.length; i++) {
        for (let j = i+1; j < flowerPositions.length; j++) {
          const a = flowerPositions[i], b = flowerPositions[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < VINE_MIN_DIST || dist > VINE_MAX_DIST) continue;
          // Quadratic bezier with curved control point perpendicular to midpoint
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const perpX = -dy / dist, perpY = dx / dist;
          const curveAmount = dist * 0.18 * (((i + j) % 2) ? 1 : -1);
          const cx = mx + perpX * curveAmount;
          const cy = my + perpY * curveAmount;
          const op = Math.min(a.op, b.op) * 0.55;
          geom += `<path class="geo-stroke" d="M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}" stroke-width="0.35" opacity="${op.toFixed(2)}" fill="none"/>`;
        }
      }
    }

    // Spiral — logarithmic golden spiral from outer rim toward center (agora)
    if (useSpiral) {
      const turns = 3.2;
      const samples = 220;
      const phi_local = 1.6180339887;
      const b_log = Math.log(phi_local) / (Math.PI / 2);
      const a_log = 280;
      let path = '';
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const theta = -t * turns * Math.PI * 2;
        const r = a_log * Math.exp(b_log * theta);
        if (r < 1.5) break;
        const px = (r * Math.cos(theta)).toFixed(1);
        const py = (r * Math.sin(theta)).toFixed(1);
        path += (i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`);
      }
      geom += `<path class="geo-stroke" d="${path}" stroke-width="0.45" opacity="0.32" fill="none"/>`;
    }

    if (useJewels) {
      const PROX = 4, CELL = PROX*2;
      const grid = new Map();
      allCircles.forEach((p,i) => {
        const k = `${Math.floor(p.x/CELL)},${Math.floor(p.y/CELL)}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      });
      const candidates = [];
      for (let i = 0; i < allCircles.length; i++) {
        const p = allCircles[i];
        const cx = Math.floor(p.x/CELL), cy = Math.floor(p.y/CELL);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const cell = grid.get(`${cx+dx},${cy+dy}`);
            if (!cell) continue;
            for (const j of cell) {
              if (j <= i) continue;
              const q = allCircles[j];
              if (q.g === p.g) continue;
              const ddx=p.x-q.x, ddy=p.y-q.y;
              if (ddx*ddx+ddy*ddy < PROX*PROX) {
                candidates.push({ x:(p.x+q.x)/2, y:(p.y+q.y)/2 });
              }
            }
          }
        }
      }
      const jewels = [];
      const JSEP = 8;
      candidates.forEach(c => {
        if (!jewels.some(e => (c.x-e.x)**2+(c.y-e.y)**2 < JSEP*JSEP)) jewels.push(c);
      });
      jewels.forEach(j => {
        const d = Math.sqrt(j.x*j.x+j.y*j.y);
        const r = d < 80 ? 2.6 : d < 200 ? 2.0 : 1.4;
        const x = j.x.toFixed(1), y = j.y.toFixed(1);
        geom += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="url(#jewelCore)" opacity="0.85"/>`;
        const hx = (j.x - r*0.35).toFixed(1), hy = (j.y - r*0.35).toFixed(1);
        geom += `<circle cx="${hx}" cy="${hy}" r="${(r*0.28).toFixed(2)}" fill="#ffffff" opacity="0.75"/>`;
      });
    }

    // The two gasket-circle groups rotate opposite-handed around the shared
    // center (0,0 in this centered viewBox). transform-box ensures the
    // rotation pivots on the SVG origin, not each group's bounding box.
    const groupA = `<g class="spin-a" style="transform-box:view-box;transform-origin:0 0;transform:rotate(var(--spin-a,0deg));">${geomCW}</g>`;
    const groupB = `<g class="spin-b" style="transform-box:view-box;transform-origin:0 0;transform:rotate(var(--spin-b,0deg));">${geomCCW}</g>`;
    return `<svg viewBox="-380 -380 760 760" xmlns="http://www.w3.org/2000/svg">${groupA}${groupB}${geom}</svg>`;
  }

  // Per-project parameter presets — same substrate, different jazz
  const PRESETS = {
    agora: {
      // Three full gaskets + golden spiral overlay (path of inquiry)
      gaskets: [
        { rot: 0,                   scale: 1,            op: 0.78 },
        { rot: Math.PI * 0.42,      scale: 1/PHI,        op: 0.58 },
        { rot: Math.PI * 0.78,      scale: 1/(PHI*PHI),  op: 0.42 }
      ],
      flowers: true, jewels: true, maxDepth: 7,
      spiral: true
    },
    'sabachtan-seminar': {
      // Two gaskets + center void (the gnostic spark sought, not given)
      gaskets: [
        { rot: Math.PI * 0.15,      scale: 1,            op: 0.85 },
        { rot: Math.PI * 0.65,      scale: 1/PHI,        op: 0.65 }
      ],
      flowers: false, jewels: true, maxDepth: 6,
      centerVoid: 55
    },
    'devils-notebook': {
      // Dense interlocked gaskets, oxblood register, jewels prominent: the
      // diary substrate. Experimental tier, dark page, the web reads as
      // line-work in ember on warm black.
      gaskets: [
        { rot: Math.PI * 0.2,       scale: 1,            op: 0.88 },
        { rot: Math.PI * 0.62,      scale: 1/PHI,        op: 0.64 },
        { rot: Math.PI * 0.93,      scale: 1/(PHI*PHI),  op: 0.46 }
      ],
      flowers: true, jewels: true, maxDepth: 7
    },
    'ohm-dome': {
      // Three at hexagonal symmetry — dome-like, flowers minimal, jewels at vertices
      gaskets: [
        { rot: 0,                   scale: 1,            op: 0.85 },
        { rot: Math.PI / 3,         scale: 1/PHI,        op: 0.55 },
        { rot: 2 * Math.PI / 3,     scale: 1/(PHI*PHI),  op: 0.40 }
      ],
      flowers: false, jewels: true, maxDepth: 6
    },
    nutrition: {
      // Three gaskets + abundant flowers + vines connecting blooms
      gaskets: [
        { rot: Math.PI * 0.1,       scale: 1,            op: 0.72 },
        { rot: Math.PI * 0.48,      scale: 1/PHI,        op: 0.58 },
        { rot: Math.PI * 0.83,      scale: 1/(PHI*PHI),  op: 0.45 }
      ],
      flowers: true, jewels: true, maxDepth: 7,
      vines: true
    },
    marginalia: {
      // Two gaskets, marginal positioning, sparse
      gaskets: [
        { rot: Math.PI * 0.22,      scale: 1.05,         op: 0.72 },
        { rot: Math.PI * 0.7,       scale: 1/(PHI*1.2),  op: 0.5 }
      ],
      flowers: true, jewels: true, maxDepth: 6
    },
    teacherresources: {
      // Single gasket, low recursion, no flowers — orderly catalog
      gaskets: [
        { rot: 0,                   scale: 1.1,          op: 0.7 }
      ],
      flowers: false, jewels: false, maxDepth: 5
    },
    florilegium: {
      // Two gaskets at different scales — anthology layering
      gaskets: [
        { rot: Math.PI * 0.18,      scale: 1.1,          op: 0.72 },
        { rot: Math.PI * 0.85,      scale: 1/(PHI*PHI),  op: 0.5 }
      ],
      flowers: true, jewels: true, maxDepth: 6
    }
  };


  // ============================================================================
  // SECTION-AWARE CAMERA SCROLL — ported from home page
  // Two independent cameras moving through the gasket as reader descends.
  // Per-section camera positions create moiré at the journey level.
  // ============================================================================
  
  function smoothstep(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  
  // Camera path: zoom in deep, pan around the gasket, zoom out
  // Same path for every project; each project's gasket is what's unique
  const CAMERA_PRIMARY = [
    { x:   60, y:   15, zoom: 2.0, density: 0.28 },
    { x:   20, y:  -15, zoom: 1.8, density: 0.30 },
    { x:    5, y:  -65, zoom: 3.0, density: 0.28 },
    { x:    0, y:   25, zoom: 3.6, density: 0.28 },
    { x:  -55, y:   25, zoom: 2.5, density: 0.30 },
    { x:  -30, y:   60, zoom: 3.2, density: 0.28 },
    { x:   10, y:   -5, zoom: 2.0, density: 0.28 },
    { x:   35, y:  -50, zoom: 2.7, density: 0.28 },
    { x:   60, y:   15, zoom: 2.0, density: 0.28 }
  ];
  const CAMERA_SECONDARY = [
    { x:  -50, y:   20, zoom: 1.8, density: 0.14 },
    { x:    0, y:   25, zoom: 2.4, density: 0.16 },
    { x:   40, y:   50, zoom: 2.4, density: 0.14 },
    { x:  -60, y:  -40, zoom: 2.1, density: 0.14 },
    { x:   20, y:  -55, zoom: 2.7, density: 0.16 },
    { x:   50, y:  -15, zoom: 2.4, density: 0.14 },
    { x:  -40, y:   50, zoom: 2.7, density: 0.14 },
    { x:  -20, y:   10, zoom: 2.1, density: 0.14 },
    { x:  -50, y:   20, zoom: 1.8, density: 0.14 }
  ];
  
  function initCameraScroll(opts) {
    opts = opts || {};
    const sections = Array.prototype.slice.call(document.querySelectorAll('section'));
    // Section-aware camera needs at least two sections to interpolate between.
    // With zero or one section, or when a page asks for it, the camera sweeps
    // the whole path across the full page scroll instead, so the substrate is
    // never static on a scrollable page regardless of its section markup.
    const useSections = !opts.forceGlobal && sections.length >= 2;
    const root = document.documentElement.style;

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Continuous aliveness constants -----------------------------------
    // The gasket never freezes. Two layers turn against each other (primary
    // clockwise, secondary counter-clockwise) so the moire between them is the
    // Indra-net reflection made visible. Barely perceptible: ~5 minutes per
    // full turn. Idle breath rides on top as a slow scale/translate wobble so
    // a still page reads as sleeping, not stopped.
    const ROT_PRIMARY   = 360 / 300000;  // deg per ms -> ~300s per full turn, CW
    const ROT_SECONDARY = -360 / 360000; // deg per ms -> ~360s per full turn, CCW
    const SPIN_GROUP_A  = 360 / 480000;  // depth-even circles, CW, ~8min/turn
    const SPIN_GROUP_B  = -360 / 540000; // depth-odd circles, CCW, ~9min/turn
    const BREATH_PERIOD = 11000;          // 11s breath cycle
    const BREATH_SCALE  = 0.012;          // ±1.2% scale wobble, primary
    const BREATH_SCALE2 = 0.016;          // ±1.6% scale wobble, secondary (detuned)
    const BREATH_TX     = 5;              // ±5px lateral sway, primary
    const BREATH_TY     = 4;              // ±4px vertical sway, primary
    const TWO_PI = Math.PI * 2;

    // Smoothed camera state the rAF loop writes every frame. Scroll updates
    // the *target*; the loop eases toward it so the camera glides and the
    // rotation/breath ride continuously on top.
    let curScale = 1.4, curTx = 0, curTy = 0, curDensity = 0.08;
    let curScale2 = 1.1, curTx2 = 60, curTy2 = -40, curDensity2 = 0.04;
    let tScale = curScale, tTx = curTx, tTy = curTy, tDensity = curDensity;
    let tScale2 = curScale2, tTx2 = curTx2, tTy2 = curTy2, tDensity2 = curDensity2;
    const EASE = 0.06;

    function locate() {
      if (useSections) {
        const viewportMid = window.scrollY + window.innerHeight * 0.4;
        let currentIdx = 0, local = 0;
        for (let i = 0; i < sections.length; i++) {
          const r = sections[i].getBoundingClientRect();
          const top = r.top + window.scrollY;
          const bottom = top + r.height;
          if (viewportMid >= top && viewportMid < bottom) {
            currentIdx = i;
            local = Math.max(0, Math.min(1, (viewportMid - top) / r.height));
            break;
          }
          if (viewportMid >= bottom) currentIdx = i;
        }
        return { idx: currentIdx, t: local };
      }
      const docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = Math.max(0, Math.min(1, (window.scrollY || 0) / docH));
      const span = Math.max(1, CAMERA_PRIMARY.length - 1);
      const f = p * span;
      const idx = Math.min(span - 1, Math.floor(f));
      return { idx: idx, t: f - idx };
    }

    // Recompute the scroll-driven camera *targets* (cheap, on scroll only).
    // Also writes the vars synchronously so the camera responds to scroll even
    // in environments without rAF; the persistent loop eases+rotates on top.
    function setTargets() {
      const loc = locate();
      const currentIdx = loc.idx;
      const ease = smoothstep(loc.t);

      const cur = CAMERA_PRIMARY[currentIdx % CAMERA_PRIMARY.length];
      const nxt = CAMERA_PRIMARY[(currentIdx + 1) % CAMERA_PRIMARY.length];
      tScale   = cur.zoom + (nxt.zoom - cur.zoom) * ease;
      tTx      = cur.x + (nxt.x - cur.x) * ease;
      tTy      = cur.y + (nxt.y - cur.y) * ease;
      tDensity = cur.density + (nxt.density - cur.density) * ease;

      const cur2 = CAMERA_SECONDARY[currentIdx % CAMERA_SECONDARY.length];
      const nxt2 = CAMERA_SECONDARY[(currentIdx + 1) % CAMERA_SECONDARY.length];
      tScale2   = cur2.zoom + (nxt2.zoom - cur2.zoom) * ease;
      tTx2      = cur2.x + (nxt2.x - cur2.x) * ease;
      tTy2      = cur2.y + (nxt2.y - cur2.y) * ease;
      tDensity2 = cur2.density + (nxt2.density - cur2.density) * ease;

      // Synchronous write: scroll changes the camera immediately. The rAF loop
      // re-eases and adds spin/breath next frame on a live page.
      root.setProperty('--geo-scale', tScale.toFixed(2));
      root.setProperty('--geo-tx', (-tTx).toFixed(1) + 'px');
      root.setProperty('--geo-ty', (-tTy).toFixed(1) + 'px');
      root.setProperty('--geo-density', tDensity.toFixed(2));
      root.setProperty('--geo2-scale', tScale2.toFixed(2));
      root.setProperty('--geo2-tx', (-tTx2).toFixed(1) + 'px');
      root.setProperty('--geo2-ty', (-tTy2).toFixed(1) + 'px');
      root.setProperty('--geo2-density', tDensity2.toFixed(2));
    }

    // Reduced motion: set the scroll camera once and stop. No spin, no breath.
    if (reduced) {
      function staticUpdate() {
        setTargets();
        root.setProperty('--spin-a', '0deg');
        root.setProperty('--spin-b', '0deg');
        root.setProperty('--geo-rot', '0deg');
        root.setProperty('--geo2-rot', '0deg');
        root.setProperty('--geo-scale', tScale.toFixed(2));
        root.setProperty('--geo-tx', (-tTx).toFixed(1) + 'px');
        root.setProperty('--geo-ty', (-tTy).toFixed(1) + 'px');
        root.setProperty('--geo-density', tDensity.toFixed(2));
        root.setProperty('--geo2-scale', tScale2.toFixed(2));
        root.setProperty('--geo2-tx', (-tTx2).toFixed(1) + 'px');
        root.setProperty('--geo2-ty', (-tTy2).toFixed(1) + 'px');
        root.setProperty('--geo2-density', tDensity2.toFixed(2));
      }
      window.addEventListener('scroll', staticUpdate, { passive: true });
      window.addEventListener('resize', staticUpdate, { passive: true });
      staticUpdate();
      return;
    }

    // Persistent loop: NEVER sleeps. Eases the camera toward its scroll target,
    // adds the continuous counter-rotation, adds the idle breath, writes once.
    function frame() {
      const t = Date.now();

      // Ease smoothed camera toward scroll targets
      curScale   += (tScale   - curScale)   * EASE;
      curTx      += (tTx      - curTx)      * EASE;
      curTy      += (tTy      - curTy)      * EASE;
      curDensity += (tDensity - curDensity) * EASE;
      curScale2   += (tScale2   - curScale2)   * EASE;
      curTx2      += (tTx2      - curTx2)      * EASE;
      curTy2      += (tTy2      - curTy2)      * EASE;
      curDensity2 += (tDensity2 - curDensity2) * EASE;

      // Idle breath: detuned sines on scale + translate
      const ph1 = t / BREATH_PERIOD * TWO_PI;
      const ph2 = t / (BREATH_PERIOD * 1.37) * TWO_PI;
      const bScale  = Math.sin(ph1) * BREATH_SCALE;
      const bScale2 = Math.cos(ph2) * BREATH_SCALE2;
      const bTx  = Math.sin(ph2) * BREATH_TX;
      const bTy  = Math.cos(ph1 * 0.7) * BREATH_TY;

      // Continuous counter-rotation of the whole layers (geo vs geo2)
      const rot1 = (t * ROT_PRIMARY)   % 360;
      const rot2 = (t * ROT_SECONDARY) % 360;

      // Per-group counter-rotation WITHIN each layer: depth-even circles turn
      // one way, depth-odd the other. Slower than the layer spin so the two
      // motions read as distinct. Group A clockwise, group B counter.
      const spinA = (t * SPIN_GROUP_A) % 360;
      const spinB = (t * SPIN_GROUP_B) % 360;

      root.setProperty('--spin-a', spinA.toFixed(3) + 'deg');
      root.setProperty('--spin-b', spinB.toFixed(3) + 'deg');

      root.setProperty('--geo-rot', rot1.toFixed(3) + 'deg');
      root.setProperty('--geo-scale', (curScale + bScale).toFixed(3));
      root.setProperty('--geo-tx', (-(curTx) + bTx).toFixed(1) + 'px');
      root.setProperty('--geo-ty', (-(curTy) + bTy).toFixed(1) + 'px');
      root.setProperty('--geo-density', curDensity.toFixed(3));

      root.setProperty('--geo2-rot', rot2.toFixed(3) + 'deg');
      root.setProperty('--geo2-scale', (curScale2 + bScale2).toFixed(3));
      root.setProperty('--geo2-tx', (-(curTx2) - bTx * 0.6).toFixed(1) + 'px');
      root.setProperty('--geo2-ty', (-(curTy2) - bTy * 0.6).toFixed(1) + 'px');
      root.setProperty('--geo2-density', curDensity2.toFixed(3));

      requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', setTargets, { passive: true });
    window.addEventListener('resize', setTargets, { passive: true });
    setTargets();
    requestAnimationFrame(frame);
  }

  // --- Click interaction for the mandala (#geo) pages -----------------------
  // The indra engine has its own click rig; the #geo pages had none. On
  // pointerdown: drop a soft ripple at the cursor, then reveal faint tangent
  // lines among the gasket circles nearest the touch point, which fade and
  // dissolve. Coordinates map screen -> the #geo svg's centered viewBox.
  function mountClick() {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const geo = document.getElementById('geo');
    if (!geo) return;
    const svg = geo.querySelector('svg');
    if (!svg) return;

    // Cache circle centers from the static (group A) + dynamic positions once.
    function readCircles() {
      const cs = Array.prototype.slice.call(svg.querySelectorAll('circle'));
      return cs.map(function (c) {
        return {
          x: +c.getAttribute('cx'),
          y: +c.getAttribute('cy'),
          r: +c.getAttribute('r')
        };
      }).filter(function (n) { return n.r >= 2 && n.r <= 120; });
    }
    let nodes = readCircles();

    const NS = 'http://www.w3.org/2000/svg';

    document.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;

      // 1) Soft ripple at the cursor (DOM element, same as indra's).
      const rip = document.createElement('span');
      rip.className = 'indra-ripple';
      rip.style.left = e.clientX + 'px';
      rip.style.top = e.clientY + 'px';
      document.body.appendChild(rip);
      setTimeout(function () { if (rip.parentNode) rip.parentNode.removeChild(rip); }, 700);

      // 2) Map the click into the svg's coordinate space.
      const m = svg.getScreenCTM();
      if (!m) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(m.inverse());

      if (!nodes.length) nodes = readCircles();
      if (!nodes.length) return;

      // Nearest circle to the click.
      let bi = -1, bd = Infinity;
      for (let k = 0; k < nodes.length; k++) {
        const d = Math.hypot(nodes[k].x - p.x, nodes[k].y - p.y);
        if (d < bd) { bd = d; bi = k; }
      }
      if (bi < 0) return;

      // Its tangent-ish neighbors: circles whose centers sit close to the
      // sum/diff of radii (the gasket tangency condition, loosened).
      const a = nodes[bi];
      const neigh = [];
      for (let k = 0; k < nodes.length; k++) {
        if (k === bi) continue;
        const b = nodes[k];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const sum = a.r + b.r, diff = Math.abs(a.r - b.r);
        if (Math.abs(d - sum) < 0.22 * sum || Math.abs(d - diff) < 0.8) {
          neigh.push(b);
          if (neigh.length >= 6) break;
        }
      }

      // Draw + fade-in the tangent lines, then dissolve.
      const lines = [];
      neigh.forEach(function (b) {
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
        line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
        line.setAttribute('stroke', 'currentColor');
        line.setAttribute('stroke-width', '0.4');
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        line.style.opacity = '0';
        line.style.transition = 'opacity 0.7s ease-in';
        svg.appendChild(line);
        lines.push(line);
        requestAnimationFrame(function () { line.style.opacity = '0.10'; });
      });
      setTimeout(function () {
        lines.forEach(function (l) {
          l.style.transition = 'opacity 3.5s ease-out';
          l.style.opacity = '0';
        });
        setTimeout(function () {
          lines.forEach(function (l) { if (l.parentNode) l.parentNode.removeChild(l); });
        }, 3800);
      }, 1800);
    }, { passive: true });

    // Re-read circles after a resize rebuild swaps the svg contents.
    window.addEventListener('resize', function () {
      setTimeout(function () {
        const s = geo.querySelector('svg');
        if (s) nodes = Array.prototype.slice.call(s.querySelectorAll('circle')).map(function (c) {
          return { x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r') };
        }).filter(function (n) { return n.r >= 2 && n.r <= 120; });
      }, 260);
    }, { passive: true });
  }

  global.PolymythMandala = {
    build: buildMandala,
    presets: PRESETS,
    initForProject: function(projectKey) {
      const opts = PRESETS[projectKey];
      if (!opts) {
        console.warn('Mandala: no preset for', projectKey);
        return;
      }
      // Add body class so CSS can target per-project geometry treatments
      document.body.classList.add('project-' + projectKey);
      const svg = buildMandala(opts);
      const geo = document.getElementById('geo');
      const geo2 = document.getElementById('geo2');
      if (geo) geo.innerHTML = svg;
      if (geo2) geo2.innerHTML = svg;
      initCameraScroll();
      mountClick();
    },
    initScrollCamera: initCameraScroll
  };
})(window);
