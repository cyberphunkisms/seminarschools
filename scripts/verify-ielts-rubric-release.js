#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROUTE = 'teacherresources/ieltsrubric/index.html';
const PDF = 'teacherresources/ieltsrubric/ielts-band-guide-and-assessment-rubric.pdf';
const PAGE_URL = 'https://seminarschools.com/teacherresources/ieltsrubric/';
const EXPECTED_PDF_SHA256 = 'fdc89250261d011cfb9eed74f0ff3f24c52a23e8f7adc7c6d5efeb6002a35f04';
const failures = [];

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function bytes(relative) {
  return fs.readFileSync(path.join(ROOT, relative));
}

function sha256(relative) {
  return crypto.createHash('sha256').update(bytes(relative)).digest('hex');
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

for (const relative of [ROUTE, PDF, `public/${ROUTE}`, `public/${PDF}`]) {
  expect(fs.existsSync(path.join(ROOT, relative)), `${relative} is missing`);
}

if (!failures.length) {
  const sourceHtml = read(ROUTE);
  const publicHtml = read(`public/${ROUTE}`);
  const requiredHtml = [
    `<link rel="canonical" href="${PAGE_URL}">`,
    'data-route-type="teacher-manual"',
    'data-front-facing="general-audience"',
    'data-geometry="indra-web"',
    '/css/alive.css',
    '/js/mandala.js',
    '/js/indra.js',
    '/js/footer.js',
    '/teacherresources/ieltsrubric/ielts-band-guide-and-assessment-rubric.pdf',
    '64</strong><span>Pages',
    '45</strong><span>Named sources',
    'seminarschools.com/teacherresources/ieltsrubric',
  ];
  for (const token of requiredHtml) {
    expect(sourceHtml.includes(token), `${ROUTE} lacks ${token}`);
    expect(publicHtml.includes(token), `public/${ROUTE} lacks ${token}`);
  }

  const sourcePdfHash = sha256(PDF);
  const publicPdfHash = sha256(`public/${PDF}`);
  expect(sourcePdfHash === EXPECTED_PDF_SHA256, `${PDF} hash changed to ${sourcePdfHash}`);
  expect(publicPdfHash === EXPECTED_PDF_SHA256, `public/${PDF} hash changed to ${publicPdfHash}`);
  expect(bytes(PDF).length > 1_000_000, `${PDF} is unexpectedly small`);

  for (const relative of ['teacherresources/index.html', 'public/teacherresources/index.html']) {
    expect(read(relative).includes('/teacherresources/ieltsrubric/'), `${relative} lacks the IELTS guide route`);
  }
  for (const relative of ['sitemap.xml', 'public/sitemap.xml']) {
    const xml = read(relative);
    const occurrences = xml.split(`<loc>${PAGE_URL}</loc>`).length - 1;
    expect(occurrences === 1, `${relative} contains ${occurrences} IELTS route entries`);
  }
  for (const relative of ['polymyth/sitemap/index.html', 'public/polymyth/sitemap/index.html']) {
    expect(read(relative).includes('/teacherresources/ieltsrubric/'), `${relative} lacks the IELTS guide route`);
  }
  for (const relative of ['llms.txt', 'public/llms.txt']) {
    expect(read(relative).includes(PAGE_URL), `${relative} lacks ${PAGE_URL}`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log(`IELTS RUBRIC RELEASE CHECK PASSED — ${ROUTE}, 64-page PDF, source/public parity, discovery links, and SHA-256 verified.`);
