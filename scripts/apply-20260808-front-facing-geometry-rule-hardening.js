#!/usr/bin/env node
'use strict';

/**
 * Persist the 2026-08-08 audience and perceptibility corrections in the
 * canonical methodology source. Generated text mirrors are rebuilt by the
 * normal methodology exporter; this script is idempotent.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const target = path.join(ROOT, 'polymyth', 'methodologylist', 'index.html');
let source = fs.readFileSync(target, 'utf8');

function appendToBody(titleNeedle, headingNeedle, paragraph) {
  const titleAt = source.indexOf(titleNeedle);
  if (titleAt < 0) throw new Error(`Missing canonical entry: ${titleNeedle}`);
  const blockStart = source.lastIndexOf('\n{', titleAt);
  const blockEnd = source.indexOf('\n},', titleAt);
  if (blockStart < 0 || blockEnd < 0) throw new Error(`Cannot bound canonical entry: ${titleNeedle}`);
  const block = source.slice(blockStart, blockEnd);
  if (block.includes(headingNeedle)) return false;
  const bodyEnd = block.lastIndexOf('",\n  "x":');
  if (bodyEnd < 0) throw new Error(`Cannot locate body boundary: ${titleNeedle}`);
  const hardened = block.slice(0, bodyEnd) + `\\n\\n${paragraph}` + block.slice(bodyEnd);
  source = source.slice(0, blockStart) + hardened + source.slice(blockEnd);
  return true;
}

let changed = 0;
changed += appendToBody(
  '"t": "PM12. ARTIFACT-VOCAB',
  'PUBLIC-PAGE HARDENING, 2026-08-08.',
  'PUBLIC-PAGE HARDENING, 2026-08-08. Every public webpage is written for a general reader arriving cold, including a page whose subject is technical, archival, or AI-assisted. The reader must be able to determine what the page is, why it exists, and how to use it without the build conversation. Specialized vocabulary may remain when the page actually teaches or uses that vocabulary, but the page introduces its purpose in ordinary language and does not expose builder notes, audit chatter, data-pipeline labels, internal IDs, or an AI narrating instructions to itself. The rule covers source HTML, generators, templates, browser-injected copy, translations, and deployment mirrors. A marker or passing text search is never proof by itself; the rendered page still receives an audience, overlap, reflow, focus, and anchor check.',
);
changed += appendToBody(
  '"t": "PM12 mirror',
  'PUBLIC-PAGE HARDENING MIRROR, 2026-08-08.',
  'PUBLIC-PAGE HARDENING MIRROR, 2026-08-08. Every public webpage, including technical and AI-assisted material, gives a cold general reader its purpose and way in before specialized content. Builder notes, audit chatter, pipeline labels, internal IDs, and AI self-instruction do not become visible page copy. Source HTML, generators, templates, browser-injected copy, translations, and deployment mirrors are all artifact sources. Static markers and grep remain insufficient without rendered audience, overlap, reflow, focus, and anchor checks.',
);
changed += appendToBody(
  '"t": "CL-49 VISUAL GRAMMAR',
  'PERCEPTIBILITY HARDENING, 2026-08-08.',
  'PERCEPTIBILITY HARDENING, 2026-08-08. Geometry that technically exists but disappears to a human has failed the same rule. DOM presence, a nonzero opacity string, or merely unequal transforms are insufficient. Professional pages use a quiet register that remains plainly perceptible; standard and expressive pages may be stronger. Browser proof compares the composed page with the layer shown and hidden, requires register-specific pixel change and minimum scroll displacement, and checks the historic About dual camera plus the CV camera at the top, middle, and bottom on desktop and phone. Reduced-motion keeps the same visible field still. Legibility and pointer isolation remain controlling.',
);
changed += appendToBody(
  '"t": "CL-63 ALL PAGES ARE BORN CONNECTED AND ALIVE',
  'FRONT-FACING AND PERCEPTIBILITY HARDENING, 2026-08-08.',
  'FRONT-FACING AND PERCEPTIBILITY HARDENING, 2026-08-08. Every public page is for a general reader arriving without the build conversation. Technical and AI-assisted pages may retain subject-specific language, but their public chrome identifies the page, its audience, and its use in ordinary language. Visible copy never becomes builder narration or AI self-instruction. Generators, templates, browser JavaScript, translations, source pages, and public mirrors remain inside the same boundary. The release gate scans all of them and then checks representative rendered families for text reflow, transparent fixed-control collisions, anchor clearance, focus visibility, and general-audience comprehension. The geometry layer must also produce a register-appropriate visible pixel difference and minimum scroll displacement; reduced motion must keep it visible and still. Presence-only checks do not pass.',
);

if (changed) fs.writeFileSync(target, source, 'utf8');
console.log(`2026-08-08 front-facing/geometry rule hardening: ${changed} canonical entries updated.`);
