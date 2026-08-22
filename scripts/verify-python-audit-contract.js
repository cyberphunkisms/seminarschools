#!/usr/bin/env node
'use strict';

/** Keeps portable gates browser-free and current Chromium evidence reproducible. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
function read(relative) {
  try {
    return fs.readFileSync(path.join(ROOT, relative), 'utf8');
  } catch {
    failures.push(`${relative} is missing`);
    return '';
  }
}
function check(condition, message) {
  if (!condition) failures.push(message);
}

const requirements = read('requirements-audit.txt');
const auditLock = read('requirements-audit.lock');
const polymythcalValidator = read('scripts/validate-polymythcal.py');
for (const dependency of [
  'beautifulsoup4',
  'icalendar',
  'jsonschema',
  'openpyxl',
  'playwright',
  'python-dateutil',
  'requests',
]) {
  const escaped = dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  check(
    new RegExp(`^${escaped}==[^\\s]+$`, 'm').test(requirements),
    `${dependency} is not pinned in requirements-audit.txt`,
  );
}
const lockedPins = [...auditLock.matchAll(/^([A-Za-z0-9_.-]+)==([^\s\\]+)\s+\\$/gm)];
const lockedHashes = [...auditLock.matchAll(/^\s+--hash=sha256:([a-f0-9]{64})(?:\s+\\)?$/gm)];
check(lockedPins.length === 22, `requirements-audit.lock has ${lockedPins.length} resolved pins, expected 22`);
check(lockedHashes.length === 332, `requirements-audit.lock has ${lockedHashes.length} artifact hashes, expected 332`);
check(!/(?:^|\n)(?!\s*#)(?!\s*$)(?![A-Za-z0-9_.-]+==[^\s\\]+\s+\\$)(?!\s+--hash=sha256:[a-f0-9]{64}(?:\s+\\)?$).+/m.test(auditLock), 'requirements-audit.lock contains an unsupported unhashed line');
check(
  /^jsonschema==4\.24\.0$/m.test(requirements),
  'requirements-audit.txt does not pin the jsonschema version required by the Polymythcal validator',
);
check(
  /^jsonschema==4\.24\.0\s+\\$/m.test(auditLock),
  'requirements-audit.lock does not resolve the pinned jsonschema dependency',
);
check(
  /^from jsonschema import Draft202012Validator$/m.test(polymythcalValidator),
  'the Polymythcal validator no longer exposes the jsonschema dependency covered by this contract',
);

const netlify = read('netlify.toml');
const netlifyInstall = 'python3 -m pip install --disable-pip-version-check --no-input '
  + '--require-hashes --requirement requirements-audit.lock';
const netlifyBuildCommand = netlify.match(
  /^\s*command\s*=\s*"([^"]+)"\s*$/m,
)?.[1];
check(
  netlifyBuildCommand === `${netlifyInstall} && npm run build`,
  'Netlify does not install the hash-locked Python audit runtime before npm run build',
);
const netlifyEnvironmentMarker = '[build.environment]';
const environmentStart = netlify.indexOf(netlifyEnvironmentMarker);
let netlifyEnvironment = '';
if (environmentStart >= 0) {
  const environmentTail = netlify.slice(environmentStart + netlifyEnvironmentMarker.length);
  const nextSection = environmentTail.search(/^\s*\[/m);
  netlifyEnvironment = nextSection >= 0
    ? environmentTail.slice(0, nextSection)
    : environmentTail;
}
check(
  /^\s*PYTHON_VERSION\s*=\s*"3\.12\.13"\s*$/m.test(netlifyEnvironment),
  'Netlify is not pinned to the repository-tested Python 3.12.13 runtime',
);
check(
  /^\s*PYTHON_BIN\s*=\s*"python3"\s*$/m.test(netlifyEnvironment),
  'Netlify does not couple scripts/run-python.js to the interpreter used for dependency installation',
);

const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
check(pkg.devDependencies?.playwright === '1.61.1', 'Playwright is not pinned in package.json');
check(
  lock.packages?.['']?.devDependencies?.playwright === '1.61.1',
  'Playwright is not pinned in the package-lock root',
);
check(
  pkg.scripts?.['audit:audit45-browser'] === 'node scripts/audit45-translation-browser.js',
  'Audit 45 browser command is not exposed correctly',
);
check(
  pkg.scripts?.['verify:audit45-current-browser-evidence']
    === 'node scripts/verify-audit45-browser-evidence.js',
  'Audit 45 current evidence verifier is not exposed correctly',
);
check(
  pkg.scripts?.['verify:frozen-audit43'] === 'node scripts/verify-frozen-audit43.js',
  'frozen Audit 43 evidence is not exposed through its read-only verifier',
);
for (const historicalWriter of [
  'apply:audit42-release-stamp',
  'apply:audit43-release-stamp',
  'audit:audit42-inherited-browser',
  'audit:audit42-multimode',
  'audit:audit43-browser',
  'build:audit42-site-inventory',
  'build:audit43-continuity',
  'verify:audit43-current-browser-evidence',
]) {
  check(!pkg.scripts?.[historicalWriter], `historical writer remains exposed: ${historicalWriter}`);
}

const runner = read('scripts/verify-all-runner.js');
check(runner.includes('verify-python-audit-contract.js'), 'verify:all omits this contract');
check(runner.includes('verify-frozen-audit43.js'), 'verify:all omits frozen Audit 43');
check(runner.includes('verify-audit45-browser-evidence.js'), 'verify:all omits Audit 45 evidence');
check(runner.includes('verify-audit48-browser-program.js'), 'verify:all omits Audit 48 browser program gate');
check(runner.includes('verify-polymythcal-calendar-clients.py'), 'verify:all omits Audit 48 calendar clients');
check(runner.includes('verify_audit48_live_harvest.py'), 'verify:all omits Audit 48 live evidence');
check(
  !/audit45-translation-browser\.js|audit48-cross-engine-browser\.js|audit43-approved-browser\.py|run-audit(?:38|39|40|41|42-inherited)-browser/.test(runner),
  'verify:all directly invokes a historical evidence-producing browser program',
);
check(
  runner.includes('verify-visible-geometry-browser.mjs'),
  'verify:all omits the current computed-render geometry gate',
);

const workflow = read('.github/workflows/predeploy.yml');
const portableVerification = 'npm run verify:repository:built';
const lockedInstall = 'npm ci --no-audit --no-fund';
check(
  workflow.includes('npm run verify:audit48-calendar-clients'),
  'predeploy omits portable cross-platform Audit 48 calendar verification',
);
check(workflow.includes(lockedInstall), `predeploy omits ${lockedInstall}`);
check(
  (workflow.match(/cache-dependency-path: requirements-audit\.lock/g) || []).length === 3
    && (workflow.match(/--require-hashes --requirement requirements-audit\.lock/g) || []).length === 3,
  'predeploy does not use the complete hash-locked Python audit runtime in all three jobs',
);
check(
  workflow.indexOf(lockedInstall) < workflow.indexOf(portableVerification),
  'locked JavaScript dependencies are not installed before portable verification',
);
check(
  !workflow.includes('npm install --no-save --package-lock=false --ignore-scripts playwright@1.61.1'),
  'predeploy retains the redundant second Playwright package install',
);
const chromiumInstall = 'npx playwright install --with-deps chromium';
check(workflow.includes(chromiumInstall), `predeploy omits ${chromiumInstall}`);
check(
  workflow.indexOf(chromiumInstall) < workflow.indexOf(portableVerification),
  `${chromiumInstall} does not run before the full verifier's computed-render geometry gate`,
);
for (const command of [
  'npm run audit:audit45-browser',
  'npm run verify:audit45-current-browser-evidence',
]) {
  check(workflow.includes(command), `predeploy omits ${command}`);
  check(
    workflow.indexOf(command) > workflow.indexOf(portableVerification),
    `${command} runs before portable verification`,
  );
}
check(
  workflow.indexOf('npm run verify:audit45-current-browser-evidence')
    > workflow.indexOf('npm run audit:audit45-browser'),
  'Audit 45 evidence is verified before fresh browser generation',
);
for (const historicalCommand of [
  'python scripts/audit43-approved-browser.py',
  'npm run verify:audit43-current-browser-evidence',
  'python scripts/run-audit42-inherited-browser-all.py',
  'python scripts/audit42-multimode-browser.py',
]) {
  check(!workflow.includes(historicalCommand), `predeploy executes ${historicalCommand}`);
}

const current = read('scripts/audit45-translation-browser.js');
for (const token of [
  'seminar-schools-audit45-translation-browser-v1',
  'Leizu French home desktop',
  'Polymythcal French home desktop',
  'Saul Persian archive mobile',
  'Teacher Resources source-language finder desktop',
  'BB Simplified Chinese Why essay mobile',
  'document has no horizontal overflow',
  'CLS is at or below 0.1',
  'no page exceptions',
  'no failed local responses',
  'source_program_sha256',
  'external_requests',
]) {
  check(current.includes(token), `Audit 45 browser program is missing ${token}`);
}
const evidenceVerifier = read('scripts/verify-audit45-browser-evidence.js');
for (const token of [
  'checks.length >= 110',
  'expectedLabels.length',
  'source_program_sha256',
  'report.generated_at === manifest.generated_at',
  'metric.documentOverflow',
  'metric.visibleH1',
]) {
  check(evidenceVerifier.includes(token), `Audit 45 evidence verifier is missing ${token}`);
}

if (failures.length) {
  console.error(`PYTHON/BROWSER AUDIT CONTRACT CHECK FAILED (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(
  'PYTHON/BROWSER AUDIT CONTRACT CHECK PASSED — historical evidence-producing browser programs stay external, '
  + 'lock-pinned Playwright is installed once before the current computed-render geometry gate, Audit 45 owns fresh Chromium evidence, '
  + 'Audit 48 keeps cross-engine execution outside portable gates, and Audit 43 remains immutable.',
);
