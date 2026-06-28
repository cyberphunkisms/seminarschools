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
  requireText(html.includes('data-lang-set="zhs"'), 'Simplified Chinese control remains available');
  requireText(html.includes("lang==='zhs'?'zh-Hans'"), 'Simplified Chinese exposes zh-Hans to assistive technology');

  const traditional = extractConst(
    'LEIZU_TRADITIONAL_CHINESE_REVAMP_COPY',
    '\nObject.assign(I18N.zh, LEIZU_TRADITIONAL_CHINESE_REVAMP_COPY);'
  );
  const simplified = extractConst(
    'LEIZU_SIMPLIFIED_CHINESE_REVAMP_COPY',
    '\nObject.assign(I18N.zhs, LEIZU_SIMPLIFIED_CHINESE_REVAMP_COPY);'
  );
  const traditionalKeys = Object.keys(traditional).sort();
  const simplifiedKeys = Object.keys(simplified).sort();
  requireText(
    JSON.stringify(traditionalKeys) === JSON.stringify(simplifiedKeys),
    'Simplified Chinese covers every current revised page string that Traditional Chinese covers'
  );
  requireText(simplified['ui.esl.banner'] === '简明英语模式已开启', 'Simple English banner is translated into Simplified Chinese');
  requireText(simplified['contact.chinese.cta'] === '预约中文咨询', 'Chinese consultation CTA is translated into Simplified Chinese');
  requireText(simplified['catalogue.p1'].includes('咨询表格'), 'Course selection handoff is translated into Simplified Chinese');

  const traditionalCourses = extractConst(
    'LEIZU_TRADITIONAL_CHINESE_COURSE_DESCRIPTIONS',
    '\nObject.values(COURSES).forEach'
  );
  const simplifiedCourses = extractConst(
    'LEIZU_SIMPLIFIED_CHINESE_COURSE_DESCRIPTIONS',
    '\nObject.values(COURSES).forEach'
  );
  requireText(Object.keys(simplifiedCourses).length === 24, 'All 24 course descriptions have Simplified Chinese text');
  requireText(
    JSON.stringify(Object.keys(traditionalCourses).sort()) === JSON.stringify(Object.keys(simplifiedCourses).sort()),
    'Simplified Chinese course coverage matches Traditional Chinese course coverage'
  );
  requireText(simplifiedCourses.h1.includes('学生') && simplifiedCourses.h1.includes('历史'), 'Simplified Chinese course descriptions use Simplified Chinese forms');

  const simplifiedElements = extractConst(
    'LEIZU_SIMPLIFIED_CHINESE_ELEMENT_GLOSSES',
    '\nELEMENTS.forEach'
  );
  requireText(Object.keys(simplifiedElements).length === 5, 'All Five Elements glosses have Simplified Chinese text');
  requireText(html.includes('course.desc.zhs=LEIZU_SIMPLIFIED_CHINESE_COURSE_DESCRIPTIONS[course.id]'), 'Course renderer receives Simplified Chinese descriptions');
  requireText(html.includes('element.gloss.zhs=LEIZU_SIMPLIFIED_CHINESE_ELEMENT_GLOSSES[element.glyph]'), 'Five Elements renderer receives Simplified Chinese glosses');
} catch (error) {
  failures += 1;
  console.error(`FAIL  ${error.message}`);
}

if (failures) process.exit(1);
console.log('Simplified Chinese localization guard passed.');
