#!/usr/bin/env node
'use strict';

/**
 * Audit 48 assistive-technology prerequisite gate.
 *
 * This gate does not claim that VoiceOver, NVDA, or a physical device ran in
 * the release container. It verifies the repository-wide DOM contracts those
 * native checks depend on and records the remaining native execution matrix.
 */
const fs = require('fs');
const path = require('path');
const {
  difference,
  expectedPolymythcalEventRoutes,
  inspectEventRouteDirectory,
  isRedirect,
  sourceHtmlDocuments,
  summarizeValues,
} = require('./lib/source-html-inventory');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'scripts', 'reports', 'audit48-assistive-technology.json');
const ID_REFERENCE_ATTRIBUTES = [
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
];
const failures = [];
const metrics = {
  source_html_documents: 0,
  interactive_documents: 0,
  redirect_documents: 0,
  canonical_events: 0,
  chronology_events: 0,
  quarantined_monitoring_records: 0,
  explicit_legacy_event_ids: 0,
  expected_english_event_routes: 0,
  expected_french_event_routes: 0,
  expected_english_event_aliases: 0,
  expected_french_event_aliases: 0,
  english_event_routes: 0,
  french_event_routes: 0,
  canonical_event_documents: 0,
  event_redirect_documents: 0,
  non_event_documents: 0,
  documents_with_two_progressive_h1_variants: 0,
  static_ids: 0,
  static_aria_id_references: 0,
  skip_links: 0,
  images: 0,
  buttons: 0,
};
const EXPECTED_DISCOVERY_COUNTS = Object.freeze({canonical: 2088, chronology: 1954, watchlist: 134});
const WATCHLIST_REASON = Object.freeze({
  code: 'monitoring-marker',
  detail: 'Displayed date is a monitoring marker, not a confirmed event or deadline date.',
});

function file(relative) {
  return path.join(ROOT, relative);
}
function read(relative) {
  try {
    return fs.readFileSync(file(relative), 'utf8');
  } catch {
    failures.push(`${relative} is missing`);
    return '';
  }
}
function check(condition, message) {
  if (!condition) failures.push(message);
}
function attribute(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? null;
}
function maskNonDom(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '');
}
function textAlternative(body) {
  return body
    .replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, match => {
      const title = match.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] || '';
      return ` ${title} `;
    })
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/gi, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}
function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function exactWatchlistReason(value) {
  return value
    && Object.keys(value).length === 2
    && value.code === WATCHLIST_REASON.code
    && value.detail === WATCHLIST_REASON.detail;
}
const documents = sourceHtmlDocuments(ROOT);
const documentSet = new Set(documents);
const redirectSet = new Set();
metrics.source_html_documents = documents.length;

for (const relative of documents) {
  const raw = read(relative);
  if (isRedirect(raw)) {
    metrics.redirect_documents += 1;
    redirectSet.add(relative);
    continue;
  }
  metrics.interactive_documents += 1;
  const html = maskNonDom(raw);
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || '';
  const titleBody = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] || '';
  const ids = new Map();

  check(Boolean(htmlTag), `${relative}: missing html element`);
  check(Boolean(attribute(htmlTag, 'lang')?.trim()), `${relative}: html lang is missing`);
  check(Boolean(textAlternative(titleBody)), `${relative}: document title is empty`);
  check(!/\btabindex\s*=\s*["']?[1-9]\d*["']?/i.test(html), `${relative}: positive tabindex changes reading order`);

  for (const match of html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const id = attribute(attrs, 'id');
    if (id) {
      metrics.static_ids += 1;
      if (ids.has(id)) failures.push(`${relative}: duplicate static id "${id}"`);
      else ids.set(id, tag);
    }
    check(
      !(attribute(attrs, 'aria-hidden') === 'true' && (tag === 'body' || tag === 'main')),
      `${relative}: ${tag} landmark is hidden from assistive technology`,
    );
  }

  const landmarks = [...html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)]
    .filter(match => {
      const tag = match[1].toLowerCase();
      const role = (attribute(match[2], 'role') || '').toLowerCase();
      return tag === 'main' || (tag !== 'main' && role === 'main');
    });
  check(landmarks.length === 1, `${relative}: expected one main landmark, found ${landmarks.length}`);

  const h1Count = (html.match(/<h1\b/gi) || []).length;
  if (relative === 'bookwormcard/index.html') {
    const progressiveContract = h1Count === 2
      && raw.includes('bookwormcard-static-title')
      && raw.includes('bookwormcard-runtime-title')
      && raw.includes('html.bookwormcard-js #static-bookwormcard-context');
    check(progressiveContract, `${relative}: progressive-enhancement H1 contract changed`);
    if (progressiveContract) metrics.documents_with_two_progressive_h1_variants += 1;
  } else {
    check(h1Count === 1, `${relative}: expected one H1, found ${h1Count}`);
  }

  for (const attrName of ID_REFERENCE_ATTRIBUTES) {
    const pattern = new RegExp(`\\b${attrName}\\s*=\\s*["']([^"']+)["']`, 'gi');
    for (const match of html.matchAll(pattern)) {
      for (const id of match[1].trim().split(/\s+/).filter(Boolean)) {
        metrics.static_aria_id_references += 1;
        const dynamicallyDeclared = raw.includes(`id="${id}"`)
          || raw.includes(`id='${id}'`);
        check(
          ids.has(id) || dynamicallyDeclared,
          `${relative}: ${attrName} references missing id "${id}"`,
        );
      }
    }
  }

  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    const attrs = match[1];
    const classes = (attribute(attrs, 'class') || '').split(/\s+/);
    if (!classes.includes('skip-link')) continue;
    metrics.skip_links += 1;
    const href = attribute(attrs, 'href') || '';
    const fragment = href.startsWith('#') ? decodeURIComponent(href.slice(1)) : '';
    check(Boolean(fragment) && ids.has(fragment), `${relative}: skip link target "${href}" does not resolve`);
  }

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    metrics.images += 1;
    check(attribute(match[1], 'alt') !== null, `${relative}: image is missing alt`);
  }

  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button\s*>/gi)) {
    metrics.buttons += 1;
    const attrs = match[1];
    const named = Boolean(
      textAlternative(match[2])
      || attribute(attrs, 'aria-label')?.trim()
      || attribute(attrs, 'aria-labelledby')?.trim()
      || attribute(attrs, 'title')?.trim(),
    );
    check(named, `${relative}: button has no static accessible name`);
  }
}

check(metrics.source_html_documents > 0, 'source HTML inventory is empty');
check(metrics.interactive_documents > 0, 'interactive source inventory is empty');
check(
  metrics.source_html_documents
    === metrics.interactive_documents + metrics.redirect_documents,
  'interactive and redirect inventories do not partition source HTML exactly',
);

let canonicalEvents = [];
let currentEvents = [];
let monitoringEvents = [];
try {
  const canonicalPayload = JSON.parse(read('data/polymyth-seminar-events.json'));
  const privateMirrorPayload = JSON.parse(read('polymythseminars/events.json'));
  const browsePayload = JSON.parse(read('polymythseminars/browse.json'));
  const watchlistPayload = JSON.parse(read('polymythseminars/watchlist.json'));
  const surface = JSON.parse(read('data/polymythcal-publication-surfaces.json'));
  canonicalEvents = canonicalPayload.events || [];
  const browseEvents = browsePayload.events || [];
  const watchlistItems = watchlistPayload.items || [];
  const canonicalIds = canonicalEvents.map(event => String(event.id));
  const browseIds = browseEvents.map(event => String(event.id));
  const watchlistIds = watchlistItems.map(event => String(event.id));
  const canonicalSet = new Set(canonicalIds);
  const browseSet = new Set(browseIds);
  const watchlistSet = new Set(watchlistIds);
  const partition = new Set([...browseIds, ...watchlistIds]);

  check(Array.isArray(canonicalPayload.events), 'data/polymyth-seminar-events.json has no events array');
  check(Array.isArray(privateMirrorPayload.events), 'polymythseminars/events.json has no events array');
  check(Array.isArray(browsePayload.events), 'polymythseminars/browse.json has no events array');
  check(Array.isArray(watchlistPayload.items), 'polymythseminars/watchlist.json has no items array');
  check(
    JSON.stringify(privateMirrorPayload) === JSON.stringify(canonicalPayload),
    'private canonical event mirrors differ',
  );
  check(
    !fs.existsSync(file('public/polymythseminars/events.json')),
    'public/polymythseminars/events.json exposes the private canonical corpus',
  );
  check(
    canonicalEvents.length === EXPECTED_DISCOVERY_COUNTS.canonical
      && browseEvents.length === EXPECTED_DISCOVERY_COUNTS.chronology
      && watchlistItems.length === EXPECTED_DISCOVERY_COUNTS.watchlist,
    `Discovery v2 split differs: ${canonicalEvents.length} canonical, ${browseEvents.length} chronology, ${watchlistItems.length} monitoring`,
  );
  check(
    canonicalSet.size === canonicalIds.length
      && browseSet.size === browseIds.length
      && watchlistSet.size === watchlistIds.length,
    'Discovery v2 canonical, chronology, or monitoring IDs are not unique',
  );
  check(
    !browseIds.some(id => watchlistSet.has(id))
      && partition.size === canonicalSet.size
      && [...partition].every(id => canonicalSet.has(id)),
    'chronology and monitoring records are not a disjoint exact partition of the private canonical corpus',
  );
  check(
    surface.schema === 'polymythcal-publication-surfaces-v2'
      && surface._schema === 'polymythcal-publication-surfaces-v2'
      && browsePayload._schema === 'polymythcal-discovery-v2'
      && watchlistPayload._schema === 'polymythcal-watchlist-v2',
    'Discovery v2 schemas differ from the governed publication contract',
  );
  check(
    surface.canonical_count === canonicalEvents.length
      && surface.chronology_count === browseEvents.length
      && surface.watchlist_count === watchlistItems.length
      && browsePayload.count === browseEvents.length
      && browsePayload._chronology_count === browseEvents.length
      && browsePayload._canonical_count === canonicalEvents.length
      && watchlistPayload.count === watchlistItems.length
      && watchlistPayload._canonical_count === canonicalEvents.length,
    'Discovery v2 declared counts differ from their payloads',
  );
  const reasonIds = Object.keys(surface.reasons || {});
  check(
    sameArray(surface.chronology_ids || [], browseIds)
      && sameArray(surface.watchlist_ids || [], watchlistIds)
      && sameArray(reasonIds, watchlistIds)
      && watchlistIds.every(id => exactWatchlistReason(surface.reasons?.[id])),
    'Discovery v2 publication IDs or monitoring reasons differ from the exact contract',
  );
  check(
    watchlistItems.every(item => !('date' in item)
      && !('end_date' in item)
      && item.date_status === 'awaiting-confirmed-date'),
    'monitoring records expose dates or lack awaiting-confirmed-date status',
  );

  currentEvents = canonicalEvents.filter(event => browseSet.has(String(event.id)));
  monitoringEvents = canonicalEvents.filter(event => watchlistSet.has(String(event.id)));
  check(
    currentEvents.length === browseEvents.length && monitoringEvents.length === watchlistItems.length,
    'canonical records cannot be resolved through the Discovery v2 publication IDs',
  );
  metrics.canonical_events = canonicalEvents.length;
  metrics.chronology_events = currentEvents.length;
  metrics.quarantined_monitoring_records = monitoringEvents.length;
} catch (error) {
  failures.push(`Discovery v2 publication data is invalid JSON: ${error.message}`);
}

try {
  const expectedRoutes = expectedPolymythcalEventRoutes(canonicalEvents);
  const englishRoutes = inspectEventRouteDirectory(ROOT, 'polymythseminars/events');
  const frenchRoutes = inspectEventRouteDirectory(ROOT, 'polymythseminars/fr/events');
  const missingEnglish = difference(expectedRoutes.englishRouteIds, englishRoutes.routeIds);
  const extraEnglish = difference(englishRoutes.routeIds, expectedRoutes.englishRouteIds);
  const missingFrench = difference(expectedRoutes.frenchRouteIds, frenchRoutes.routeIds);
  const extraFrench = difference(frenchRoutes.routeIds, expectedRoutes.frenchRouteIds);

  metrics.explicit_legacy_event_ids = expectedRoutes.explicitLegacyEntries;
  metrics.expected_english_event_routes = expectedRoutes.englishRouteIds.size;
  metrics.expected_french_event_routes = expectedRoutes.frenchRouteIds.size;
  metrics.expected_english_event_aliases = expectedRoutes.englishAliases.size;
  metrics.expected_french_event_aliases = expectedRoutes.frenchAliases.size;
  metrics.english_event_routes = englishRoutes.htmlRouteIds.size;
  metrics.french_event_routes = frenchRoutes.htmlRouteIds.size;
  metrics.canonical_event_documents = [...expectedRoutes.canonicalIds].reduce(
    (count, id) => count
      + Number(englishRoutes.htmlRouteIds.has(id))
      + Number(frenchRoutes.htmlRouteIds.has(id)),
    0,
  );
  metrics.event_redirect_documents = [...englishRoutes.htmlRouteIds]
    .filter(id => !expectedRoutes.canonicalIds.has(id)).length
    + [...frenchRoutes.htmlRouteIds]
      .filter(id => !expectedRoutes.canonicalIds.has(id)).length;
  metrics.non_event_documents = metrics.source_html_documents
    - metrics.english_event_routes - metrics.french_event_routes;

  check(
    missingEnglish.length === 0,
    `English event routes are missing: ${summarizeValues(missingEnglish)}`,
  );
  check(
    extraEnglish.length === 0,
    `English event routes are stale or unowned: ${summarizeValues(extraEnglish)}`,
  );
  check(
    missingFrench.length === 0,
    `French event routes are missing: ${summarizeValues(missingFrench)}`,
  );
  check(
    extraFrench.length === 0,
    `French event routes are stale or unowned: ${summarizeValues(extraFrench)}`,
  );
  check(
    englishRoutes.missingIndexIds.length === 0,
    `English event route directories lack index.html: ${summarizeValues(englishRoutes.missingIndexIds)}`,
  );
  check(
    frenchRoutes.missingIndexIds.length === 0,
    `French event route directories lack index.html: ${summarizeValues(frenchRoutes.missingIndexIds)}`,
  );

  const canonicalPaths = [...expectedRoutes.canonicalIds].flatMap(id => [
    `polymythseminars/events/${id}/index.html`,
    `polymythseminars/fr/events/${id}/index.html`,
  ]);
  const aliasPaths = [
    ...[...expectedRoutes.englishAliases.keys()]
      .map(id => `polymythseminars/events/${id}/index.html`),
    ...[...expectedRoutes.frenchAliases.keys()]
      .map(id => `polymythseminars/fr/events/${id}/index.html`),
  ];
  const missingCanonicalDocuments = canonicalPaths.filter(relative => !documentSet.has(relative));
  const redirectCanonicalDocuments = canonicalPaths.filter(relative => redirectSet.has(relative));
  const missingAliasDocuments = aliasPaths.filter(relative => !documentSet.has(relative));
  const interactiveAliasDocuments = aliasPaths
    .filter(relative => documentSet.has(relative) && !redirectSet.has(relative));
  check(
    missingCanonicalDocuments.length === 0,
    `canonical event documents are missing: ${summarizeValues(missingCanonicalDocuments)}`,
  );
  check(
    redirectCanonicalDocuments.length === 0,
    `canonical event documents became redirects: ${summarizeValues(redirectCanonicalDocuments)}`,
  );
  check(
    missingAliasDocuments.length === 0,
    `event alias documents are missing: ${summarizeValues(missingAliasDocuments)}`,
  );
  check(
    interactiveAliasDocuments.length === 0,
    `event alias documents are not redirects: ${summarizeValues(interactiveAliasDocuments)}`,
  );
  check(metrics.non_event_documents > 0, 'non-event source HTML inventory is empty');

  for (const event of monitoringEvents) {
    const eventId = String(event.id || event.identity_key);
    for (const localePath of ['events', 'fr/events']) {
      const relative = `polymythseminars/${localePath}/${eventId}/index.html`;
      const publicRelative = `public/${relative}`;
      const html = read(relative);
      check(
        /<meta\b(?=[^>]*name=["']robots["'])(?=[^>]*content=["']noindex,follow["'])[^>]*>/i.test(html),
        `${relative}: watchlist detail is indexable`,
      );
      check(
        !/<time\b[^>]*\bdatetime\s*=/i.test(html),
        `${relative}: watchlist detail exposes a date`,
      );
      check(
        !/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?["']@type["']\s*:\s*["']Event["']/i.test(html),
        `${relative}: watchlist detail exposes Event JSON-LD`,
      );
      const sourceExists = fs.existsSync(file(relative));
      const publicExists = fs.existsSync(file(publicRelative));
      check(
        sourceExists && publicExists
          && fs.readFileSync(file(relative)).equals(fs.readFileSync(file(publicRelative))),
        `${publicRelative}: missing or differs from source watchlist detail`,
      );
    }
  }
  for (const shell of [
    'polymythseminars/index.html',
    'polymythseminars/fr/index.html',
    'polymythseminars/monitoring/index.html',
    'polymythseminars/fr/monitoring/index.html',
    'polymythseminars/research/index.html',
    'polymythseminars/fr/research/index.html',
  ]) {
    check(documentSet.has(shell), `${shell}: published discovery shell is absent from the AT inventory`);
    check(!redirectSet.has(shell), `${shell}: published discovery shell became a redirect`);
  }
} catch (error) {
  failures.push(`Polymythcal event-route inventory is invalid: ${error.message}`);
}

const keyboardGate = read('scripts/verify-keyboard-navigation.js');
const inputGate = read('scripts/verify-visible-input-labels.js');
const accessibilityGate = read('scripts/verify-audit38-accessibility-p0.mjs');
check(keyboardGate.includes('defaultPrevented'), 'keyboard gate does not preserve canceled events');
check(keyboardGate.includes('metaKey') && keyboardGate.includes('ctrlKey'), 'keyboard gate lacks modifier-key restraint');
check(inputGate.includes('VISIBLE INPUT LABEL CHECK PASSED'), 'visible-input label gate is not active');
check(accessibilityGate.includes('ACCESSIBILITY P0'), 'browser accessibility prerequisite gate is not active');

const report = {
  schema: 'seminar-schools-audit48-assistive-technology-v1',
  release_id: read('RELEASE_ID.txt').trim() || null,
  generated_at: (() => {
    try {
      return JSON.parse(read('RELEASE_MANIFEST.json')).generated_at || null;
    } catch {
      failures.push('RELEASE_MANIFEST.json is invalid JSON');
      return null;
    }
  })(),
  status: failures.length ? 'failed' : 'passed',
  scope: 'repository-wide static assistive-technology prerequisites',
  metrics,
  machine_validated_contracts: [
    'declared-document-language',
    'single-main-landmark',
    'single-effective-h1-with-bookwormcard-progressive-enhancement-contract',
    'source-order-tab-navigation',
    'unique-static-ids',
    'resolved-static-aria-id-references',
    'resolved-skip-links',
    'image-alt-contract',
    'static-button-names',
    'dynamic-canonical-and-legacy-event-route-inventory',
    'existing-keyboard-input-and-browser-accessibility-gates',
  ],
  native_execution_status: 'requires-native-operating-systems-physical-devices-and-human-observation',
  native_runs_required: [
    'macOS Safari with VoiceOver',
    'Windows Firefox with NVDA',
    'Windows Chrome with NVDA',
    'iPhone Safari with VoiceOver',
    'Android Chrome with TalkBack',
    'real-user task completion and comprehension session',
  ],
  references: [
    'https://support.apple.com/guide/voiceover/welcome-voic010/mac',
    'https://support.apple.com/guide/voiceover/vo35709/mac',
    'https://download.nvaccess.org/documentation/en/userGuide.html',
    'https://www.nvaccess.org/get-help/',
  ],
  protocol: 'AUDIT48_NATIVE_DEVICE_AT_TEST_PROTOCOL_2026-07-26.md',
  failures,
};
fs.mkdirSync(path.dirname(REPORT), {recursive: true});
const rendered = JSON.stringify(report, null, 2) + '\n';
if (!fs.existsSync(REPORT) || fs.readFileSync(REPORT, 'utf8') !== rendered) {
  fs.writeFileSync(REPORT, rendered, 'utf8');
}
if (process.env.SS_REPORT_OUTPUT_MTIME) {
  const stamp = new Date(process.env.SS_REPORT_OUTPUT_MTIME);
  if (Number.isNaN(stamp.getTime())) {
    throw new Error('SS_REPORT_OUTPUT_MTIME must be a valid timestamp');
  }
  fs.utimesSync(REPORT, stamp, stamp);
}

if (failures.length) {
  console.error(`AUDIT48 ASSISTIVE-TECHNOLOGY PREREQUISITES FAILED (${failures.length})`);
  failures.slice(0, 100).forEach(message => console.error(` - ${message}`));
  if (failures.length > 100) console.error(` - … ${failures.length - 100} more`);
  process.exit(1);
}
console.log(
  `AUDIT48 ASSISTIVE-TECHNOLOGY PREREQUISITES PASSED — `
  + `${metrics.interactive_documents} interactive pages, ${metrics.redirect_documents} redirects, `
  + `${metrics.static_aria_id_references} static ARIA references, ${metrics.skip_links} skip links, `
  + `${metrics.images} images, and ${metrics.buttons} buttons checked.`,
);
