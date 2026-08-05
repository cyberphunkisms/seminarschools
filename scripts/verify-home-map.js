#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const footer = fs.readFileSync(path.join(root, 'js', 'footer.js'), 'utf8');
const indra = fs.readFileSync(path.join(root, 'js', 'indra.js'), 'utf8');
const failures = [];

function check(ok, label) {
  process.stdout.write((ok ? 'PASS  ' : 'FAIL  ') + label + '\n');
  if (!ok) failures.push(label);
}

const cardStart = home.indexOf('<header class="business-card"');
const cardEnd = home.indexOf('</header>', cardStart);
const card = cardStart >= 0 && cardEnd > cardStart ? home.slice(cardStart, cardEnd) : '';

check(home.includes('data-homepage-contract="business-card-project-web-v1"'), 'current homepage contract is explicit');
for (const token of [
  'Saul Karim Nassau',
  'Educator &amp; Director',
  'Education · Research · Public Programs',
  'MA Philosophy · Toronto + Online',
  '416-771-0382',
  'saulnassau@protonmail.com',
  'href="/saul/"',
  'Select a project to preview it. Open it from the description.',
]) check(card.includes(token), 'business card includes ' + token);
check(!card.includes('Reviews'), 'business card excludes Reviews');

const projectBlock = home.match(/const PROJECTS=\[([\s\S]*?)\];\n  const RELATIONSHIPS=/);
const projectSource = projectBlock ? projectBlock[1] : '';
const ids = [...projectSource.matchAll(/\{id:'([^']+)'/g)].map(match => match[1]);
check(ids.length === 15, 'project web contains exactly fifteen project records');
check(new Set(ids).size === 15, 'project identifiers are unique');

const expected = new Map([
  ['aa', '/aa/'],
  ['aitr', '/aitr/'],
  ['agora', '/agora/'],
  ['bb', '/bb/'],
  ['florilegium', '/florilegium/'],
  ['leizu', '/leizu/'],
  ['marginalia', '/marginalia/'],
  ['nutrition', '/nutrition/'],
  ['ohm', '/ohm-dome/'],
  ['polymyth', '/polymyth/'],
  ['commons', '/polymythcommons/'],
  ['calendar', '/polymythseminars/'],
  ['polymythlib', '/polymythlib/'],
  ['sabachtan', '/agora/#sabachtan'],
  ['teacher', '/teacherresources/'],
]);
const escapeRegex = value => value.replace(/[.*+?^{}$()|[\]\\]/g, '\\$&');
for (const [id, href] of expected) {
  const row = new RegExp("\\{id:'" + escapeRegex(id) + "'[\\s\\S]{0,420}?href:'" + escapeRegex(href) + "'");
  check(row.test(projectSource), id + ' keeps its approved route');
}

check(home.includes('aria-hidden="true" focusable="false"'), 'visual map is removed from the duplicate keyboard path');
check(home.includes("button.setAttribute('aria-expanded','false')"), 'text controls expose expansion state');
check(home.includes("button.setAttribute('aria-controls',detail.id)"), 'text controls identify their adjacent project description');
check(home.includes("detail.className='mobile-project-detail'"), 'descriptions expand beside the selected project at every width');
check(home.includes('.project-map{pointer-events:none}'), 'unlabelled compact map nodes are not interactive');
check(home.includes("group.addEventListener('click',()=>selectProject(selectedId===project.id?null:project.id))"), 'map selection previews and toggles a project');
check(home.includes("open.textContent='Open '+project.label+' ↗'"), 'an explicit open action follows every preview');
check(home.includes('let selectedId=null'), 'the whole network opens without a default project');
check(home.includes("sort((a,b)=>a.label.localeCompare"), 'the complete text index is alphabetical');
check(home.includes('min-height:44px'), 'project and contact controls retain practical touch targets');
check(home.includes('@media(forced-colors:active)'), 'forced-colour support remains present');
check(home.includes('@media(prefers-reduced-motion:reduce)'), 'reduced-motion support remains present');
check(home.includes('<ul class="project-list"'), 'the complete project directory uses list semantics');
check(home.includes('aria-live="polite" aria-atomic="true"'), 'the project preview announces one complete update');
check(home.includes('<a class="skip-link" href="#project-web">'), 'the skip link bypasses the business card');

for (const forbidden of [
  'Open Polymythcal',
  'priority:true',
  'class="path-card featured"',
  "selectNode(NODES.find(n=>n.id==='calendar')",
  "window.location.assign(n.href)",
  'id="mapRail"',
  'Choose a jewel',
]) check(!home.includes(forbidden), 'homepage does not restore ' + forbidden);

for (const token of ['/polymythcommons/', '/polymythlib/', '/aa/', '/agora/#sabachtan']) {
  check(footer.includes(token), 'shared footer includes ' + token);
}

const inlineScripts = [...home.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter(match => !/application\/ld\+json/i.test(match[1]))
  .map(match => match[2])
  .filter(source => source.trim());
for (let index = 0; index < inlineScripts.length; index += 1) {
  try {
    new vm.Script(inlineScripts[index], { filename: 'index-inline-' + index + '.js' });
  } catch (error) {
    failures.push('inline script ' + index + ' has invalid JavaScript: ' + error.message);
  }
}
check(!failures.some(item => item.startsWith('inline script')), 'homepage inline JavaScript parses');

check(indra.includes('data-indra-intensity') && indra.includes("layer.style.setProperty('--indra-opacity'"), 'Indra accepts page-specific intensity');
check(!/setInterval\s*\(/.test(indra) && !/pointer(move|down|up)/i.test(indra), 'Indra has no idle or pointer animation loop');

const publicHome = path.join(root, 'public', 'index.html');
if (fs.existsSync(publicHome)) {
  check(fs.readFileSync(publicHome).equals(fs.readFileSync(path.join(root, 'index.html'))), 'source and deployable homepage are byte-identical');
}

if (failures.length) {
  console.error('\n' + failures.length + ' homepage redesign check(s) failed.');
  process.exit(1);
}
console.log('\nHomepage business-card and complete-project-web guard passed.');
