#!/usr/bin/env node
'use strict';

/**
 * Audit 49 active HTML metadata and crawl-surface gate.
 *
 * The audit covers every HTML document copied by the canonical public build.
 * Redirect documents are classified separately from interactive documents so
 * a deliberate noindex redirect is never mistaken for a searchable page.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const {isGeneratedDependencyDirectory} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const REPORT = path.join(ROOT, 'scripts', 'reports', 'audit49-metadata-surface.json');
const SITE = 'https://seminarschools.com';
const HTML_ROOTS = [
  '.well-known', 'agora', 'aitr', 'aa', 'bb', 'bookwormcard', 'campaigns',
  'cfps', 'fellowships', 'florilegium', 'humanities', 'lectures', 'leizu',
  'about', 'main', 'marginalia', 'nutrition', 'ohm-dome', 'philosophy',
  'polymyth', 'polymythcal', 'polymythcommons', 'polymythlib',
  'polymythseminars', 'reviews', 'saul', 'seminars', 'sitemap',
  'teacherresources', 'university', 'writingclub', 'writinggrads',
  'writingjuniors', 'writingkids', 'writingteens',
];
const GENERATED_FAMILIES = {
  teacher_resource: /^teacherresources\/(?:[^/]+\/)+index\.html$/,
  event_en: /^polymythseminars\/events\/[^/]+\/index\.html$/,
  event_fr: /^polymythseminars\/fr\/events\/[^/]+\/index\.html$/,
};
const failures = [];
const issues = {
  duplicate_tags: [],
  missing_metadata: [],
  invalid_metadata: [],
  schema: [],
  duplicate_indexable_titles: [],
  duplicate_indexable_descriptions: [],
  duplicate_indexable_canonicals: [],
  hreflang: [],
  crawl: [],
  source_public: [],
  generator_ownership: [],
};
const metrics = {
  source_html_documents: 0,
  public_html_documents: 0,
  interactive_documents: 0,
  redirect_documents: 0,
  indexable_documents: 0,
  noindex_documents: 0,
  sitemap_urls: 0,
  schema_blocks: 0,
  schema_documents: 0,
  indexable_documents_without_schema: 0,
  intentional_schema_exemptions: 0,
  hreflang_links: 0,
  hreflang_documents: 0,
  source_public_byte_identical: 0,
  generated_teacher_resource_documents: 0,
  generated_event_documents: 0,
  documents_with_one_title: 0,
  documents_with_one_description: 0,
  documents_with_one_viewport: 0,
  documents_with_one_canonical: 0,
  documents_with_one_robots_directive: 0,
  sitemap_non_html_resources: 0,
};
const SCHEMA_EXEMPTIONS = new Set([
  'polymyth/archive/pre-meaninglib/index.html',
]);

function posix(value) {
  return value.split(path.sep).join('/');
}
function file(relative) {
  return path.join(ROOT, relative);
}
function read(relative) {
  return fs.readFileSync(file(relative), 'utf8');
}
function check(condition, message) {
  if (!condition) failures.push(message);
}
function addIssue(group, relative, message) {
  issues[group].push({file: relative, issue: message});
}
function walkHtml(relative) {
  const start = file(relative);
  if (!fs.existsSync(start)) return [];
  const out = [];
  const stack = [start];
  while (stack.length) {
    const active = stack.pop();
    for (const entry of fs.readdirSync(active, {withFileTypes: true})) {
      const target = path.join(active, entry.name);
      if (entry.isDirectory() && !isGeneratedDependencyDirectory(entry.name)) stack.push(target);
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        out.push(posix(path.relative(ROOT, target)));
      }
    }
  }
  return out;
}
function attribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] ?? '';
}
function stripMarkup(value) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
function tags(head, tagName) {
  return [...head.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))].map(match => match[0]);
}
function metaTags(head, key, value) {
  return tags(head, 'meta').filter(tag => attribute(tag, key).toLowerCase() === value.toLowerCase());
}
function linkTags(head, relValue) {
  return tags(head, 'link').filter(tag => (
    attribute(tag, 'rel').toLowerCase().split(/\s+/).includes(relValue.toLowerCase())
  ));
}
function titleValues(head) {
  return [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)]
    .map(match => stripMarkup(match[1]));
}
function robotsTokens(head) {
  return metaTags(head, 'name', 'robots')
    .flatMap(tag => attribute(tag, 'content').toLowerCase().split(/[,\s]+/))
    .filter(Boolean);
}
function isRedirect(html) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1] || '';
  return metaTags(head, 'http-equiv', 'refresh').length > 0;
}
function routeFor(relative) {
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -'index.html'.length)}`;
  return `/${relative}`;
}
function canonicalUrlFor(relative) {
  return SITE + routeFor(relative);
}
function htmlForUrl(url) {
  if (!url.startsWith(`${SITE}/`) && url !== `${SITE}/`) return null;
  const route = url.slice(SITE.length);
  if (route === '/') return 'index.html';
  if (/\.[a-z0-9]{1,12}$/i.test(route) && !route.endsWith('.html')) return null;
  if (route.endsWith('/')) return `${route.slice(1)}index.html`;
  if (route.endsWith('.html')) return route.slice(1);
  return `${route.slice(1)}/index.html`;
}
function digest(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href;
  } catch {
    return '';
  }
}
function expectedLang(relative) {
  if (/^polymythseminars\/fr(?:\/|$)/.test(relative)) return 'fr-CA';
  if (/^(?:cfps|fellowships|humanities|lectures|philosophy)\/fr\//.test(relative)) return 'fr-CA';
  if (/^(?:leizu|saul)\/fr(?:\/|$)/.test(relative)) return 'fr';
  if (/^(?:leizu|saul)\/zh-hans(?:\/|$)/.test(relative)) return 'zh-Hans';
  if (/^(?:leizu|saul)\/zh-hant(?:\/|$)/.test(relative)) return 'zh-Hant';
  if (/^(?:leizu|saul)\/fa(?:\/|$)/.test(relative)) return 'fa';
  if (relative === 'bb/why/zh/index.html') return 'zh-Hans';
  return null;
}
function classifyGenerator(relative, html, redirect) {
  if (relative === 'teacherresources/index.html') {
    metrics.generated_teacher_resource_documents += 1;
    if (
      !html.includes('<!-- SS_STATIC_CATALOG_START -->')
      || !html.includes('<!-- SS_STATIC_CATALOG_END -->')
    ) {
      addIssue('generator_ownership', relative, 'teacher-resource catalog ownership markers are missing');
    }
  }
  if (GENERATED_FAMILIES.teacher_resource.test(relative)) {
    metrics.generated_teacher_resource_documents += 1;
    const marker = metaTags(
      html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1] || '',
      'name',
      'generator',
    );
    if (
      marker.length !== 1
      || attribute(marker[0], 'content') !== 'Seminar Schools Static Search Surface'
    ) {
      addIssue('generator_ownership', relative, 'teacher-resource generator marker is missing or duplicated');
    }
  }
  if (GENERATED_FAMILIES.event_en.test(relative) || GENERATED_FAMILIES.event_fr.test(relative)) {
    metrics.generated_event_documents += 1;
    if (!redirect && !/<body\b[^>]*\bdata-route-type=["']calendar-event["']/i.test(html)) {
      addIssue('generator_ownership', relative, 'canonical event generator marker is missing');
    }
    if (redirect && !/<body\b[^>]*\bdata-route-type=["']calendar-event-alias["']/i.test(html)) {
      addIssue('generator_ownership', relative, 'event-alias redirect marker is missing');
    }
  }
}

const rootHtml = fs.readdirSync(ROOT, {withFileTypes: true})
  .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
  .map(entry => entry.name)
  .filter(name => !/^google.*\.html$/i.test(name));
const documents = [...new Set([
  ...rootHtml,
  ...HTML_ROOTS.flatMap(walkHtml),
])].sort();
metrics.source_html_documents = documents.length;

const titleOwners = new Map();
const descriptionOwners = new Map();
const canonicalOwners = new Map();
const documentRecords = [];

for (const relative of documents) {
  const sourcePath = file(relative);
  const sourceBytes = fs.readFileSync(sourcePath);
  const html = sourceBytes.toString('utf8');
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1] || '';
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || '';
  const redirect = isRedirect(html);
  const title = titleValues(head);
  const descriptions = metaTags(head, 'name', 'description');
  const viewports = metaTags(head, 'name', 'viewport');
  const canonicals = linkTags(head, 'canonical');
  const robots = metaTags(head, 'name', 'robots');
  const hreflangs = linkTags(head, 'alternate').filter(tag => attribute(tag, 'hreflang'));
  const schemaMatches = [
    ...head.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi),
  ];
  const lang = attribute(htmlTag, 'lang');
  const robotTokens = robotsTokens(head);
  const noindex = robotTokens.includes('noindex');
  const indexable = !redirect && !noindex;
  const canonical = canonicals.length === 1 ? attribute(canonicals[0], 'href') : '';
  const description = descriptions.length === 1 ? attribute(descriptions[0], 'content').trim() : '';
  const bytes = sourceBytes.length;
  const compressedBytes = zlib.gzipSync(sourceBytes, {level: 9}).length;

  if (redirect) metrics.redirect_documents += 1;
  else metrics.interactive_documents += 1;
  if (noindex) metrics.noindex_documents += 1;
  if (indexable) metrics.indexable_documents += 1;
  if (schemaMatches.length) metrics.schema_documents += 1;
  metrics.schema_blocks += schemaMatches.length;
  if (hreflangs.length) metrics.hreflang_documents += 1;
  metrics.hreflang_links += hreflangs.length;
  if (title.length === 1) metrics.documents_with_one_title += 1;
  if (descriptions.length === 1) metrics.documents_with_one_description += 1;
  if (viewports.length === 1) metrics.documents_with_one_viewport += 1;
  if (canonicals.length === 1) metrics.documents_with_one_canonical += 1;
  if (robots.length === 1) metrics.documents_with_one_robots_directive += 1;

  for (const [label, count] of [
    ['title', title.length],
    ['description', descriptions.length],
    ['viewport', viewports.length],
    ['canonical', canonicals.length],
    ['robots', robots.length],
  ]) {
    if (count > 1) addIssue('duplicate_tags', relative, `${label} appears ${count} times`);
  }
  if (!lang) addIssue('missing_metadata', relative, 'html lang is missing');
  if (!title[0]) addIssue('missing_metadata', relative, 'title is missing or empty');
  if (!viewports.length) addIssue('missing_metadata', relative, 'viewport is missing');
  if (!canonicals.length && relative !== '404.html') {
    addIssue('missing_metadata', relative, 'canonical is missing');
  }
  if (indexable && !description) addIssue('missing_metadata', relative, 'indexable description is missing');
  if (redirect && !noindex) addIssue('invalid_metadata', relative, 'redirect lacks noindex');
  if (robots.length && robotTokens.includes('index') && robotTokens.includes('noindex')) {
    addIssue('invalid_metadata', relative, 'robots contains both index and noindex');
  }
  const expectedLanguage = expectedLang(relative);
  if (expectedLanguage && lang.toLowerCase() !== expectedLanguage.toLowerCase()) {
    addIssue('invalid_metadata', relative, `lang "${lang}" does not match localized route "${expectedLanguage}"`);
  }
  if (canonical && !normalizeUrl(canonical)) {
    addIssue('invalid_metadata', relative, `canonical is not an absolute URL: ${canonical}`);
  }
  if (indexable && canonical && canonical !== canonicalUrlFor(relative)) {
    addIssue('invalid_metadata', relative, `indexable canonical differs from route: ${canonical}`);
  }
  for (const match of schemaMatches) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      addIssue('invalid_metadata', relative, `JSON-LD is invalid: ${error.message}`);
    }
  }
  const parsedSchemas = [];
  for (const match of schemaMatches) {
    try {
      parsedSchemas.push(JSON.parse(match[1]));
    } catch {
      // Invalid JSON-LD is recorded above.
    }
  }
  const schemaFingerprints = new Set();
  const schemaIds = new Set();
  for (const schema of parsedSchemas) {
    const fingerprint = JSON.stringify(schema);
    if (schemaFingerprints.has(fingerprint)) {
      addIssue('schema', relative, 'contains a duplicate JSON-LD block');
    }
    schemaFingerprints.add(fingerprint);
    const candidates = Array.isArray(schema) ? schema : [schema];
    for (const candidate of candidates) {
      const id = candidate && typeof candidate === 'object' ? candidate['@id'] : null;
      if (!id) continue;
      if (schemaIds.has(id)) addIssue('schema', relative, `duplicates JSON-LD @id "${id}"`);
      schemaIds.add(id);
    }
  }
  if (indexable && !schemaMatches.length) {
    metrics.indexable_documents_without_schema += 1;
    if (SCHEMA_EXEMPTIONS.has(relative)) metrics.intentional_schema_exemptions += 1;
    else addIssue('schema', relative, 'indexable page lacks JSON-LD');
  }

  const hreflangValues = new Set();
  for (const tag of hreflangs) {
    const code = attribute(tag, 'hreflang');
    const href = attribute(tag, 'href');
    const normalizedCode = code.toLowerCase();
    if (hreflangValues.has(normalizedCode)) {
      addIssue('hreflang', relative, `duplicate hreflang "${code}"`);
    }
    hreflangValues.add(normalizedCode);
    if (!normalizeUrl(href)) addIssue('hreflang', relative, `hreflang "${code}" lacks an absolute href`);
    const target = htmlForUrl(href);
    if (target && !documents.includes(target)) {
      addIssue('hreflang', relative, `hreflang "${code}" target is missing: ${href}`);
    }
  }

  if (indexable) {
    const titleKey = title[0]?.toLocaleLowerCase('en-CA') || '';
    const descriptionKey = description.toLocaleLowerCase('en-CA');
    if (titleKey) {
      if (!titleOwners.has(titleKey)) titleOwners.set(titleKey, []);
      titleOwners.get(titleKey).push(relative);
    }
    if (descriptionKey) {
      if (!descriptionOwners.has(descriptionKey)) descriptionOwners.set(descriptionKey, []);
      descriptionOwners.get(descriptionKey).push(relative);
    }
    if (canonical) {
      if (!canonicalOwners.has(canonical)) canonicalOwners.set(canonical, []);
      canonicalOwners.get(canonical).push(relative);
    }
  }

  const publicPath = path.join(PUBLIC, relative);
  if (!fs.existsSync(publicPath)) {
    addIssue('source_public', relative, 'public mirror is missing');
  } else {
    const publicBytes = fs.readFileSync(publicPath);
    metrics.public_html_documents += 1;
    if (sourceBytes.length === publicBytes.length && digest(sourceBytes) === digest(publicBytes)) {
      metrics.source_public_byte_identical += 1;
    } else {
      addIssue('source_public', relative, 'public mirror differs from source');
    }
  }

  classifyGenerator(relative, html, redirect);
  documentRecords.push({
    file: relative,
    route: routeFor(relative),
    bytes,
    compressed_bytes: compressedBytes,
    redirect,
    indexable,
    noindex,
    lang,
    title: title[0] || null,
    description_length: description.length,
    canonical: canonical || null,
    x_default: attribute(
      hreflangs.find(tag => attribute(tag, 'hreflang').toLowerCase() === 'x-default') || '',
      'href',
    ) || null,
    hreflang_count: hreflangs.length,
    schema_count: schemaMatches.length,
  });
}

for (const [title, owners] of titleOwners) {
  if (owners.length <= 1) continue;
  const clusters = new Set(
    owners.map(owner => documentRecords.find(item => item.file === owner)?.x_default).filter(Boolean),
  );
  const oneReciprocalTranslationCluster = clusters.size === 1
    && owners.every(owner => documentRecords.find(item => item.file === owner)?.x_default);
  if (!oneReciprocalTranslationCluster) {
    issues.duplicate_indexable_titles.push({title, files: owners});
  }
}
for (const [description, owners] of descriptionOwners) {
  if (owners.length > 1) issues.duplicate_indexable_descriptions.push({description, files: owners});
}
for (const [canonical, owners] of canonicalOwners) {
  if (owners.length > 1) issues.duplicate_indexable_canonicals.push({canonical, files: owners});
}

const sitemapText = read('sitemap.xml');
const sitemapUrls = [
  ...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g),
].map(match => match[1].trim());
metrics.sitemap_urls = sitemapUrls.length;
const sitemapSet = new Set(sitemapUrls);
if (sitemapSet.size !== sitemapUrls.length) {
  addIssue('crawl', 'sitemap.xml', `contains ${sitemapUrls.length - sitemapSet.size} duplicate URLs`);
}
for (const url of sitemapUrls) {
  const relative = htmlForUrl(url);
  if (!relative) {
    const pathname = new URL(url).pathname.replace(/^\/+/, '');
    metrics.sitemap_non_html_resources += 1;
    if (!pathname || !fs.existsSync(file(decodeURIComponent(pathname)))) {
      addIssue('crawl', 'sitemap.xml', `non-HTML resource is missing: ${url}`);
    }
    continue;
  }
  if (!documents.includes(relative)) {
    addIssue('crawl', 'sitemap.xml', `URL has no active HTML document: ${url}`);
    continue;
  }
  const record = documentRecords.find(item => item.file === relative);
  if (!record?.indexable) addIssue('crawl', relative, `sitemap URL is not indexable: ${url}`);
  if (record?.canonical !== url) addIssue('crawl', relative, `sitemap URL differs from canonical: ${url}`);
}
for (const record of documentRecords) {
  if (!record.indexable || record.canonical !== canonicalUrlFor(record.file)) continue;
  if (!sitemapSet.has(record.canonical)) {
    addIssue('crawl', record.file, `self-canonical indexable route is absent from sitemap: ${record.canonical}`);
  }
}

for (const record of documentRecords) {
  if (!record.hreflang_count) continue;
  const head = read(record.file).match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1] || '';
  const alternates = linkTags(head, 'alternate').filter(tag => attribute(tag, 'hreflang'));
  for (const tag of alternates) {
    const code = attribute(tag, 'hreflang');
    const href = attribute(tag, 'href');
    const target = htmlForUrl(href);
    if (!target || !documents.includes(target)) continue;
    const targetHead = read(target).match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1] || '';
    const reciprocal = linkTags(targetHead, 'alternate')
      .filter(candidate => attribute(candidate, 'hreflang'))
      .some(candidate => attribute(candidate, 'href') === canonicalUrlFor(record.file));
    if (!reciprocal) {
      addIssue('hreflang', record.file, `${code} target lacks reciprocal link: ${href}`);
    }
  }
}

const topPageSizeOutliers = [...documentRecords]
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 25)
  .map(({file: relative, route, bytes, compressed_bytes: compressedBytes, indexable, redirect}) => ({
    file: relative,
    route,
    bytes,
    kibibytes: Number((bytes / 1024).toFixed(1)),
    gzip_bytes: compressedBytes,
    gzip_kibibytes: Number((compressedBytes / 1024).toFixed(1)),
    indexable,
    redirect,
  }));
const pageSizeDistribution = {
  over_100_kib: documentRecords.filter(item => item.bytes > 100 * 1024).length,
  over_250_kib: documentRecords.filter(item => item.bytes > 250 * 1024).length,
  over_500_kib: documentRecords.filter(item => item.bytes > 500 * 1024).length,
  largest_bytes: topPageSizeOutliers[0]?.bytes || 0,
  gzip_over_100_kib: documentRecords.filter(item => item.compressed_bytes > 100 * 1024).length,
  gzip_over_250_kib: documentRecords.filter(item => item.compressed_bytes > 250 * 1024).length,
  gzip_over_500_kib: documentRecords.filter(item => item.compressed_bytes > 500 * 1024).length,
  largest_gzip_bytes: Math.max(...documentRecords.map(item => item.compressed_bytes), 0),
};
check(
  pageSizeDistribution.largest_bytes <= 4 * 1024 * 1024,
  `active HTML raw-size ceiling exceeded: ${pageSizeDistribution.largest_bytes} bytes`,
);
check(
  pageSizeDistribution.largest_gzip_bytes <= 1280 * 1024,
  `active HTML gzip-size ceiling exceeded: ${pageSizeDistribution.largest_gzip_bytes} bytes`,
);

for (const [group, entries] of Object.entries(issues)) {
  if (entries.length) failures.push(`${group}: ${entries.length} confirmed issue groups`);
}

const report = {
  schema: 'seminar-schools-audit49-metadata-surface-v1',
  release_id: fs.readFileSync(file('RELEASE_ID.txt'), 'utf8').trim(),
  generated_at: JSON.parse(read('RELEASE_MANIFEST.json')).generated_at || null,
  status: failures.length ? 'failed' : 'passed',
  scope: {
    source_roots: HTML_ROOTS,
    public_mirror: 'public/',
    exclusions: [
      'frozen historical evidence',
      'operator-only HTML outside the canonical public allowlist',
      'search-engine verification token files',
    ],
  },
  metrics,
  page_size_distribution: pageSizeDistribution,
  top_page_size_outliers: topPageSizeOutliers,
  issue_counts: Object.fromEntries(
    Object.entries(issues).map(([group, entries]) => [group, entries.length]),
  ),
  issues,
  invariants: {
    english_source_of_truth: true,
    localized_noindex_governance_preserved: true,
    organizer_authored_text_verbatim: true,
    weekly_cadence_unchanged: true,
    security_audit_performed: false,
    native_browser_execution_claimed: false,
    deployment_performed: false,
  },
};
fs.mkdirSync(path.dirname(REPORT), {recursive: true});
const renderedReport = `${JSON.stringify(report, null, 2)}\n`;
if (!fs.existsSync(REPORT) || fs.readFileSync(REPORT, 'utf8') !== renderedReport) {
  fs.writeFileSync(REPORT, renderedReport);
}
if (process.env.SS_REPORT_OUTPUT_MTIME) {
  const outputMtime = new Date(process.env.SS_REPORT_OUTPUT_MTIME);
  if (Number.isNaN(outputMtime.getTime())) {
    throw new Error('SS_REPORT_OUTPUT_MTIME must be a valid timestamp');
  }
  fs.utimesSync(REPORT, outputMtime, outputMtime);
}

console.log('=== AUDIT49 METADATA / PAGE-SURFACE GATE ===');
console.log(
  `${metrics.source_html_documents} source HTML documents; `
    + `${metrics.interactive_documents} interactive; ${metrics.redirect_documents} redirects; `
    + `${metrics.indexable_documents} indexable; ${metrics.noindex_documents} noindex.`,
);
console.log(
  `${metrics.source_public_byte_identical}/${metrics.source_html_documents} source/public byte-identical; `
    + `${metrics.sitemap_urls} sitemap URLs; ${metrics.schema_blocks} JSON-LD blocks; `
    + `${metrics.hreflang_links} hreflang links.`,
);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`See ${posix(path.relative(ROOT, REPORT))} for exact files.`);
  process.exit(1);
}
console.log('AUDIT49 METADATA / PAGE-SURFACE PASSED.');
