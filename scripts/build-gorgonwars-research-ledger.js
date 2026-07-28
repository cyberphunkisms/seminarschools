#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const sourcePath = path.join(ROOT, 'polymyth', 'devilsdiary', '9', 'index.html');
const outputPath = path.join(
  ROOT,
  'polymyth',
  'research',
  'gorgonwars-conversation-source-ledger-2026-07-27.txt',
);

function decode(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2018;|&#8216;/g, '‘')
    .replace(/&#x2019;|&#8217;/g, '’')
    .replace(/&#x201C;|&#8220;/g, '“')
    .replace(/&#x201D;|&#8221;/g, '”')
    .replace(/&#x2013;|&#8211;/g, '–')
    .replace(/&#x2014;|&#8212;/g, '—');
}

function plain(fragment) {
  return decode(
    fragment
      .replace(/<a\b[^>]*class="back"[^>]*>[\s\S]*?<\/a>/gi, '')
      .replace(
        /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
        (_match, href, label) => {
          const text = label.replace(/<[^>]+>/g, '').trim();
          return text === href ? href : `${text} (${href})`;
        },
      )
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

const html = fs.readFileSync(sourcePath, 'utf8');
const pressureBlock = html.match(
  /<ol class="pressure-ledger">([\s\S]*?)<\/ol>/i,
)?.[1];
if (!pressureBlock) throw new Error('Devil’s Diary 9 pressure ledger not found');
const pressures = [...pressureBlock.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map(
  (match) => plain(match[1]),
);
const notesBlock = html.match(
  /<section[^>]*aria-label="Notes"[\s\S]*?<ol>([\s\S]*?)<\/ol>/i,
)?.[1];
if (!notesBlock) throw new Error('Devil’s Diary 9 note ledger not found');
const notes = [...notesBlock.matchAll(/<li id="note-(\d+)">([\s\S]*?)<\/li>/gi)]
  .map((match) => ({
    number: Number(match[1]),
    text: plain(match[2]),
  }))
  .sort((left, right) => left.number - right.number);

if (pressures.length !== 42) {
  throw new Error(`Expected 42 pressure rows, found ${pressures.length}`);
}
if (notes.length !== 27) {
  throw new Error(`Expected 27 source notes, found ${notes.length}`);
}

const lines = [
  'DEVIL’S DIARY ENTRY 9, SOURCE AND STATUS LEDGER',
  'Scoped to Devil’s Diary Entry 9: its 42-pressure matrix and 27 notes. This is not a complete ledger of the entire conversation or the separate MeToo corpus.',
  'Canonical essay: https://seminarschools.com/polymyth/devilsdiary/9/',
  'Status date: 2026-07-27',
  '',
  'FORTY-TWO-PRESSURE SOURCE/SYSTEM MATRIX',
  ...pressures.map((pressure, index) => `${index + 1}. ${pressure}`),
  '',
  'COMPLETE TWENTY-SEVEN-NOTE SOURCE-STATUS LEDGER',
  ...notes.map((note) => `${note.number}. ${note.text}`),
  '',
];
fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
const digest = crypto
  .createHash('sha256')
  .update(fs.readFileSync(outputPath))
  .digest('hex');
fs.writeFileSync(
  `${outputPath}.sha256`,
  `${digest}  ${path.basename(outputPath)}\n`,
  'utf8',
);
console.log(
  `Gorgonwars research ledger built: ${pressures.length} pressures, ${notes.length} notes, SHA-256 ${digest}`,
);
