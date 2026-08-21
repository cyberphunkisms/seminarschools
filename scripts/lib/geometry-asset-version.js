'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const GEOMETRY_ASSETS = Object.freeze([
  'css/alive.css',
  'js/mandala.js',
  'js/indra.js',
]);
const VERSION_SCHEME = 'sha256-12';

/**
 * Return a cache token that changes whenever any shipped geometry asset does.
 * Path separators and NUL delimiters make the combined digest unambiguous.
 */
function geometryAssetVersion(root) {
  const hash = crypto.createHash('sha256');
  for (const relative of GEOMETRY_ASSETS) {
    hash.update(relative, 'utf8');
    hash.update('\0', 'utf8');
    hash.update(fs.readFileSync(path.join(root, relative)));
    hash.update('\0', 'utf8');
  }
  return `sha256-${hash.digest('hex').slice(0, 12)}`;
}

function assertGeometryVersionScheme(contracts) {
  if (!contracts || contracts.asset_version_scheme !== VERSION_SCHEME) {
    throw new Error(`geometry contract asset_version_scheme must be ${VERSION_SCHEME}`);
  }
}

/**
 * Normalize a source HTML path to the pathname-only geometry camera key used
 * by both the catch-all finalizer and page generators.
 */
function geometryKeyForRelativeHtmlPath(relativeHtmlPath) {
  const relative = String(relativeHtmlPath).replace(/\\/g, '/').replace(/^\/+/, '');
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -'index.html'.length)}`;
  return `/${relative}`;
}

function geometryRegisterForKey(key) {
  if (/^\/polymyth\/coherence(?:\/|$)/.test(key)) return 'quiet';
  if (key === '/' || /^\/(?:polymyth|bb|bookwormcard|campaigns|aa|ohm-dome|agora|florilegium)(?:\/|$)/.test(key)) return 'expressive';
  if (/^\/(?:about|leizu|saul|teacherresources|polymythseminars|seminars|writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships|marginalia|reviews)(?:\/|$)/.test(key)) return 'quiet';
  return 'standard';
}

function geometryProfileFor(relativeHtmlPath, routeType) {
  const relative = String(relativeHtmlPath).replace(/\\/g, '/').replace(/^\/+/, '');
  if (relative === 'about/index.html') return 'about-dual';
  if (routeType === 'cv') return 'cv-quiet';
  return 'single';
}

function geometrySeedForKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * Emit the canonical body contract in the exact order owned by the finalizer.
 * Keeping this in one JS helper makes generated pages byte-idempotent before
 * the finalizer runs, while the finalizer still validates every HTML page.
 */
function geometryBodyAttributes(contracts, relativeHtmlPath, routeType) {
  assertGeometryVersionScheme(contracts);
  const roles = contracts.route_types && contracts.route_types[routeType];
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new Error(`${routeType}: missing structural geometry roles`);
  }
  const key = geometryKeyForRelativeHtmlPath(relativeHtmlPath);
  const register = geometryRegisterForKey(key);
  const profile = geometryProfileFor(relativeHtmlPath, routeType);
  const registerContract = contracts.registers && contracts.registers[register];
  const profileContract = contracts.profiles && contracts.profiles[profile];
  if (!registerContract || !Number.isFinite(Number(registerContract.default_intensity))) {
    throw new Error(`${register}: missing geometry register contract`);
  }
  if (!profileContract) throw new Error(`${profile}: missing geometry profile contract`);
  const intensity = Number(registerContract.default_intensity).toFixed(3);
  return `data-route-type="${routeType}"`
    + ' data-geometry="indra-web"'
    + ` data-indra-intensity="${intensity}"`
    + ` data-geometry-role="${roles.join(' ')}"`
    + ` data-geometry-key="${key}"`
    + ` data-geometry-seed="${geometrySeedForKey(key)}"`
    + ` data-geometry-register="${register}"`
    + ` data-geometry-profile="${profile}"`
    + ' data-front-facing="general-audience"';
}

module.exports = {
  GEOMETRY_ASSETS,
  VERSION_SCHEME,
  assertGeometryVersionScheme,
  geometryBodyAttributes,
  geometryAssetVersion,
  geometryKeyForRelativeHtmlPath,
  geometryProfileFor,
  geometryRegisterForKey,
  geometrySeedForKey,
};
