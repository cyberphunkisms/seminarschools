#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] || process.cwd());
const routes = {
  home: ['index.html', 'audit35-home-ui'],
  about: ['about/index.html', 'audit35-about-ui'],
  bb: ['bb/index.html', 'audit35-bb-ui'],
  bookwormcard: ['bookwormcard/index.html', 'audit35-bookwormcard-ui'],
  aa: ['aa/index.html', 'audit35-aa-ui'],
  leizu: ['leizu/index.html', 'audit35-leizu-ui'],
  cv: ['saul/index.html', 'audit35-cv-ui'],
  agora: ['agora/index.html', 'audit35-agora-ui']
};

const html = {};
for (const [name, [relative, marker]] of Object.entries(routes)) {
  const source = readFileSync(resolve(root, relative), 'utf8');
  html[name] = source;
  assert.equal(source.split(marker).length - 1, 1, `${relative}: expected one ${marker} marker`);
  assert.match(source, /<\/head>/i, `${relative}: missing </head>`);
  assert.match(source, /<\/body>/i, `${relative}: missing </body>`);
}

assert.ok(
  html.bookwormcard.indexOf("classList.add('bookwormcard-js')") <
    html.bookwormcard.indexOf('id="static-bookwormcard-context"'),
  'Bookwormcard pre-paint class must precede its static context'
);
assert.ok(
  html.bookwormcard.lastIndexOf('.keys-hint{position:relative') >
    html.bookwormcard.lastIndexOf('.keys-hint{position:fixed'),
  'Bookwormcard short-screen footer override must win the cascade'
);
assert.match(html.bookwormcard, /body\.game-ready #static-bookwormcard-context\{display:none\}/);
assert.match(html.bookwormcard, /id="student-start-card"/);

assert.match(html.aa, /classList\.add\('aa-js'\)/);
assert.match(html.aa, /\.aa-js:not\(\.aa-ready\) footer\{display:none\}/);
assert.match(html.aa, /@media \(max-width:900px\),\(max-height:650px\)/);
assert.match(
  html.aa,
  /#aa-sibling-nav\{[\s\S]*?position:static!important;inset:auto!important;[\s\S]*?overflow-x:auto;/,
  'AA sibling navigation must remain in flow and horizontally reflow instead of covering content'
);
assert.doesNotMatch(html.aa, /#aa-sibling-nav\{[^}]*position:fixed/);
assert.equal((html.aa.match(/class="mode-btn/g) || []).length, 7, 'AA browse modes changed');

for (const lang of ['en', 'fr', 'zh', 'zhs', 'fa']) {
  assert.match(html.leizu, new RegExp(`<button[^>]+data-lang-set="${lang}"`));
}
for (const [lang, label] of [
  ['en', 'English'],
  ['fr', 'Français'],
  ['zh', '繁體中文'],
  ['zhs', '简体中文'],
  ['fa', 'فارسی']
]) {
  assert.match(
    html.leizu,
    new RegExp(`data-lang-set="${lang}"[^>]+aria-label="${label}"`),
    `Leizu ${lang} language control must retain a direct accessible name`
  );
}
for (const code of ['TC', 'SC', 'FA']) {
  assert.match(html.leizu, new RegExp(`content:"${code}"`));
}
assert.match(html.leizu, /class="esl-btn"/);
assert.match(
  html.leizu,
  /class="pricing-panel" id="pricing-panel" inert aria-hidden="true"/,
  'Leizu hidden pricing panel must be absent from focus and accessibility order'
);
assert.match(html.leizu, /panel\.removeAttribute\('inert'\)/);
assert.match(html.leizu, /panel\.setAttribute\('inert',''\)/);
assert.match(html.leizu, /panel\.setAttribute\('aria-hidden','false'\)/);
assert.match(html.leizu, /panel\.setAttribute\('aria-hidden','true'\)/);

assert.equal((html.cv.match(/<h1(?:\s|>)/gi) || []).length, 1, 'CV must keep exactly one H1');
assert.match(html.cv, /data-saul-ultimate-cv="true"/);
assert.match(html.cv, /data-cv-ultimate/);
assert.match(html.cv, /id="careerArchive"/);
assert.match(html.cv, /class="cv-home-link"/);

assert.match(html.bb, /href="\/bookwormcard\/"/);
assert.match(html.bb, /href="\/polymyth\/bookwormburrows\/"/);
assert.match(html.agora, /class="project-nav"/);

process.stdout.write(`Audit35 route UI verifier passed (${Object.keys(routes).length} routes).\n`);
