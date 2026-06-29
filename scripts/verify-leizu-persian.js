#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'leizu', 'index.html');
const html = fs.readFileSync(file, 'utf8');
let failures = 0;

function requireText(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL  ${message}`);
  } else {
    console.log(`PASS  ${message}`);
  }
}

function extractConst(name, marker) {
  const start = html.indexOf(`const ${name} = `);
  if (start < 0) throw new Error(`Missing ${name}`);
  const end = html.indexOf(marker, start);
  if (end < 0) throw new Error(`Missing end marker for ${name}`);
  const source = html.slice(start, end);
  const context = {};
  vm.runInNewContext(`${source}\nthis.out=${name};`, context);
  return context.out;
}

try {
  requireText(html.includes('data-lang-set="fa"'), 'Persian control remains available');
  requireText(html.includes("lang==='fa'?'fa'"), 'Persian exposes fa to assistive technology');
  requireText(html.includes('[data-lang="fa"]{font-family:var(--farsi);direction:rtl;}'), 'Persian page uses right-to-left layout');

  const english = extractConst(
    'LEIZU_EN_REVAMP_COPY',
    '\nObject.assign(I18N.en, LEIZU_EN_REVAMP_COPY);'
  );
  const persian = extractConst(
    'LEIZU_PERSIAN_REVAMP_COPY',
    '\nObject.assign(I18N.fa, LEIZU_PERSIAN_REVAMP_COPY);'
  );
  requireText(
    JSON.stringify(Object.keys(english).sort()) === JSON.stringify(Object.keys(persian).sort()),
    'Persian covers every current revised page string'
  );
  requireText(persian['ui.esl.banner'] === 'حالت انگلیسی ساده فعال است', 'Simple English banner is translated into Persian');
  requireText(persian['contact.chinese.cta'] === 'رزرو مشاورهٔ چینی', 'Chinese consultation CTA is translated into Persian');
  requireText(persian['catalogue.p1'].includes('فرم آغاز کار'), 'Course selection handoff is translated into Persian');

  const traditionalCourses = extractConst(
    'LEIZU_TRADITIONAL_CHINESE_COURSE_DESCRIPTIONS',
    '\nObject.values(COURSES).forEach'
  );
  const persianCourses = extractConst(
    'LEIZU_PERSIAN_COURSE_DESCRIPTIONS',
    '\nObject.values(COURSES).forEach'
  );
  requireText(Object.keys(persianCourses).length === 24, 'All 24 course descriptions have Persian text');
  requireText(
    JSON.stringify(Object.keys(traditionalCourses).sort()) === JSON.stringify(Object.keys(persianCourses).sort()),
    'Persian course coverage matches the full Traditional Chinese course coverage'
  );
  requireText(persianCourses.h1.includes('تاریخ') && persianCourses.h1.includes('دانش‌آموزان'), 'Persian course descriptions use Persian text');

  const persianElements = extractConst(
    'LEIZU_PERSIAN_ELEMENT_GLOSSES',
    '\nELEMENTS.forEach'
  );
  requireText(Object.keys(persianElements).length === 5, 'All Five Elements glosses have Persian text');
  requireText(html.includes('course.desc.fa=LEIZU_PERSIAN_COURSE_DESCRIPTIONS[course.id]'), 'Course renderer receives Persian descriptions');
  requireText(html.includes('element.gloss.fa=LEIZU_PERSIAN_ELEMENT_GLOSSES[element.glyph]'), 'Five Elements renderer receives Persian glosses');
} catch (error) {
  failures += 1;
  console.error(`FAIL  ${error.message}`);
}

if (failures) process.exit(1);
console.log('Persian localization guard passed.');
