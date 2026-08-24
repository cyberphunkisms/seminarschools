#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'teacherresources', 'resources-data.json'), 'utf8'));

function xml(value) {
  return String(value || '').replace(/[<>&'"]/g, character => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  })[character]);
}

function slug(value) {
  const core = String(value || 'resource').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 76);
  return core || 'resource';
}

function route(group, category, entry) {
  if (!entry.route_key) throw new Error(`Missing route_key for ${entry.id || entry.title}`);
  return `/teacherresources/${slug(group.id)}/${slug(category.id)}/${slug(entry.title)}-${entry.route_key}/`;
}

const buildDay = process.env.SITE_BUILD_DATE || new Date().toISOString().slice(0, 10);
const buildDate = new Date(`${buildDay}T12:00:00-04:00`);
if (Number.isNaN(buildDate.getTime())) throw new Error(`Invalid SITE_BUILD_DATE ${buildDay}`);

const records = [];
for (const group of data.groups || []) {
  for (const category of group.categories || []) {
    for (const entry of category.entries || []) records.push({ group, category, entry });
  }
}
if (records.length !== 645) throw new Error(`Expected 645 feed records, found ${records.length}`);

const items = records.map(({ group, category, entry }) => {
  const localUrl = SITE + route(group, category, entry);
  const details = [
    category.title,
    entry.author,
    entry.grade && entry.grade !== 'all' ? `Grades ${entry.grade}` : 'Multi-grade',
    entry.host
  ].filter(Boolean).join(' · ');
  return `<item>
<title>${xml(entry.title)}</title>
<link>${xml(localUrl)}</link>
<guid isPermaLink="true">${xml(localUrl)}</guid>
<description>${xml(details)}</description>
<category>${xml(group.title)}</category>
</item>`;
}).join('\n');

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Seminar Schools Teacher Resources</title>
<link>${SITE}/teacherresources/</link>
<description>All 645 catalogued classroom resources across 25 source collections.</description>
<language>en-ca</language>
<lastBuildDate>${buildDate.toUTCString()}</lastBuildDate>
<atom:link href="${SITE}/teacherresources/feed.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;

fs.writeFileSync(path.join(ROOT, 'teacherresources', 'feed.xml'), feed);
console.log(`Teacher Resources feed regenerated: ${records.length} items.`);
