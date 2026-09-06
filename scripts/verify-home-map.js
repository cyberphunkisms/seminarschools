#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');
const {
  assertGeometryVersionScheme,
  geometryExemptionForRelativeHtmlPath,
} = require('./lib/geometry-asset-version');
const root = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const footer = fs.readFileSync(path.join(root, 'js', 'footer.js'), 'utf8');
const indra = fs.readFileSync(path.join(root, 'js', 'indra.js'), 'utf8');
const geometryContracts = JSON.parse(fs.readFileSync(path.join(root, 'data', 'geometry-route-contracts.json'), 'utf8'));
assertGeometryVersionScheme(geometryContracts);
const failures = [];

function check(ok, label) {
  process.stdout.write((ok ? 'PASS  ' : 'FAIL  ') + label + '\n');
  if (!ok) failures.push(label);
}

function walkHtml(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'public' || entry.name === 'fixtures' || entry.name.startsWith('.')
        || isGeneratedDependencyDirectory(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const escapeAsset = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasAssetTag = (html, asset) => new RegExp(`<[^>]+${escapeAsset(asset)}(?:\\?[^"']*)?["'][^>]*>`, 'i').test(html);
const geometryScopeDefects = [];
const geometryScopeStats = { included: 0, star: 0, control: 0 };
for (const file of walkHtml(root)) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  if (relative === geometryContracts.coverage.non_page_exception) continue;
  const html = fs.readFileSync(file, 'utf8');
  const body = (html.match(/<body\b[^>]*>/i) || [''])[0];
  const exemption = geometryExemptionForRelativeHtmlPath(geometryContracts, relative);
  if (exemption) {
    const expectedMarker = `${geometryContracts.coverage.exemption_attribute}="${exemption}"`;
    if (!body.includes(expectedMarker)) geometryScopeDefects.push(`${relative}: missing ${expectedMarker}`);
    if (/\bdata-(?:geometry(?:-[\w-]+)?|indra-(?:intensity|fade-source))\s*=/i.test(body)) geometryScopeDefects.push(`${relative}: exempt body retains shared geometry`);
    for (const asset of ['/js/mandala.js', '/js/indra.js']) {
      if (hasAssetTag(html, asset)) geometryScopeDefects.push(`${relative}: exempt page loads ${asset}`);
    }
    if (exemption === geometryContracts.coverage.star_page_exemption_value) geometryScopeStats.star += 1;
    else if (exemption === geometryContracts.coverage.control_page_exemption_value) geometryScopeStats.control += 1;
  } else {
    geometryScopeStats.included += 1;
    if (body.includes(geometryContracts.coverage.exemption_attribute)) geometryScopeDefects.push(`${relative}: included page is marked exempt`);
    if (!/\bdata-geometry=["']indra-web["']/.test(body)) geometryScopeDefects.push(`${relative}: included page lacks data-geometry`);
    for (const asset of ['/css/alive.css', '/js/mandala.js', '/js/indra.js']) {
      if (!hasAssetTag(html, asset)) geometryScopeDefects.push(`${relative}: included page lacks ${asset}`);
    }
  }
}
if (geometryScopeStats.star !== Number(geometryContracts.coverage.expected_current_star_pages)) geometryScopeDefects.push(`expected ${geometryContracts.coverage.expected_current_star_pages} star pages, found ${geometryScopeStats.star}`);
if (geometryScopeStats.control !== Number(geometryContracts.coverage.expected_current_control_pages_source)) geometryScopeDefects.push(`expected ${geometryContracts.coverage.expected_current_control_pages_source} source controls, found ${geometryScopeStats.control}`);
check(geometryScopeDefects.length === 0, `central geometry scope covers ${geometryScopeStats.included} included pages and exempts exactly ${geometryScopeStats.star} star pages plus ${geometryScopeStats.control} source control`);
if (geometryScopeDefects.length) geometryScopeDefects.slice(0, 20).forEach(defect => console.error('      ' + defect));

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

check(
  indra.includes('data-indra-intensity')
    && indra.includes("getPropertyValue('--indra-opacity')")
    && indra.includes("layer.style.setProperty('--indra-opacity-resolved'"),
  'Indra accepts bounded page-specific intensity',
);
check(!/setInterval\s*\(/.test(indra) && /panPointerId === null/.test(indra) && /panSurface\(event\.target\)/.test(indra), 'Indra has no idle or ambient pointer animation loop; pressed pan surfaces remain responsive');

const publicHome = path.join(root, 'public', 'index.html');
if (fs.existsSync(publicHome)) {
  check(fs.readFileSync(publicHome).equals(fs.readFileSync(path.join(root, 'index.html'))), 'source and deployable homepage are byte-identical');
}

if (failures.length) {
  console.error('\n' + failures.length + ' homepage redesign check(s) failed.');
  process.exit(1);
}
console.log('\nHomepage business-card and complete-project-web guard passed.');
