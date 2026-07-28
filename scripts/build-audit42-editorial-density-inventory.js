#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'audit42-editorial-density-inventory.json');
const CHECK = process.argv.includes('--check');
const LONG_TEACHER_DESCRIPTION_WORDS = 75;
const MINIMUM_REVIEW_OUTLIER_WORDS = 120;
const LONG_PARAGRAPH_WORDS = 120;

// Audit 34 named these three project entry routes, rather than every reference
// route below their URL prefixes. Keep this scope explicit so the inventory is
// useful, bounded, and does not silently turn into a whole-site copy rewrite.
const PROJECT_ROUTES = [
  {
    family: 'bb',
    route: '/bb/',
    file: 'bb/index.html',
    disposition: 'concise_ui_preserved',
    note: 'The landing route uses short action cards and a compact play explanation; the linked research and rules routes carry the depth.',
  },
  {
    family: 'polymyth',
    route: '/polymyth/',
    file: 'polymyth/index.html',
    disposition: 'intentional_longform_editorial_preserved',
    note: 'The project entry includes an authored philosophical account. Its long paragraphs are editorial substance, while tool entry points remain brief and separately scannable.',
  },
  {
    family: 'leizu',
    route: '/leizu/',
    file: 'leizu/index.html',
    disposition: 'intentional_catalog_and_reference_density_preserved',
    note: 'The route combines course selection, programme terms, pricing, and parent FAQs. Chapter grouping and clearly labelled question structures contain this decision-support density.',
  },
];

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function decodeEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    hellip: '…',
    laquo: '«',
    ldquo: '“',
    lsquo: '‘',
    lt: '<',
    mdash: '—',
    middot: '·',
    nbsp: ' ',
    ndash: '–',
    quot: '"',
    raquo: '»',
    rdquo: '”',
    rsquo: '’',
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => (
      Object.prototype.hasOwnProperty.call(named, name.toLowerCase())
        ? named[name.toLowerCase()]
        : match
    ));
}

function visibleText(fragment) {
  return decodeEntities(
    fragment
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|template|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|li|h[1-6]|section|article|div|details|summary)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function words(value) {
  return value.match(/[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu) || [];
}

function sentenceCount(value) {
  const normalized = value.trim();
  if (!normalized) return 0;
  return Math.max(1, (normalized.match(/[.!?]+(?:\s|$)/g) || []).length);
}

function mainFragment(source) {
  const match = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (!match) throw new Error('Expected one authored <main> region');
  return match[1];
}

function paragraphMetrics(fragment) {
  const rows = [];
  for (const match of fragment.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)) {
    const text = visibleText(match[2]);
    const count = words(text).length;
    if (!count) continue;
    rows.push({
      words: count,
      characters: text.length,
      sentences: sentenceCount(text),
      preview: text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text,
    });
  }
  return rows;
}

function routeMetrics(definition) {
  const source = fs.readFileSync(path.join(ROOT, definition.file), 'utf8');
  const main = mainFragment(source);
  const text = visibleText(main);
  const paragraphs = paragraphMetrics(main);
  const paragraphWords = paragraphs.map(row => row.words);
  const headingCount = (main.match(/<h[1-6]\b/gi) || []).length;
  const disclosureCount = (main.match(/<details\b/gi) || []).length;
  return {
    family: definition.family,
    route: definition.route,
    file: definition.file,
    main_words: words(text).length,
    paragraphs: paragraphs.length,
    headings: headingCount,
    native_disclosures: disclosureCount,
    average_paragraph_words: paragraphs.length
      ? Number((paragraphWords.reduce((sum, value) => sum + value, 0) / paragraphs.length).toFixed(1))
      : 0,
    longest_paragraph_words: paragraphWords.length ? Math.max(...paragraphWords) : 0,
    paragraphs_at_least_120_words: paragraphWords.filter(value => value >= LONG_PARAGRAPH_WORDS).length,
    disposition: definition.disposition,
    review_flag: false,
    disposition_note: definition.note,
  };
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i'));
  return decodeEntities(match?.[1] ?? match?.[2] ?? '');
}

function canonicalTeacherEntries() {
  const dataFile = path.join(ROOT, 'teacherresources', 'resources-data.json');
  const indexFile = path.join(ROOT, 'teacherresources', 'index.html');
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const entries = (data.groups || []).flatMap(group => (
    (group.categories || []).flatMap(category => (
      (category.entries || []).map(entry => ({
        ...entry,
        group_id: group.id,
        collection_id: category.id,
      }))
    ))
  ));
  const html = fs.readFileSync(indexFile, 'utf8');
  const tags = html.match(/<a\b[^>]*\bclass="entry(?:\s[^"]*)?"[^>]*>/g) || [];
  if (entries.length !== 644 || tags.length !== entries.length) {
    throw new Error(
      `Expected 644 canonical Teacher Resources entries/routes; found ${entries.length} `
        + `data entries and ${tags.length} rendered routes`,
    );
  }
  const mapped = entries.map((entry, index) => {
    const route = attribute(tags[index], 'href');
    if (!/^\/teacherresources\/.+\/$/.test(route)) {
      throw new Error(`Teacher Resources record ${index + 1} has a non-canonical route: ${route}`);
    }
    const detailFile = path.join(ROOT, route.slice(1), 'index.html');
    if (!fs.existsSync(detailFile)) {
      throw new Error(`Teacher Resources detail route is missing: ${relative(detailFile)}`);
    }
    const detailSource = fs.readFileSync(detailFile, 'utf8');
    const hasClassroomFit = /<h2\b[^>]*>\s*Classroom fit\s*<\/h2>/i.test(detailSource);
    const hasAuthoredDescription = Boolean(entry.notes || entry.blurb);
    if (hasClassroomFit !== hasAuthoredDescription) {
      throw new Error(
        `${route} description parity changed: data=${hasAuthoredDescription}, `
          + `route=${hasClassroomFit}`,
      );
    }
    return {
      ...entry,
      route,
      detail_file: relative(detailFile),
      has_classroom_fit: hasClassroomFit,
    };
  });
  return {
    files: [dataFile, indexFile, ...mapped.map(entry => path.join(ROOT, entry.detail_file))],
    entries: mapped,
  };
}

function teacherDescription(entry) {
  const text = String(entry.notes || entry.blurb || '').replace(/\s+/g, ' ').trim();
  return {
    route: entry.route,
    file: entry.detail_file,
    collection: `${entry.group_id}/${entry.collection_id}`,
    title: entry.title,
    words: words(text).length,
    characters: text.length,
    sentences: sentenceCount(text),
    preview: text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text,
  };
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] + ((sorted[upper] - sorted[lower]) * weight);
}

function sourceFingerprint(files, release) {
  const hash = crypto.createHash('sha256');
  hash.update(`release_id\0${release.release_id}\0`);
  hash.update(`release_generated_at\0${release.generated_at}\0`);
  for (const file of files) {
    hash.update(`${relative(file)}\0`);
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function build() {
  const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'));
  const teacherCatalog = canonicalTeacherEntries();
  const teacherEntries = teacherCatalog.entries.map(teacherDescription);
  const descriptions = teacherEntries.filter(row => row.words > 0);
  if (!descriptions.length) throw new Error('No Teacher Resources authored descriptions found');

  const counts = descriptions.map(row => row.words).sort((a, b) => a - b);
  const q1 = percentile(counts, 0.25);
  const median = percentile(counts, 0.5);
  const q3 = percentile(counts, 0.75);
  const tukeyFence = q3 + (1.5 * (q3 - q1));
  // A review flag requires both statistical separation and a genuinely long
  // single description. This avoids labelling ordinary catalog specificity as
  // "yap" merely because most descriptions are short.
  const reviewThreshold = Math.ceil(Math.max(MINIMUM_REVIEW_OUTLIER_WORDS, tukeyFence));
  const longDescriptions = descriptions
    .filter(row => row.words >= LONG_TEACHER_DESCRIPTION_WORDS)
    .map(row => ({
      ...row,
      disposition: row.words > reviewThreshold
        ? 'editorial_review_outlier'
        : 'intentional_catalog_detail_preserved',
      review_flag: row.words > reviewThreshold,
      disposition_note: row.words > reviewThreshold
        ? `The Classroom fit description exceeds the conservative ${reviewThreshold}-word review fence; review for possible sentence-level tightening without deleting source or classroom-fit detail.`
        : 'Longer than the catalog norm, but within the conservative outlier fence; source and classroom-fit specificity are preserved.',
    }))
    .sort((a, b) => (b.words - a.words) || a.route.localeCompare(b.route));

  const projectFiles = PROJECT_ROUTES.map(row => path.join(ROOT, row.file));
  const fingerprintFiles = [...new Set([...projectFiles, ...teacherCatalog.files])].sort();
  const projectRoutes = PROJECT_ROUTES.map(routeMetrics);
  const flaggedTeacherDescriptions = longDescriptions.filter(row => row.review_flag);

  return {
    schema: 'seminar-schools-audit42-editorial-density-inventory-v1',
    release_id: release.release_id,
    release_generated_at: release.generated_at,
    source_fingerprint_sha256: sourceFingerprint(fingerprintFiles, release),
    scope: {
      audit_queue_source: 'Website Audit 34 Tier 2 route-by-route editorial density follow-up',
      project_entry_routes: PROJECT_ROUTES.map(row => row.route),
      teacher_resource_rule: `All 644 canonical Teacher Resources records and rendered routes are scanned; authored notes/blurbs with at least ${LONG_TEACHER_DESCRIPTION_WORDS} words are listed route by route.`,
      source_files_fingerprinted: fingerprintFiles.length,
      excluded: [
        'Linked research, rule-library, policy, and archive routes are not silently folded into the three named project-entry-route measurements.',
        'Navigation, footer, script, style, template, noscript, and SVG text are excluded from prose counts.',
        'This is an inventory and review queue, not authorization for automatic copy rewriting.',
      ],
    },
    thresholds: {
      long_teacher_description_words: LONG_TEACHER_DESCRIPTION_WORDS,
      long_project_paragraph_words: LONG_PARAGRAPH_WORDS,
      teacher_review_method: 'greater than both the Tukey upper fence and a 120-word absolute floor',
      teacher_tukey_upper_fence_words: Number(tukeyFence.toFixed(2)),
      teacher_effective_review_threshold_words: reviewThreshold,
    },
    summary: {
      project_routes: projectRoutes.length,
      teacher_detail_routes_scanned: teacherEntries.length,
      teacher_descriptions_measured: descriptions.length,
      teacher_long_descriptions_listed: longDescriptions.length,
      teacher_review_outliers: flaggedTeacherDescriptions.length,
      unexplained_project_outliers: projectRoutes.filter(row => row.review_flag).length,
      disposition: flaggedTeacherDescriptions.length
        ? 'review_only_statistical_outliers; preserve intentional project and catalog density'
        : 'no unexplained outliers; preserve intentional project and catalog density',
    },
    teacher_description_distribution: {
      minimum_words: counts[0],
      first_quartile_words: Number(q1.toFixed(2)),
      median_words: Number(median.toFixed(2)),
      third_quartile_words: Number(q3.toFixed(2)),
      maximum_words: counts[counts.length - 1],
    },
    project_routes: projectRoutes,
    long_teacher_resource_descriptions: longDescriptions,
    editorial_policy: [
      'Concise task UI remains concise.',
      'Authored longform, reference, programme, and catalog detail is not treated as verbosity solely because it is dense.',
      'Only conservative statistical outliers receive review flags.',
      'No copy was removed, flattened, or automatically rewritten by this audit.',
    ],
  };
}

const document = build();
const serialized = `${JSON.stringify(document, null, 2)}\n`;

if (CHECK) {
  let current = '';
  try {
    current = fs.readFileSync(OUTPUT, 'utf8');
  } catch (_) {
    // The mismatch message below covers a missing artifact.
  }
  if (current !== serialized) {
    console.error(
      'AUDIT 42 EDITORIAL DENSITY INVENTORY FAILED — run '
        + 'node scripts/build-audit42-editorial-density-inventory.js.',
    );
    process.exit(1);
  }
  console.log(
    `AUDIT 42 EDITORIAL DENSITY INVENTORY PASSED — ${document.summary.project_routes} `
      + `project routes, ${document.summary.teacher_detail_routes_scanned} Teacher Resources `
      + `routes, ${document.summary.teacher_descriptions_measured} authored descriptions, `
      + `${document.summary.teacher_long_descriptions_listed} long descriptions, `
      + `${document.summary.teacher_review_outliers} review outliers.`,
  );
} else {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, serialized);
  console.log(
    `AUDIT 42 EDITORIAL DENSITY INVENTORY WRITTEN — ${document.summary.project_routes} `
      + `project routes and ${document.summary.teacher_long_descriptions_listed} long Teacher `
      + `Resources descriptions.`,
  );
}
