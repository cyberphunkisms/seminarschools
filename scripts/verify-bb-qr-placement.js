#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const routes = [
  ['campaigns/thank-you-mam/index.html', 'nav'],
  ['campaigns/thank-you-mam/pregame/index.html', 'nav'],
  ['polymyth/bookwormburrows/index.html', 'header'],
  ['polymyth/campaigncodex/index.html', 'header'],
  ['polymyth/polymythdnd/index.html', 'header'],
];
const failures = [];

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

for (const [relativePath, placement] of routes) {
  const html = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const qrAnchors = html.match(/<a\b[^>]*\bdata-bb-qr(?:=""|)[^>]*>/gi) || [];
  if (qrAnchors.length !== 1) {
    failures.push(`${relativePath}: expected one data-bb-qr link; found ${qrAnchors.length}`);
    continue;
  }

  const anchor = qrAnchors[0];
  if (!/\bclass="[^"]*\bbb-qr-link\b[^"]*"/i.test(anchor)) {
    failures.push(`${relativePath}: QR link is missing the shared bb-qr-link class`);
  }
  if (!/\bhref="\/bookwormcard\/"/i.test(anchor)) {
    failures.push(`${relativePath}: QR destination drifted from /bookwormcard/`);
  }
  if (!/\baria-label="[^"]*bookwormcard[^"]*"/i.test(anchor)) {
    failures.push(`${relativePath}: QR link lacks a BookwormCard accessible name`);
  }
  if (/\bstyle=/i.test(anchor)) {
    failures.push(`${relativePath}: QR positioning returned to an inline style`);
  }
  if (count(html, /qr-ouroboros-indra\.png/gi) !== 1) {
    failures.push(`${relativePath}: expected exactly one QR image reference`);
  }
  if (!/<img\b[^>]*\bsrc="\/bookwormcard\/qr-ouroboros-indra\.png"[^>]*>/i.test(html)) {
    failures.push(`${relativePath}: canonical QR image is missing`);
  }
  if (!/<img\b[^>]*\bwidth="405"[^>]*\bheight="405"[^>]*>/i.test(html)
      && !/<img\b[^>]*\bheight="405"[^>]*\bwidth="405"[^>]*>/i.test(html)) {
    failures.push(`${relativePath}: intrinsic 405x405 QR dimensions are missing`);
  }
  if (!/\.bb-qr-link\s*\{[^}]*position\s*:\s*static\s*;[^}]*display\s*:\s*block\s*;[^}]*width\s*:\s*72px\s*;[^}]*height\s*:\s*72px\s*;/is.test(html)) {
    failures.push(`${relativePath}: shared QR rule is not a static 72px in-flow block`);
  }
  if (new RegExp(
    String.raw`data-bb-qr[^>]*(?:position\s*:\s*fixed|z-index\s*:\s*9999)|`
      + String.raw`position\s*:\s*fixed[^>]*data-bb-qr`,
    'i',
  ).test(anchor)) {
    failures.push(`${relativePath}: fixed/high-stack QR positioning returned`);
  }

  const markerAt = html.indexOf('data-bb-qr');
  if (placement === 'nav') {
    const navStart = html.lastIndexOf('<nav', markerAt);
    const navEnd = html.indexOf('</nav>', markerAt);
    if (navStart < 0 || navEnd < markerAt) {
      failures.push(`${relativePath}: QR link is no longer in the navigation flow`);
    }
  } else {
    const headerStart = html.lastIndexOf('<header class="bb-qr-header">', markerAt);
    const headerEnd = html.indexOf('</header>', markerAt);
    if (headerStart < 0 || headerEnd < markerAt || !html.slice(markerAt, headerEnd).includes('bb-qr-header-copy')) {
      failures.push(`${relativePath}: QR link is no longer in the reserved header grid`);
    }
    if (!/\.bb-qr-header\s*\{[^}]*display\s*:\s*grid\s*;[^}]*grid-template-columns\s*:\s*72px minmax\(0,1fr\)/is.test(html)) {
      failures.push(`${relativePath}: reserved QR header column is missing`);
    }
  }
}

const pngPath = path.join(root, 'bookwormcard', 'qr-ouroboros-indra.png');
if (!fs.existsSync(pngPath)) {
  failures.push('bookwormcard/qr-ouroboros-indra.png: asset is missing');
} else {
  const png = fs.readFileSync(pngPath);
  const signature = png.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a' || png.length < 24) {
    failures.push('bookwormcard/qr-ouroboros-indra.png: asset is not a valid PNG header');
  } else {
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width !== 405 || height !== 405) {
      failures.push(`bookwormcard/qr-ouroboros-indra.png: expected 405x405; found ${width}x${height}`);
    }
  }
}

if (failures.length) {
  console.error('BB QR PLACEMENT CHECK FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  'BB QR PLACEMENT CHECK PASSED - five routes preserve the canonical destination and image in static navigation/header flow.',
);
