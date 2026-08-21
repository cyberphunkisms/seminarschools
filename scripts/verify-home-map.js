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
check(home.includes("button.setAttribute('aria-pressed','false')"), 'text controls expose selection state without expansion');
check(home.includes("button.setAttribute('aria-controls',panel.id)"), 'every text control identifies the one shared preview region');
check(home.includes('data-preview-layout="stacked-max-content"'), 'the shared preview declares its stable stacked layout');
const previewRule = (home.match(/\.project-preview-card\{([^}]*)\}/) || [])[1] || '';
check(previewRule.includes('grid-area:1/1'), 'all preview states occupy one grid cell');
check(previewRule.includes('visibility:hidden') && !previewRule.includes('position:absolute'), 'inactive previews stay in layout to reserve the maximum wrapped height');
check(home.includes('.project-preview-card.is-current{visibility:visible;pointer-events:auto}'), 'exactly the current preview becomes visible and interactive');
check(home.includes("previews.set('none',panel.querySelector('[data-preview-id=\"none\"]'))"), 'the stable preview stack includes the neutral no-selection state');
check(home.includes("preview.className='project-preview-card'"), 'every project receives one state in the shared preview stack');
check(
  home.includes("bb:['bookworm','burrows']")
    && home.includes("polymyth:['polymorphous','mythology']")
    && home.includes("heading.append(parts[0],document.createElement('wbr'),parts[1])"),
  'long compound project names receive semantic mobile wrap opportunities',
);
check(home.includes("preview.toggleAttribute('inert',!active)"), 'inactive preview links are removed from interaction');
check(!home.includes('mobile-project-detail') && !home.includes('detail.hidden') && !home.includes('aria-expanded'), 'no project description expands inside a list item');
check(home.includes('.project-map{pointer-events:none}'), 'unlabelled compact map nodes are not interactive');
check(home.includes("group.addEventListener('click',()=>setSelectedProject(state.selectedId===project.id?null:project.id))"), 'map click previews and toggles a project');
check(home.includes("button.addEventListener('click',()=>setSelectedProject(state.selectedId===project.id?null:project.id))"), 'native list buttons preserve click, keyboard, and touch activation');
check(home.includes("open.textContent='Open '+project.label+' ↗'"), 'an explicit open action follows every preview');
check(home.includes('const state={selectedId:null}'), 'the whole network opens without a default project');
const renderBlock = (home.match(/function renderSelection\(\)\{([\s\S]*?)\n  \}\n  function setSelectedProject/) || [])[1] || '';
for (const token of [
  "document.querySelectorAll('.project-node')",
  "document.querySelectorAll('.threads line')",
  "document.querySelectorAll('.project-list-item')",
  'previews.forEach',
  'panel.dataset.selectedId=activePreviewId',
]) check(renderBlock.includes(token), 'one render state synchronizes ' + token);
check(!/addEventListener\(['"](?:mouseenter|mouseover|pointerenter|mousemove|pointermove)/.test(home), 'hover never activates or changes project state');
check(home.includes('.project-list button:hover{') && home.includes('.project-list button.active{'), 'list hover and active states have distinct rules');
check(home.includes('.project-node:hover .node-halo{opacity:.45}') && home.includes('.project-node.active .node-halo{opacity:1}'), 'map hover and active states are visually distinct');
check(/@media\(max-width:760px\)\{[\s\S]*?\.project-panel\{display:grid;/.test(home), 'the same stable preview remains present on mobile and narrow zoom layouts');
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
