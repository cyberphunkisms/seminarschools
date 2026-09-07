'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const GEOMETRY_ASSETS = Object.freeze([
  'data/geometry-route-contracts.json',
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
  const coverage = contracts.coverage || {};
  const starRoutes = coverage.star_page_routes;
  const controlPrefixes = coverage.control_page_prefixes;
  if (!Array.isArray(starRoutes)
      || starRoutes.length !== Number(coverage.expected_current_star_pages)
      || new Set(starRoutes).size !== starRoutes.length) {
    throw new Error('geometry contract must declare the exact canonical star_page_routes');
  }
  if (!Array.isArray(controlPrefixes) || controlPrefixes.length === 0) {
    throw new Error('geometry contract must declare source-only control_page_prefixes');
  }
  if (coverage.exemption_attribute !== 'data-shared-geometry-exempt') {
    throw new Error('geometry contract exemption_attribute must be data-shared-geometry-exempt');
  }
  const presentation = contracts.presentation || {};
  const palette = presentation.rainbow_palette;
  if (!Array.isArray(palette) || palette.length !== 8
      || palette.some(value => !/^#[0-9a-f]{6}$/.test(String(value)))) {
    throw new Error('geometry contract must declare one immutable eight-colour lowercase palette');
  }
  geometryOpacityBounds(contracts);
}

/**
 * Return the explicit shared-geometry exemption for an HTML source path.
 * Star files are exact routes: a future ordinary project created beneath one of
 * their parent directories must not become exempt by accident. Dashboard is a
 * source-only internal control family and remains prefix-classified so any
 * additional private control views fail the expected-count gate until reviewed.
 */
function geometryExemptionForRelativeHtmlPath(contracts, relativeHtmlPath) {
  assertGeometryVersionScheme(contracts);
  const coverage = contracts.coverage;
  const relative = String(relativeHtmlPath).replace(/\\/g, '/').replace(/^\/+/, '');
  if (coverage.star_page_routes.includes(relative)) return coverage.star_page_exemption_value;
  if (coverage.control_page_prefixes.some(prefix => relative.startsWith(String(prefix)))) {
    return coverage.control_page_exemption_value;
  }
  return null;
}

function isStarPageRelativeHtmlPath(contracts, relativeHtmlPath) {
  return geometryExemptionForRelativeHtmlPath(contracts, relativeHtmlPath)
    === contracts.coverage.star_page_exemption_value;
}

function isGeometryExemptRelativeHtmlPath(contracts, relativeHtmlPath) {
  return geometryExemptionForRelativeHtmlPath(contracts, relativeHtmlPath) !== null;
}

function geometryOpacityBounds(contracts) {
  const bounds = contracts && contracts.presentation && contracts.presentation.opacity_bounds;
  const minimum = Number(bounds && bounds.minimum);
  const maximum = Number(bounds && bounds.maximum);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)
      || minimum < 0 || maximum > 1 || minimum > maximum) {
    throw new Error('geometry contract must declare valid presentation.opacity_bounds');
  }
  return Object.freeze({ minimum, maximum });
}

function validGeometryOpacity(contracts, value) {
  const number = Number(value);
  const bounds = geometryOpacityBounds(contracts);
  return Number.isFinite(number) && number >= bounds.minimum && number <= bounds.maximum
    ? number
    : null;
}

function geometryOwnerOpacityForKey(contracts, key, routeType) {
  const overrides = contracts.presentation && contracts.presentation.owner_fade_overrides;
  if (!Array.isArray(overrides)) {
    throw new Error('geometry contract must declare presentation.owner_fade_overrides');
  }
  for (const override of overrides) {
    const selectors = ['exact_path', 'path_prefix', 'route_type']
      .filter(name => typeof override[name] === 'string');
    if (selectors.length !== 1) {
      throw new Error('each geometry owner fade override must have exactly one selector');
    }
    const matches = override.exact_path === key
      || (typeof override.path_prefix === 'string' && key.startsWith(override.path_prefix))
      || override.route_type === routeType;
    if (matches) {
      const opacity = validGeometryOpacity(contracts, override.opacity);
      if (opacity === null) throw new Error(`invalid geometry owner opacity for ${override.owner || selectors[0]}`);
      return opacity;
    }
  }
  return null;
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
  return 'dual-field';
}

function geometryMotionPresetFor(contracts, key, routeType) {
  for (const rule of contracts.motion_preset_rules || []) {
    if (rule.exact_path === key || (rule.path_prefixes || []).some(prefix => key.startsWith(prefix))
        || (rule.route_types || []).includes(routeType)) {
      if (!contracts.motion_presets[rule.preset]) throw new Error('Unknown geometry motion preset ' + rule.preset);
      return rule.preset;
    }
  }
  return 'flow';
}

function geometrySeedForKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * Emit the canonical body contract in the exact order owned by the finalizer.
 * Keeping this in one JS helper makes generated pages byte-idempotent before
 * the finalizer runs, while the finalizer still validates every HTML page.
 */
function geometryBodyAttributes(contracts, relativeHtmlPath, routeType, options = {}) {
  assertGeometryVersionScheme(contracts);
  const exemption = geometryExemptionForRelativeHtmlPath(contracts, relativeHtmlPath);
  if (exemption) {
    throw new Error(`${relativeHtmlPath}: ${exemption} pages must not receive public rainbow geometry`);
  }
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
  const registerIntensity = validGeometryOpacity(contracts, registerContract.default_intensity);
  if (registerIntensity === null) throw new Error(`${register}: invalid geometry register intensity`);
  const normalizedOptions = typeof options === 'number'
    ? { pageOwnedIntensity: options }
    : (options || {});
  const ownerOverride = geometryOwnerOpacityForKey(contracts, key, routeType);
  const pageOwned = validGeometryOpacity(contracts, normalizedOptions.pageOwnedIntensity);
  const resolvedIntensity = ownerOverride !== null
    ? ownerOverride
    : pageOwned !== null ? pageOwned : registerIntensity;
  const fadeSource = ownerOverride !== null || pageOwned !== null ? 'page' : 'route-register';
  const intensity = resolvedIntensity.toFixed(3);
  return `data-route-type="${routeType}"`
    + ' data-geometry="indra-web"'
    + ` data-indra-intensity="${intensity}"`
    + ` data-indra-fade-source="${fadeSource}"`
    + ` data-geometry-role="${roles.join(' ')}"`
    + ` data-geometry-key="${key}"`
    + ` data-geometry-seed="${geometrySeedForKey(key)}"`
    + ` data-geometry-register="${register}"`
    + ` data-geometry-profile="${profile}"`
    + ` data-geometry-motion-preset="${geometryMotionPresetFor(contracts, key, routeType)}"`
    + ' data-front-facing="general-audience"';
}

module.exports = {
  GEOMETRY_ASSETS,
  VERSION_SCHEME,
  assertGeometryVersionScheme,
  geometryBodyAttributes,
  geometryAssetVersion,
  geometryExemptionForRelativeHtmlPath,
  geometryKeyForRelativeHtmlPath,
  geometryOpacityBounds,
  geometryOwnerOpacityForKey,
  geometryProfileFor,
  geometryMotionPresetFor,
  geometryRegisterForKey,
  geometrySeedForKey,
  isGeometryExemptRelativeHtmlPath,
  isStarPageRelativeHtmlPath,
  validGeometryOpacity,
};
