#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const file = path.join(ROOT, 'bookwormcard/index.html');
const html = fs.readFileSync(file, 'utf8');
const failures = [];
const must = (label, ok) => { if (!ok) failures.push(label); };

must('Bookwormcard title names the BB character-card purpose', /<title>Bookwormcard · Make a bookwormburrows Character Card<\/title>/.test(html));
must('Static crawler-readable context exists outside noscript', /<section id="static-bookwormcard-context"[\s\S]*Bookwormcard is the character gate for BookwormBurrows/.test(html));
must('Static context links to BB, about, glossary, and blank card', /href="\/bb\/"/.test(html) && /href="\/bookwormcard\/about\/"/.test(html) && /href="\/bookwormcard\/glossary\/"/.test(html) && /href="\/bookwormcard\/print\/\?blank=1"/.test(html));
must('Static context includes privacy/data note', /Privacy\/data note/.test(html) && /AI function/.test(html) && /checkpoints in your browser/.test(html));
must('Runtime hides static context only after game-ready class', /body\.game-ready #static-bookwormcard-context\{display:none\}/.test(html) && /classList\.add\('game-ready'\)/.test(html));
must('ESL button is visible and bound', /id="t-esl"[\s\S]*<span>ESL<\/span>/.test(html) && !/id="t-esl"[^>]*display\s*:\s*none/.test(html) && /addEventListener\('click', toggleEsl\)/.test(html));
must('ESL mode adds plain-language helper copy', /function eslExplanationFor/.test(html) && /Plain English:/.test(html) && /addEslHelperAfter/.test(html));
must('Theme button exists and uses direct Bookwormcard light\/dark toggle', /id="t-theme"/.test(html) && /function toggleTheme/.test(html) && /body\.light-mode/.test(html) && /data-bw-theme/.test(html));
must('High-contrast control remains separate from theme', /id="t-contrast"/.test(html) && /<span>HC<\/span>/.test(html) && /function toggleContrast/.test(html));
must('Text-size buttons are present and bound', /id="t-fontminus"/.test(html) && /id="t-fontplus"/.test(html) && /bumpFontSize\(-1\)/.test(html) && /bumpFontSize\(1\)/.test(html));
must('App shell avoids global 100vh overflow trap', /html,body\{[^}]*min-height:100svh[^}]*overflow-y:auto/.test(html) && !/html,body\{[^}]*height:100vh;overflow:hidden/.test(html));
must('Card preview no longer says only building', /your wormcard preview will build here/.test(html) && !/<span class="empty">building\.\.\.<\/span>/.test(html));
must('Input label is contextual', /aria-label="Bookwormcard response/.test(html) && /setAttribute\('aria-label', 'Bookwormcard response'/.test(html));
must('Structured data marks the page as educational WebApplication and part of BB', /"@type":"WebApplication"/.test(html) && /"isPartOf":\{"@type":"CreativeWork","name":"BookwormBurrows"/.test(html));
must('Optional static command is surfaced before play', /Type <strong>static<\/strong> during play to turn off the optional AI reaction layer/.test(html));

if (failures.length) {
  console.error('Bookwormcard gate verification failed:');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log('Bookwormcard gate verification passed: static BB context, ESL helpers, theme/contrast/text controls, mobile-safe shell, and data notice are present.');
