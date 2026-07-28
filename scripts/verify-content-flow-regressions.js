#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function requireText(rel, text, label = text) {
  if (!read(rel).includes(text)) failures.push(`${rel} missing ${label}`);
}
function forbidText(rel, text, label = text) {
  if (read(rel).includes(text)) failures.push(`${rel} still contains ${label}`);
}

const about = read('about/index.html');
for (const token of [
  'data-name="Upcoming Polymythcal Listings"',
  'Upcoming <em>Polymythcal listings.</em>',
  'the next six Polymythcal listings in chronological order within the coming 90 days',
  'Open each source to confirm details before going.',
  'Next six within 90 days.'
]) {
  if (!about.includes(token)) failures.push(`about/index.html missing truthful compact-feed copy: ${token}`);
}
for (const stale of ['Upcoming GTA Lectures', 'strongest upcoming events', 'Toronto has more free public lectures', 'Loading lectures']) {
  if (about.includes(stale)) failures.push(`about/index.html retains misleading teaser copy: ${stale}`);
}
if (!about.includes('.sort(function(a, b)') || !about.includes('.slice(0, 6)')) {
  failures.push('about/index.html compact teaser no longer sorts chronologically and limits output to six');
}
const feedBuilder = read('scripts/build-polymythcal-feeds.py');
for (const token of ["events = sorted(", "upcoming.append({", "if len(upcoming) >= 64:"]) {
  if (!feedBuilder.includes(token)) failures.push(`scripts/build-polymythcal-feeds.py compact chronological feed contract drifted: ${token}`);
}

const polymyth = read('polymyth/index.html');
if (!/<footer class="main-site-exit"[^>]*aria-label="Main site">[\s\S]*href="\/"[\s\S]*href="\/about\/"/.test(polymyth)) {
  failures.push('polymyth/index.html lacks the canonical main-site exit footer');
}

const agora = read('agora/index.html');
if (!/<a href="\/about\/"[^>]*>About Seminar Schools &rarr;<\/a>/.test(agora)) {
  failures.push('agora/index.html About Seminar Schools link does not target /about/');
}

const canonicalNameFiles = [
  'index.html',
  'about/index.html',
  'teacherresources/index.html',
  'agora/index.html',
  'js/footer.js',
  'scripts/build-search-pages.js',
  'scripts/regen-polymythseminars-feed.js'
];
for (const rel of canonicalNameFiles) {
  if (/\bpolymythcalendar\b/i.test(read(rel))) failures.push(`${rel} retains visible legacy Polymythcalendar wording`);
}
for (const rel of ['index.html', 'about/index.html', 'teacherresources/index.html', 'agora/index.html', 'js/footer.js', 'scripts/build-search-pages.js']) {
  if (!read(rel).includes('Polymythcal')) failures.push(`${rel} lacks canonical Polymythcal wording`);
}

requireText('scripts/build-search-pages.js', "'pending-user-authorship':'Pending User Authorship'", 'pending-user-authorship human label');
forbidText('scripts/build-search-pages.js', '>polymythcalendar<', 'legacy generated navigation wording');

if (failures.length) {
  console.error('CONTENT/FLOW REGRESSION CHECK FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('CONTENT/FLOW REGRESSION CHECK PASSED — truthful About teaser, complete exits, canonical Polymythcal naming, and generated human labels verified.');
