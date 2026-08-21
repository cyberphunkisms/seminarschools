#!/usr/bin/env node
/*
 * Current Leizu experience guard.
 *
 * The historical verifier is an approved preservation surface, so this
 * successor runs it first and then checks the current Mulberry Fund entry
 * point without rewriting the protected contract.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const legacy = path.join(ROOT, 'scripts', 'verify-leizu-experience.js');
const legacyRun = spawnSync(process.execPath, [legacy], {
  cwd: ROOT,
  stdio: 'inherit',
});
if(legacyRun.error){
  console.error('Could not run the protected Leizu experience verifier:', legacyRun.error.message);
  process.exit(1);
}
if(legacyRun.status !== 0) process.exit(legacyRun.status || 1);

const home = fs.readFileSync(path.join(ROOT, 'leizu', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'leizu', 'revamp.css'), 'utf8');
const errors = [];
const assert = (condition, message) => { if(!condition) errors.push(message); };
const occursBefore = (first, second) => home.includes(first) && home.includes(second) && home.indexOf(first) < home.indexOf(second);

assert(home.includes('<section class="leizu-free-classes"'), 'Mulberry free-classes banner is missing.');
assert(occursBefore('class="chrome-bar"', 'class="leizu-free-classes"'), 'Mulberry banner must follow the global controls.');
assert(occursBefore('class="leizu-free-classes"', 'class="leizu-site-nav"'), 'Mulberry banner must appear before Leizu navigation.');
assert(home.includes('id="mulberry-free-title"'), 'Mulberry banner lacks its labelled heading.');
assert(home.includes('>Apply for free classes</h2>'), 'Mulberry banner heading changed from the approved English label.');
assert(home.includes('href="/leizu/intake/?source=mulberry"'), 'Mulberry CTA does not use the approved intake route.');
assert(home.includes('data-intake-source="mulberry"'), 'Mulberry CTA lacks its analytics/intake source marker.');
for(const key of ['mulberry.eyebrow', 'mulberry.title', 'mulberry.copy', 'mulberry.cta']){
  assert(home.includes(`data-i18n="${key}"`), `Mulberry banner is missing the ${key} translation hook.`);
}

assert(css.includes('.leizu-free-classes {'), 'Mulberry banner styles are missing.');
assert(css.includes('.leizu-free-classes h2 {'), 'Mulberry heading styles are missing.');
assert(css.includes('scroll-margin-block-start:9rem'), 'Mulberry heading can be obscured by the fixed controls.');
const narrowCss = css.slice(css.indexOf('@media (max-width:900px)'));
assert(narrowCss.includes('.leizu-free-classes {'), 'Mulberry banner has no narrow-layout rule.');
assert(narrowCss.includes('grid-template-columns:1fr'), 'Mulberry banner does not become one column at 900px.');
assert(narrowCss.includes('.leizu-free-classes-cta { justify-self:start; }'), 'Mulberry CTA cannot wrap naturally in the narrow layout.');
assert(css.includes('@media (max-width:1100px)'), 'Mulberry banner does not stack before the 1024px enlarged-text scenario.');
assert(css.includes('body.leizu-revamp:not(.leizu-home) > .leizu-site-nav'), 'Auxiliary Leizu navigation does not reserve the fixed reading-control lane.');
assert(css.includes('@media (max-width:820px)'), 'Auxiliary Leizu navigation does not release its top control lane when controls move below.');

function readObject(name){
  const marker = `const ${name} = `;
  const start = home.indexOf(marker);
  assert(start >= 0, `${name} dictionary source is missing.`);
  if(start < 0) return {};
  const valueStart = start + marker.length;
  const valueEnd = home.indexOf('\n};', valueStart);
  assert(valueEnd >= 0, `${name} dictionary source is not closed.`);
  if(valueEnd < 0) return {};
  try{
    return vm.runInNewContext(`(${home.slice(valueStart, valueEnd + 2)})`, Object.create(null));
  }catch(error){
    errors.push(`${name} dictionary could not be parsed: ${error.message}`);
    return {};
  }
}

const dictionaries = readObject('I18N');
const overrides = {
  en: readObject('LEIZU_EN_REVAMP_COPY'),
  fr: readObject('LEIZU_FR_REVAMP_COPY'),
  zh: readObject('LEIZU_TRADITIONAL_CHINESE_REVAMP_COPY'),
  zhs: readObject('LEIZU_SIMPLIFIED_CHINESE_REVAMP_COPY'),
  fa: readObject('LEIZU_PERSIAN_REVAMP_COPY'),
};
const requiredLanguages = ['en', 'fr', 'zh', 'zhs', 'fa'];
const finalDictionaries = {};
for(const lang of requiredLanguages){
  assert(dictionaries[lang] && typeof dictionaries[lang] === 'object', `Base ${lang} dictionary is missing.`);
  finalDictionaries[lang] = Object.assign({}, dictionaries[lang] || {}, overrides[lang] || {});
}
const referenceKeys = Object.keys(finalDictionaries.en).sort();
assert(referenceKeys.length === 262, `Expected 262 current Leizu keys; found ${referenceKeys.length}.`);
for(const lang of requiredLanguages){
  const keys = Object.keys(finalDictionaries[lang]).sort();
  assert(keys.length === referenceKeys.length, `${lang} dictionary has ${keys.length} keys; English has ${referenceKeys.length}.`);
  assert(keys.join('\n') === referenceKeys.join('\n'), `${lang} dictionary keys do not match English.`);
  for(const key of ['mulberry.eyebrow', 'mulberry.title', 'mulberry.copy', 'mulberry.cta']){
    assert(typeof finalDictionaries[lang][key] === 'string' && finalDictionaries[lang][key].trim(), `${lang} is missing ${key}.`);
  }
}

console.log('=== current/verify-leizu-experience ===');
if(errors.length){
  console.log(`ERRORS (${errors.length}):`);
  errors.forEach(error => console.log('  X ' + error));
  process.exit(1);
}
console.log('PASS — protected Leizu checks plus the first-screen Mulberry application path and 5-language parity are intact.');
