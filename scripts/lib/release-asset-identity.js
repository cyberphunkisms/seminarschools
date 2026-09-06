'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { geometryAssetVersion } = require('./geometry-asset-version');

const RELEASE_ASSET_PATHS = Object.freeze([
  'css/alive.css',
  'css/calm-ux.css',
  'css/site-wide-type-zoom.css',
  'js/mandala.js',
  'js/indra.js',
  'data/geometry-route-contracts.json',
  'index.html',
  'teacherresources/finder.css',
  'teacherresources/finder.js',
  'teacherresources/index.html',
  'data/polymyth-seminar-events.json',
  'data/polymythcal-event-schema-v2.json',
  'data/polymythcal-publication-surfaces.json',
  'css/polymythcal-discovery.css',
  'js/polymythcal-discovery-core.js',
  'js/polymythcal-discovery.js',
  'js/polymythcal-revamp.js',
  'polymythseminars/browse.json',
  'polymythseminars/watchlist.json',
  'polymythseminars/research.json',
  'polymythseminars/index.html',
  'polymythseminars/fr/index.html',
  'polymythseminars/research/index.html',
  'polymythseminars/fr/research/index.html',
  'polymythseminars/monitoring/index.html',
  'polymythseminars/fr/monitoring/index.html',
]);

const PUBLIC_RELEASE_ASSET_PATHS = Object.freeze({
  'css/alive.css': 'css/alive.css',
  'css/calm-ux.css': 'css/calm-ux.css',
  'css/site-wide-type-zoom.css': 'css/site-wide-type-zoom.css',
  'js/mandala.js': 'js/mandala.js',
  'js/indra.js': 'js/indra.js',
  'data/geometry-route-contracts.json': null,
  'index.html': 'index.html',
  'teacherresources/finder.css': 'teacherresources/finder.css',
  'teacherresources/finder.js': 'teacherresources/finder.js',
  'teacherresources/index.html': 'teacherresources/index.html',
  'data/polymyth-seminar-events.json': null,
  'data/polymythcal-event-schema-v2.json': null,
  'data/polymythcal-publication-surfaces.json': null,
  'css/polymythcal-discovery.css': 'css/polymythcal-discovery.css',
  'js/polymythcal-discovery-core.js': 'js/polymythcal-discovery-core.js',
  'js/polymythcal-discovery.js': 'js/polymythcal-discovery.js',
  'js/polymythcal-revamp.js': null,
  'polymythseminars/browse.json': 'polymythseminars/browse.json',
  'polymythseminars/watchlist.json': 'polymythseminars/watchlist.json',
  'polymythseminars/research.json': 'polymythseminars/research.json',
  'polymythseminars/index.html': 'polymythseminars/index.html',
  'polymythseminars/fr/index.html': 'polymythseminars/fr/index.html',
  'polymythseminars/research/index.html': 'polymythseminars/research/index.html',
  'polymythseminars/fr/research/index.html': 'polymythseminars/fr/research/index.html',
  'polymythseminars/monitoring/index.html': 'polymythseminars/monitoring/index.html',
  'polymythseminars/fr/monitoring/index.html': 'polymythseminars/fr/monitoring/index.html',
});

const TEACHERRESOURCES_ASSETS = Object.freeze({
  finder_css: 'teacherresources/finder.css',
  finder_js: 'teacherresources/finder.js',
});

const RELEASE_IDENTITY_FIELDS = Object.freeze([
  'geometry_asset_version',
  'teacherresources_asset_versions',
  'asset_digests',
]);

function sha256Hex(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sha256Version(file) {
  return `sha256-${sha256Hex(file).slice(0, 12)}`;
}

function computeReleaseAssetIdentity(siteRoot) {
  const root = path.resolve(siteRoot);
  const teacherresourcesAssetVersions = {};
  for (const [name, relative] of Object.entries(TEACHERRESOURCES_ASSETS)) {
    teacherresourcesAssetVersions[name] = sha256Version(path.join(root, relative));
  }

  const assetDigests = {};
  for (const relative of RELEASE_ASSET_PATHS) {
    assetDigests[relative] = sha256Hex(path.join(root, relative));
  }

  return {
    geometry_asset_version: geometryAssetVersion(root),
    teacherresources_asset_versions: teacherresourcesAssetVersions,
    asset_digests: assetDigests,
  };
}

function pickReleaseAssetIdentity(value) {
  const picked = {};
  for (const field of RELEASE_IDENTITY_FIELDS) picked[field] = value && value[field];
  return picked;
}

module.exports = {
  PUBLIC_RELEASE_ASSET_PATHS,
  RELEASE_ASSET_PATHS,
  RELEASE_IDENTITY_FIELDS,
  TEACHERRESOURCES_ASSETS,
  computeReleaseAssetIdentity,
  pickReleaseAssetIdentity,
  sha256Hex,
  sha256Version,
};
