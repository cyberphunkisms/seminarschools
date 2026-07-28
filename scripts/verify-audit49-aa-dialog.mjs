#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aa = fs.readFileSync(path.join(root, 'aa', 'index.html'), 'utf8');
const failures = [];

function requireToken(token, message) {
  if (!aa.includes(token)) failures.push(message);
}

requireToken('id="detail-overlay" aria-hidden="true"', 'AA detail overlay must start hidden from assistive technology');
requireToken('id="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title" tabindex="-1"', 'AA detail panel needs modal-dialog semantics and a programmatic focus target');
requireToken('function activateDetailOverlay()', 'AA needs one shared dialog activation path');
requireToken('detailReturnFocus = document.activeElement', 'AA dialog must remember the invoking control');
requireToken('element.inert = true', 'AA dialog must make background controls inert');
requireToken('element.inert = false', 'AA dialog must restore background controls');
requireToken("if (e.key === 'Tab')", 'AA dialog must trap forward and reverse tab navigation');
requireToken("if (e.key === 'Escape')", 'AA dialog must close from Escape');
requireToken("savedScrollY = window.scrollY || document.documentElement.scrollTop || 0", 'AA dialog must capture the page scroll position before opening');
requireToken("window.scrollTo({top:returnScrollY, left:window.scrollX, behavior:'auto'})", 'AA dialog must restore the page scroll position before returning focus');
requireToken('returnTarget.focus({preventScroll:true})', 'AA dialog must return focus without jumping the page');
requireToken("panel.querySelector('.detail-close').addEventListener('click', closeDetail)", 'both AA detail renderers need the shared close path');
requireToken('function closeUntranslatableDetail() {\n  closeDetail();', 'untranslatable detail must use the shared modal cleanup');
requireToken('id="results-meta" role="status" aria-live="polite" aria-atomic="true"', 'AA result changes need one concise atomic polite status');
requireToken("document.getElementById('results').addEventListener('click', event => {", 'AA result actions must use one stable delegated handler');
requireToken("event.target.closest('button[data-open-taxonomy], button[data-open-untranslatable], button[data-open-tag]')", 'AA result delegation must be limited to native action buttons');
requireToken('data-open-taxonomy="${escapeHtml(t.id)}"', 'taxonomy cards need native Open details controls');
requireToken('data-open-untranslatable="${escapeHtml(u.id)}"', 'untranslatable cards need native Open details controls');
requireToken('data-open-tag="${escapeHtml(t.id)}"', 'category cards need native Open details controls');
requireToken('data-open-taxonomy="${escapeHtml(tax.id)}"', 'occurrence cards need native Open details controls');
requireToken('class="tp-mass-member" data-open-tag=', 'mass members need native convergence controls');
requireToken("b.setAttribute('aria-pressed', String(active))", 'AA mode controls must synchronize aria-pressed');
requireToken("c.setAttribute('aria-pressed', String(active))", 'AA sort and convergence controls must synchronize aria-pressed');

if ((aa.match(/id="detail-panel"/g) || []).length !== 1) failures.push('AA must retain exactly one persistent detail panel');
if ((aa.match(/id="detail-title"/g) || []).length < 2) failures.push('both AA detail renderers must label the dialog');
if (/overlay\.innerHTML\s*=/.test(aa)) failures.push('AA untranslatable renderer still destroys the persistent detail panel');
if (/overlay\.style\.cssText\s*=/.test(aa)) failures.push('AA detail renderer still overrides the shared overlay lifecycle with inline display CSS');
for (const selector of ['tax-card', 'untrans-card', 'cat-group', 'tp-occ', 'tp-mass-member']) {
  const mouseOnly = new RegExp(`querySelectorAll\\(['"]\\.${selector}(?:[^'"]*)?['"]\\)[\\s\\S]{0,120}addEventListener\\(['"]click['"]`);
  if (mouseOnly.test(aa)) failures.push(`AA ${selector} activation still relies on per-card click wiring`);
}

function executableJavaScript(attributes) {
  const type = attributes.match(/\btype\s*=\s*(["'])(.*?)\1/i)?.[2].trim().toLowerCase() || '';
  return !type || /^(?:module|text\/(?:java|ecma)script|application\/(?:java|ecma)script)(?:\s*;|$)/.test(type);
}
const inlineScripts = [...aa.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(match => !/\bsrc\s*=/i.test(match[1]) && executableJavaScript(match[1]))
  .map(match => match[2])
  .filter(source => source.trim());
for (const [index, source] of inlineScripts.entries()) {
  try {
    new Function(source);
  } catch (error) {
    failures.push(`AA executable inline script ${index + 1} does not compile: ${error.message}`);
  }
}

if (failures.length) {
  console.error('AUDIT49 AA DIALOG FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('AUDIT49 AA DIALOG PASSED — Audit 36 assertions preserved, JSON-LD excluded from JavaScript compilation, and executable inline scripts verified.');
