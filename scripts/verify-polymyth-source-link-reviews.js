#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { polymythCommonsDestination } = require('./lib/external-destination-contracts');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const json = name => JSON.parse(read(name));
const data = json('polymythlib/data/polymyth-data.json');
const directory = json('polymythlib/data/directory-index.json');
const backbone = json('polymythlib/data/backbone-index.json');
const reviews = json('data/polymyth-commons-source-link-reviews.json').links;
const oldUrls = [
  'http://www.arl.org/create/resources/CreateChange2003.pdf',
  'http://www.earthforce.org/resources.cfm',
  'http://www.earlham.edu/~peters/fos/',
  'http://www.library.yale.edu/~llicense/',
];
assert.deepEqual(Object.keys(reviews).sort(), oldUrls.toSorted(), 'review scope must remain the four evidenced URLs');
assert.equal(Object.values(reviews).filter(review => review.successor).length, 2, 'only two verified successor links');
for (const review of Object.values(reviews)) {
  assert.equal(review.status, 'unavailable');
  assert.match(review.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(review.note);
  if (review.successor) {
    assert.ok(review.successor.label && review.successor.note && review.successor.scope);
    assert.ok(review.successor.evidenceUrls.includes(review.successor.url), 'successor must retain its inspected official evidence URL');
  }
}
assert.equal(reviews[oldUrls[1]].successor.url, 'https://www.earthforce.org/cop');
assert.equal(reviews[oldUrls[3]].successor.url, 'https://www.charleston-hub.com/liblicense/');
assert.equal(reviews[oldUrls[0]].successor, undefined, 'no invented exact ARL replacement');
assert.equal(reviews[oldUrls[2]].successor, undefined, 'no invented exact Suber replacement');

// Compare preserved record fields with the source workbook inspection, not
// another generated JSON file that could repeat the same accidental mutation.
const tables = new Map(read('data/polymyth-commons-book-backbone.xlsx.inspect.ndjson').trim().split(/\r?\n/)
  .map(line => JSON.parse(line)).filter(row => row.kind === 'table').map(row => [row.sheet, row.values]));
function rowsFor(sheet) {
  const values = tables.get(sheet);
  const headers = values[4].map(value => String(value ?? '').trim());
  return values.slice(5).map(row => Object.fromEntries(headers.map((header, i) => [header, String(row[i] ?? '').trim()])));
}
const split = value => value ? value.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
const fields = {
  id: 'Project ID', canonicalName: 'Canonical Name', bookPortrayal: 'Book Portrayal',
  printedPageReferences: 'Printed Page References', currentStatusGroup: 'Current Status Group',
  detailedStatus: 'Detailed 2026 Status', currentCanonicalUrl: 'Current Canonical URL',
  currentOperator: 'Current Operator / Parent', currentStatusEvidence: 'Current Status Evidence',
  verified: 'Verified', confidence: 'Confidence', editorialNotes: 'Editorial Notes',
};
const projectRows = rowsFor('Project Index');
assert.equal(data.projects.length, 346);
assert.deepEqual(data.projects.map(p => p.id), projectRows.map(row => row['Project ID']));
for (let i = 0; i < data.projects.length; i += 1) {
  const project = data.projects[i], row = projectRows[i];
  for (const [field, column] of Object.entries(fields)) assert.equal(project[field], row[column], `${project.id}: preserved ${field}`);
  assert.deepEqual(project.bookPrintedUrls, split(row['Book-Printed URL(s)']), `${project.id}: original URLs`);
  const expected = Object.fromEntries(project.bookPrintedUrls.filter(url => reviews[url]).map(url => [url, reviews[url]]));
  assert.deepEqual(project.sourceLinkReviews, expected, `${project.id}: separate review overlay`);
  for (const projection of [directory, backbone]) {
    const record = projection.projects.find(p => p.id === project.id);
    assert.deepEqual(record.sourceLinkReviews, expected, `${project.id}: runtime review projection`);
    for (const field of ['verified', 'currentStatusGroup', 'currentCanonicalUrl', 'bookPrintedUrls']) {
      assert.deepEqual(record[field], project[field], `${project.id}: runtime preserved ${field}`);
    }
  }
}
assert.equal(data.currentStatuses.length, 20, 'current-status seed count remains unchanged');
const mentionRows = rowsFor('Book Mentions');
assert.equal(data.mentions.length, mentionRows.length);
for (let i = 0; i < mentionRows.length; i += 1) {
  const mention = data.mentions[i], row = mentionRows[i];
  for (const [field, column] of Object.entries({id:'Record ID',canonicalName:'Canonical Name',bookPrintedUrl:'Book-Printed URL',sourceGroundedRole:'Source-Grounded Role',printedPages:'Printed Pages',chapterTitle:'Chapter Title'})) {
    assert.equal(mention[field], row[column], `${mention.id}: book wording ${field}`);
  }
}

function extractFunction(source, name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = source.indexOf('\n  function ', start + 1);
  assert.ok(end > start, `missing boundary after ${name}`);
  return source.slice(start, end).trim();
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const runtimeEndpoint = vm.runInNewContext(`(${extractFunction(read('js/polymythlib.js'), 'endpointPresentation')})`);
const affected = data.projects.filter(project => Object.keys(project.sourceLinkReviews).length);
assert.deepEqual(affected.map(p => p.id), ['PC-0068','PC-0092','PC-0122','PC-0170','PC-0299']);
for (const project of data.projects) {
  const destination = polymythCommonsDestination(project);
  const client = runtimeEndpoint(project);
  assert.equal(client ? new URL(client.href).href : '', destination.href, `${project.id}: runtime/build destination agreement`);
}
for (const project of affected) {
  const html = read(`polymythlib/projects/${project.id}/index.html`);
  for (const [url, review] of Object.entries(project.sourceLinkReviews)) {
    assert.ok(html.includes(`<code>${esc(url)}</code>`), `${project.id}: exact historical URL retained as text`);
    assert.ok(html.includes(esc(review.note)), `${project.id}: unavailable-source evidence note`);
    assert.ok(!html.includes(`href="${esc(url)}"`), `${project.id}: no dead original href`);
    if (review.successor) {
      assert.ok(html.includes(`href="${esc(review.successor.url)}"`), `${project.id}: successor action`);
      assert.ok(html.includes(esc(review.successor.label)), `${project.id}: truthful successor label`);
      assert.ok(html.includes(esc(review.successor.note)), `${project.id}: successor scope note`);
      for (const evidence of review.successor.evidenceUrls) assert.ok(html.includes(`href="${esc(evidence)}"`), `${project.id}: official evidence locator`);
    }
  }
  assert.ok(html.includes('Current status has not yet been reviewed.'), `${project.id}: link review must not promote full-record verification`);
}
for (const id of ['PC-0068','PC-0122']) assert.equal(polymythCommonsDestination(data.projects.find(p => p.id === id)).href, '');
assert.equal(polymythCommonsDestination(data.projects.find(p => p.id === 'PC-0299')).href,
  'http://www.earlham.edu/~peters/fos/newsletter/archive.htm', 'retain the other already printed, unreviewed historical source');

// Exercise the actual book-backbone row renderer, including a bare printed URL.
const linkRows = vm.runInNewContext(`(${extractFunction(read('js/polymyth-backbone.js'), 'linkRows')})`, {
  esc, externalHref: value => /^https?:\/\//i.test(value) ? value : `https://${value}`, displayUrl: value => value,
});
const affectedBookLinks = backbone.bookLinks.filter(link => link.sourceLinkReview);
assert.deepEqual(affectedBookLinks.map(link => link.id), ['URL-0121','URL-0162','URL-0351']);
for (const link of affectedBookLinks) {
  const html = linkRows([link]);
  assert.ok(html.includes(`<code>${esc(link.printed)}</code>`), `${link.id}: printed wording preserved`);
  assert.ok(html.includes('Original source unavailable'), `${link.id}: unavailable label`);
  assert.ok(!/<a\b/.test(html), `${link.id}: historical URL is not presented as a working action`);
}
// Nearby, unaudited source URLs must not be disabled by host-wide matching.
const nearby = backbone.bookLinks.find(link => link.id === 'URL-0125');
assert.equal(nearby.sourceLinkReview, undefined);
assert.ok(/<a\b/.test(linkRows([nearby])), 'unreviewed neighboring Yale path is unchanged');

const token = value => `sha256-${crypto.createHash('sha256').update(value).digest('hex').slice(0,12)}`;
for (const [script, index, owner] of [
  ['js/polymythlib.js','directory-index.json','polymythlib/index.html'],
  ['js/polymyth-backbone.js','backbone-index.json','polymythlib/book-backbone/index.html'],
]) {
  assert.ok(read(script).includes(`${index}?v=${token(read(`polymythlib/data/${index}`))}`), `${script}: current index content token`);
  assert.ok(read(owner).includes(`/${script}?v=${token(read(script))}`), `${owner}: current script content token`);
}
console.log('POLYMYTH SOURCE LINK REVIEWS PASS — four failed URLs, five unchanged project identities, two labeled successors; workbook wording, statuses, runtime actions, provenance, and cache tokens verified.');
