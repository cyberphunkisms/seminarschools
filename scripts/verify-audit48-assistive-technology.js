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

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'scripts', 'reports', 'audit48-assistive-technology.json');
const SOURCE_HTML_ROOTS = [
  '.well-known', 'agora', 'aitr', 'aa', 'bb', 'bookwormcard', 'campaigns',
  'cfps', 'fellowships', 'florilegium', 'humanities', 'lectures', 'leizu',
  'about', 'main', 'marginalia', 'nutrition', 'ohm-dome', 'philosophy',
  'polymyth', 'polymythcal', 'polymythcommons', 'polymythlib',
  'polymythseminars', 'reviews', 'saul', 'seminars',
  'sitemap', 'teacherresources', 'university', 'writingclub', 'writinggrads',
  'writingjuniors', 'writingkids', 'writingteens',
];
const EXPECTED_INTERACTIVE_DOCUMENTS = 2859;
const EXPECTED_REDIRECT_DOCUMENTS = 890;
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
  documents_with_two_progressive_h1_variants: 0,
  static_ids: 0,
  static_aria_id_references: 0,
  skip_links: 0,
  images: 0,
  buttons: 0,
};

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
function walkHtml(relative) {
  const start = file(relative);
  if (!fs.existsSync(start)) return [];
  const results = [];
  const stack = [start];
  while (stack.length) {
    const active = stack.pop();
    for (const entry of fs.readdirSync(active, {withFileTypes: true})) {
      const target = path.join(active, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        results.push(path.relative(ROOT, target).split(path.sep).join('/'));
      }
    }
  }
  return results;
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
function isRedirect(html) {
  return /<meta\b(?=[^>]*\bhttp-equiv=["']refresh["'])[^>]*>/i.test(html);
}

const rootHtml = fs.readdirSync(ROOT, {withFileTypes: true})
  .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
  .map(entry => entry.name)
  .filter(name => !/^google.*\.html$/i.test(name));
const documents = [...new Set([
  ...rootHtml,
  ...SOURCE_HTML_ROOTS.flatMap(walkHtml),
])].sort();
metrics.source_html_documents = documents.length;

for (const relative of documents) {
  const raw = read(relative);
  if (isRedirect(raw)) {
    metrics.redirect_documents += 1;
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

check(
  metrics.interactive_documents === EXPECTED_INTERACTIVE_DOCUMENTS,
  `interactive source inventory is ${metrics.interactive_documents}/${EXPECTED_INTERACTIVE_DOCUMENTS}`,
);
check(
  metrics.redirect_documents === EXPECTED_REDIRECT_DOCUMENTS,
  `redirect source inventory is ${metrics.redirect_documents}/${EXPECTED_REDIRECT_DOCUMENTS}`,
);
check(
  metrics.source_html_documents
    === EXPECTED_INTERACTIVE_DOCUMENTS + EXPECTED_REDIRECT_DOCUMENTS,
  `source HTML inventory is ${metrics.source_html_documents}/`
    + `${EXPECTED_INTERACTIVE_DOCUMENTS + EXPECTED_REDIRECT_DOCUMENTS}`,
);

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
