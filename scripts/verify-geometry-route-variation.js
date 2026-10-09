#!/usr/bin/env node
'use strict';

/* Execute the real cameraAt() for every delivered route and theme, using the
   existing geometry gate's controlled DOM/clock. No browser or FPS claim.
   Usage: node scripts/verify-geometry-route-variation.js
   Optional: SS_SITE_ROOT=/path or --root /path; --report /path/receipt.json.
   Source files are never written. Only an explicitly requested report is saved. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { createRequire } = require('module');

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith('--')) throw new Error('Missing value for ' + name);
  return process.argv[index + 1];
}
const defaultRoot = fs.existsSync(path.join(__dirname, '..', 'js', 'indra.js'))
  ? path.resolve(__dirname, '..') : process.cwd();
const root = path.resolve(option('--root') || process.env.SS_SITE_ROOT || defaultRoot);
const reportPath = option('--report');
const fixturePath = path.join(root, 'scripts', 'verify-geometry.js');
const fixtureSource = fs.readFileSync(fixturePath, 'utf8');
const cut = fixtureSource.indexOf('function inspectExecution(options)');
if (cut < 0) throw new Error('Geometry DOM/clock fixture entry boundary missing');
const cameraSource = fs.readFileSync(path.join(root, 'js', 'indra.js'), 'utf8');
const insertionPoint = 'window.PolymythIndra = Object.freeze({';
if (cameraSource.split(insertionPoint).length !== 2) throw new Error('Camera API insertion point is missing or ambiguous');
// This instrumentation changes only which route is under inspection inside an
// isolated VM. It then calls the existing public cameraAt(), including the real
// preset, recurrence, reading, zoom, and curve code. No camera math is copied.
const instrumentedSource = cameraSource.replace(insertionPoint, `
window.__geometryReviewSetRoute = function (row) {
  geometryKey = normalizePath(row.key);
  seeds = seedPair(geometryKey, row.seed);
  primaryVariation = cameraVariation(seeds.first, seeds.second);
  secondaryVariation = cameraVariation(seeds.second, seeds.first);
  register = row.register;
  motionPreset = row.preset;
};
` + insertionPoint);
let prelude = fixtureSource.slice(0, cut);
if (!prelude.includes("const indraSource = read('js/indra.js');")) throw new Error('Geometry fixture runtime-source binding changed');
prelude = prelude.replace("const indraSource = read('js/indra.js');", 'const indraSource = __reviewRuntimeSource;');
// The inherited DOM stub defaults to a 1200px root even when a different window
// is requested. A real root matches the viewport width in these test fixtures.
if (!prelude.includes('root.clientWidth = 1200;')) throw new Error('Geometry fixture root-width binding changed; review adaptation');
prelude = prelude.replace('root.clientWidth = 1200;', 'root.clientWidth = options.width || 1200;');
const sandbox = {
  require: createRequire(fixturePath), __dirname: path.dirname(fixturePath),
  console, Buffer, TextEncoder, URL, process,
  module: { exports: {} }, exports: {},
  __reviewRuntimeSource: instrumentedSource,
};
vm.runInNewContext(prelude + '\nglobalThis.__reviewExecute = execute; globalThis.__reviewFailures = failures;', sandbox, { filename: fixturePath });
if (sandbox.__reviewFailures.length) throw new Error('Canonical geometry fixture failed: ' + sandbox.__reviewFailures.join('; '));

const contracts = JSON.parse(fs.readFileSync(path.join(root, 'data', 'geometry-route-contracts.json'), 'utf8'));
function scan(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full, out);
    else if (entry.isFile() && full.endsWith('.html')) out.push(full);
  }
  return out;
}
const errors = [];
const rows = scan(path.join(root, 'public')).sort().map(file => {
  const tag = (fs.readFileSync(file, 'utf8').match(/<body\b[^>]*>/i) || [''])[0];
  if (!/data-geometry="indra-web"/.test(tag)) return null;
  const attr = name => (tag.match(new RegExp(name + '="([^"]*)"')) || [])[1];
  const row = { key: attr('data-geometry-key'), seed: attr('data-geometry-seed'), register: attr('data-geometry-register'), preset: attr('data-geometry-motion-preset') };
  if (!row.key || !/^[0-9a-f]{16,}$/i.test(row.seed || '') || !contracts.registers[row.register] || !contracts.motion_presets[row.preset]) {
    errors.push('Invalid shipped route camera contract: ' + path.relative(root, file));
  }
  return row;
}).filter(Boolean);
if (!rows.length) throw new Error('No included deployment routes; empty output cannot satisfy all-page verification');
if (new Set(rows.map(row => row.key)).size !== rows.length) errors.push('Deployment geometry keys repeat');
if (errors.length) throw new Error(errors.join('\n'));

const progressValues = [...new Set(Array.from({ length: 21 }, (_, i) => i / 20).concat(0.32))].sort((a, b) => a - b);
const viewports = [[320, 568], [390, 844], [844, 390], [1200, 800], [1920, 1080]];
const reports = [];
for (const [width, height] of viewports) {
  const run = sandbox.__reviewExecute({ width, height, manualFrames: true });
  if (run.error || !run.api) throw new Error('Runtime failed at ' + width + 'x' + height + ': ' + run.error);
  const ranges = Object.fromEntries(['zoom', 'focusX', 'focusY', 'focusRadius', 'translateRadius'].map(key => [key, [Infinity, -Infinity]]));
  const startZooms = [new Set(), new Set()];
  const startFoci = [new Set(), new Set()];
  const stillFoci = [new Set(), new Set()];
  const journeys = [new Set(), new Set()];
  let nonfinite = 0;
  const travelFailures = [];
  const extrema = { widest: null, closest: null };
  for (const row of rows) {
    run.window.__geometryReviewSetRoute(row);
    for (let camera = 0; camera < 2; camera++) {
      const points = [];
      for (const progress of progressValues) {
        const point = run.api.cameraAt(progress, !!camera);
        const values = {
          zoom: point.zoom, focusX: point.focusX, focusY: point.focusY,
          focusRadius: Math.hypot(point.focusX, point.focusY),
          translateRadius: Math.hypot(point.x, point.y),
        };
        for (const [name, value] of Object.entries(values)) {
          if (!Number.isFinite(value)) nonfinite++;
          ranges[name][0] = Math.min(ranges[name][0], value);
          ranges[name][1] = Math.max(ranges[name][1], value);
        }
        if (![point.x, point.y, point.rotation, point.drawingFit].every(Number.isFinite)) nonfinite++;
        if (point.zoom <= 0 || point.drawingFit <= 0) errors.push(row.key + ': nonpositive optical scale');
        const locus = { key: row.key, camera, progress, zoom: point.zoom, focus: [point.focusX, point.focusY] };
        if (!extrema.widest || point.zoom < extrema.widest.zoom) extrema.widest = locus;
        if (!extrema.closest || point.zoom > extrema.closest.zoom) extrema.closest = locus;
        const focus = [point.focusX, point.focusY].map(n => n.toFixed(4)).join(',');
        if (progress === 0) { startZooms[camera].add(point.zoom.toFixed(7)); startFoci[camera].add(focus); }
        if (progress === 0.32) stillFoci[camera].add(focus);
        points.push(point);
      }
      const first = points[0], last = points[points.length - 1];
      const displacement = Math.hypot(last.x - first.x, last.y - first.y);
      if (displacement + 0.001 < contracts.registers[row.register].minimum_scroll_displacement) {
        travelFailures.push({ key: row.key, camera, preset: row.preset, displacement });
      }
      const signature = [first, points[progressValues.indexOf(0.5)], last]
        .map(point => [point.x, point.y, point.zoom, point.rotation].map(n => n.toFixed(4)).join(',')).join('|');
      journeys[camera].add(signature);
    }
  }
  if (nonfinite) errors.push(width + 'x' + height + ': ' + nonfinite + ' nonfinite camera values');
  if (travelFailures.length) errors.push(width + 'x' + height + ': ' + travelFailures.length + ' route/camera travel failures');
  for (let camera = 0; camera < 2; camera++) {
    if (startFoci[camera].size !== rows.length) errors.push(width + 'x' + height + ': repeated starting focal region in camera ' + camera);
    if (stillFoci[camera].size !== rows.length) errors.push(width + 'x' + height + ': repeated fixed-surface focal region in camera ' + camera);
    if (journeys[camera].size !== rows.length) errors.push(width + 'x' + height + ': repeated camera journey in camera ' + camera);
    // This checks continuous zoom diversity, without demanding that a zoom by
    // itself identify a page; the complete focus and journey must identify it.
    if (startZooms[camera].size < rows.length * 0.95) errors.push(width + 'x' + height + ': zoom variation collapsed to a small repeated set in camera ' + camera);
  }
  // The canonical field's outer circle has radius300. Every sampled requested
  // focal point remains within that original drawing, at both viewport shapes.
  if (ranges.focusRadius[1] > 300) errors.push(width + 'x' + height + ': focal point leaves the canonical outer circle');
  reports.push({ width, height, routes: rows.length, samples: rows.length * 2 * progressValues.length,
    ranges, nonfinite, uniqueStartingZooms: startZooms.map(set => set.size),
    uniqueStartingFoci: startFoci.map(set => set.size), uniqueFixedSurfaceFoci: stillFoci.map(set => set.size),
    uniqueJourneys: journeys.map(set => set.size), travelFailures, extrema });
}
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const report = {
  schema: 'seminar-schools-geometry-route-variation-v1',
  evidence: 'Production cameraAt with controlled DOM and clock; coordinate and behavior proof, not browser perceptibility, FPS, or physical-phone performance.',
  source_sha256: {
    'js/indra.js': sha256(cameraSource),
    'js/mandala.js': sha256(fs.readFileSync(path.join(root, 'js', 'mandala.js'))),
    'data/geometry-route-contracts.json': sha256(fs.readFileSync(path.join(root, 'data', 'geometry-route-contracts.json'))),
    'scripts/verify-geometry.js': sha256(fixtureSource),
  },
  route_contracts_sha256: sha256(JSON.stringify(rows)),
  routes: rows.length, cameras: 2, progress_values: progressValues,
  total_samples: reports.reduce((sum, row) => sum + row.samples, 0),
  viewports: reports, errors, passed: errors.length === 0,
};
if (reportPath) {
  const destination = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
else console.log('GEOMETRY ROUTE VARIATION PASSED — ' + rows.length + ' routes, two actual theme-aware cameras, ' + report.total_samples + ' finite camera states, distinct focal regions and journeys, preserved travel floors.');
