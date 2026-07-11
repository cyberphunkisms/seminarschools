#!/usr/bin/env node
'use strict';
/* One-page modular CV builder.
   CV_WHITESPACE_FILL_2026_07_09: all modular outputs use the page deliberately, avoid stranded bottom whitespace, and remain one page.
   Reads live data from saul/index.html and writes a print HTML file.
   Render with: weasyprint /tmp/cv-print.html saul/cv.pdf
   Optional: --cats=teaching,education --out=/tmp/cv-teaching.html --lang=en
*/
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const SRC = path.join(__dirname, '..', 'saul', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
function arg(name, def='') { const p='--'+name+'='; const x=process.argv.find(a=>a.startsWith(p)); return x?x.slice(p.length):def; }
const OUT = arg('out', '/tmp/cv-print.html');
const lang = arg('lang', 'en');
const active = new Set(arg('cats','').split(',').map(s=>s.trim()).filter(Boolean));
function slice(re, label) { const m = src.match(re); if (!m) throw new Error('could not slice '+label); return vm.runInNewContext('('+m[1]+')'); }
const D = slice(/const D = (\[[\s\S]*?\n\]);/, 'D');
const UI = slice(/const UI = (\{[\s\S]*?\n\});/, 'UI');
const CREDS_OVERRIDE = slice(/const CREDS_OVERRIDE = (\{[\s\S]*?\n\});/, 'CREDS_OVERRIDE');
const t = UI[lang] || UI.en;
const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const pick = o => (o && typeof o === 'object') ? (o[lang] || o.en || '') : (o || '');
const firstSentence = txt => { const m=String(txt||'').trim().match(/^[\s\S]*?(?:[.!?](?=\s|$)|[。！？؟])/); return m?m[0].trim():String(txt||'').trim(); };
const tags = item => Array.isArray(item[2]) ? item[2] : [item[2]];
const hasTag = (item, cat) => tags(item).includes(cat);
const isCert = item => tags(item).includes('education') && /Certif|Certificate|Certification|Training|Professional Development|Theory of Knowledge|Social Impact|Community Building|Nonviolent Communication|AODA|Bootcamp|Machine Learning A-Z|Practitioner|TESOL|Food Handlers|Bronze Cross/i.test(pick(item[3]));
const CAT_ORDER = ['kitchen','teaching','community','education','volunteer','performance','seminarschools'];
const activeCats = CAT_ORDER.filter(c => active.has(c));
const isFiltered = activeCats.length > 0;
const catLabels = (t && t.cats) || UI.en.cats;
const labelFor = cat => catLabels[cat] || cat;
const activeEquals = arr => activeCats.length === arr.length && arr.every(c => active.has(c));
const QUICK_VIEW_SETS = {
  all: [], evaluation: ['teaching','education','community'], teaching: ['teaching','education'],
  programs: ['community','education'], customer: ['teaching','community','seminarschools'],
  arts: ['performance','seminarschools'], service: ['kitchen','community'], portfolio: ['seminarschools']
};
const activeQuickView = () => {
  for (const [key,set] of Object.entries(QUICK_VIEW_SETS)) if (activeCats.length===set.length && set.every(c=>active.has(c))) return key;
  return 'custom';
};
const view = activeQuickView();
const focusTitles = {
  all:'Education, Research and Community Professional', evaluation:'Research and Evaluation CV',
  teaching:'Teaching and Education CV', programs:'Program Coordination CV', customer:'Customer Education CV',
  arts:'Arts and Culture CV', service:'Hospitality and Service CV', portfolio:'Portfolio CV'
};
const focusTitle = focusTitles[view] || activeCats.map(labelFor).join(' + ') + ' CV';
const PRINT_FOCUS = {
  all:'Education, research and community development professional with experience teaching and supporting thousands of learners, coordinating programs and events, managing budgets, producing public information, and working across arts, hospitality and international settings.',
  evaluation:'Research and program-assessment professional with experience designing questionnaires and feedback tools, interpreting qualitative and quantitative evidence, preparing reports and presentations, reviewing data quality, and revising programs from recurring evidence.',
  teaching:'Teacher and education professional who has taught and supported thousands of learners across OSSD, IB, AP, A-Level, ESL, adult education, online instruction, international programs and elementary STEM. Uses formative assessment, adaptive scaffolding, curriculum review and teacher development.',
  programs:'Program and community coordinator with experience managing budgets, volunteers, partnerships, fundraising, conferences, public programs, international logistics and stakeholder communication.',
  customer:'Training and customer-education candidate with extensive experience explaining complex material, guiding learners, delivering workshops, adapting support, organizing public information and communicating across cultures and audiences.',
  arts:'Arts and culture professional with training in Screen Arts and philosophy, art and critical thought, alongside conceptual art, cultural criticism, performance, Toronto event research and festival volunteering.',
  service:'Hospitality and service professional with kitchen, front-of-house, private estate, event, security and shift-management experience. Brings calm coordination, resource planning and direct communication.',
  portfolio:'Independent project work across published teaching resources, essays, research archives, public-information tools and clearly labelled conceptual projects in development.',
  education:'Education professional working across pedagogy, curriculum, academic development, educational technology, writing instruction, university preparation and program assessment.',
  community:'Community development and coordination professional with experience in budgets, volunteer systems, partner networks, conferences, refugee support, community programs and multicultural communication.',
  kitchen:'Hospitality and culinary professional with kitchen, front-of-house, private estate, event, farm and shift-management experience.',
  volunteer:'Volunteer and service record across accessibility, festivals, farms, long-term care, refugee support, education, community markets and public events.',
  performance:'Performance and public-facing work across Screen Arts, theatre, events, teaching, presentation and audience support.',
  seminarschools:'Independent website and project archive with published resources, public information, teaching tools and clearly labelled work in development.'
};
const focusSummary = PRINT_FOCUS[view] || (activeCats.length===1 ? PRINT_FOCUS[activeCats[0]] : activeCats.map(c=>firstSentence(PRINT_FOCUS[c])).filter(Boolean).join(' '));
const COMPETENCIES = ['Google Forms, surveys and questionnaires','Qualitative interpretation and thematic review','Excel budgeting, formulas, tables and charts','Reports, workshops and presentations','Program and event coordination','Stakeholder communication','Source verification and data-quality review','Basic French, Farsi and Mandarin'];
const COMP_BY_CAT = {
  teaching:['Google Forms, surveys and questionnaires','Qualitative interpretation and thematic review','Reports, workshops and presentations','Stakeholder communication'],
  education:['Google Forms, surveys and questionnaires','Excel budgeting, formulas, tables and charts','Source verification and data-quality review','Reports, workshops and presentations'],
  community:['Program and event coordination','Stakeholder communication','Qualitative interpretation and thematic review','Reports, workshops and presentations'],
  kitchen:['Program and event coordination','Stakeholder communication'],
  volunteer:['Stakeholder communication','Source verification and data-quality review'],
  performance:['Reports, workshops and presentations','Stakeholder communication'],
  seminarschools:['Source verification and data-quality review','Reports, workshops and presentations','Google Forms, surveys and questionnaires']
};
let compList;
if (!isFiltered) compList = COMPETENCIES;
else { const seen={}; activeCats.forEach(c => (COMP_BY_CAT[c]||[]).forEach(v => seen[v]=1)); compList = COMPETENCIES.filter(v => seen[v]); }
const GENERAL_KEEP = new Set([
  'Teacher, Intelligent International','Instructor, Tamwood Education Camps','Teacher, NOIC Academy','Teacher, Willowdale High School','Teacher, Toronto Central Academy','Online Educator, Smart Native, Hong Kong','ESL Instructor, Access Education','Teacher, Chongqing No.1 International Studies School, China','ESL Teacher (Volunteer), Sanxin Schools, Zhongshan','Instructor, East Van Education Center, Vancouver','Teacher, Pattison High School, Vancouver','Founder, Project Manager and Translator, Independent Refugee Support Initiative','Community Development Manager, Campus Crops Farmers Market','Assistant Manager, Pizza Pizza; Event Security; Various Contracts','Chef, Private Winery Estate, Florence, Italy','Chef, Private Events and Festival Catering','Teaching Assistant, European Graduate School','Conference Organizer, McMUN and SSUNS at IRSAM, McGill','Research Assistant, McGill University','WWOOF (World Wide Opportunities on Organic Farms)','Sears Ontario Drama Festival'
]);
const ROW_LIMIT = { all:25, kitchen:14, teaching:25, education:26, community:18, volunteer:14, performance:12, seminarschools:14, combo:20, service:22, teachingedu:26 };
let rowLimit = ROW_LIMIT.all;
if (activeEquals(['kitchen','community'])) rowLimit = ROW_LIMIT.service;
else if (activeEquals(['teaching','education'])) rowLimit = ROW_LIMIT.teachingedu;
else if (activeCats.length === 1) rowLimit = ROW_LIMIT[activeCats[0]] || ROW_LIMIT.combo;
else if (activeCats.length > 1) rowLimit = ROW_LIMIT.combo;
const scoreRow = item => {
  const title = pick(item[3]); const note = pick(item[4]); let s = item[0] * 20;
  if (/Present|Current|2025|2026/i.test(item[1])) s += 16;
  if (/Teacher|Instructor|Project Manager|Community Development|Founder|Editor|Chef|Assistant Manager|Teaching Assistant|Conference Organizer|Research Assistant/i.test(title)) s += 10;
  if (/thousands|six countries|\$8,000|IB|OSSD|A-Level|AP|ESL|Adult|Google Forms|questionnaire|budgeting|partner/i.test(note)) s += 6;
  if (GENERAL_KEEP.has(title)) s += 25;
  if (isCert(item)) s -= 100;
  if (item[0] === 0) s -= 80;
  return s;
};
const itemMatches = item => {
  if (!isFiltered) return !hasTag(item,'seminarschools') && !isCert(item) && item[0] >= 1;
  const minWeight = activeCats.includes('performance') ? 0 : 1;
  return activeCats.some(c => hasTag(item,c)) && !isCert(item) && item[0] >= minWeight;
};
let rows = D.filter(itemMatches).sort((a,b) => scoreRow(b)-scoreRow(a) || D.indexOf(a)-D.indexOf(b)).slice(0,rowLimit);
rows.sort((a,b) => b[0]-a[0] || D.indexOf(a)-D.indexOf(b));
const densityProbeRows = rows.length;
const cvDensity = densityProbeRows <= 8 ? 'cv-ultra' : (densityProbeRows <= 10 ? 'cv-sparse' : (densityProbeRows <= 16 ? 'cv-airy' : 'cv-dense'));
const usesExpandedRows = cvDensity === 'cv-ultra' || cvDensity === 'cv-sparse';
const trimText = (txt, max) => { txt = String(txt || '').replace(/\s+/g, ' ').trim(); if (!txt || txt.length <= max) return txt; return txt.slice(0, max - 3).replace(/\s+\S*$/, '') + '...'; };
function rowHtml(item) {
  const titleRaw = pick(item[3]);
  let noteRaw = pick(item[4]);
  const fullRaw = pick(item[6]);
  if (!noteRaw && fullRaw) noteRaw = firstSentence(fullRaw);
  noteRaw = trimText(noteRaw, usesExpandedRows ? 92 : 72);
  let descRaw = '';
  if (usesExpandedRows && fullRaw && fullRaw !== noteRaw) descRaw = trimText(fullRaw, cvDensity === 'cv-ultra' ? 430 : (cvDensity === 'cv-sparse' ? 220 : 120));
  const tagText = tags(item).filter(c => c !== 'seminarschools' || active.has('seminarschools')).slice(0,2).map(labelFor).join(' / ');
  return '<tr><td class="d">'+esc(item[1])+'</td><td class="r"><span class="t">'+esc(titleRaw)+'</span>'+(noteRaw?' <span class="n">'+esc(noteRaw)+'</span>':'')+(tagText?' <span class="tag">'+esc(tagText)+'</span>':'')+(descRaw?' <span class="desc">'+esc(descRaw)+'</span>':'')+'</td></tr>';
}
const splitCreds = s => String(s||'').split(/\s*[\u00b7\u3001]\s*/).filter(Boolean);
const ovr = CREDS_OVERRIDE[lang] || CREDS_OVERRIDE.en || {};
const fullCerts = splitCreds((t && t.certL) || UI.en.certL);
let certItems = fullCerts;
let showEdu = true;
if (isFiltered) {
  const allowed = {}; let anyFull=false, anyEdu=false;
  activeCats.forEach(cat => { const rule=ovr[cat]; if(!rule){anyFull=true; anyEdu=true; return;} if(rule.certs===null){} else if(rule.certs===undefined) anyFull=true; else splitCreds(rule.certs).forEach(c=>allowed[c]=1); if(rule.edu!==null) anyEdu=true; });
  certItems = anyFull ? fullCerts : fullCerts.filter(c => allowed[c]); Object.keys(allowed).forEach(c => { if(!certItems.includes(c)) certItems.push(c); }); showEdu = anyEdu;
}
if (!isFiltered && certItems.length > 9) certItems = certItems.slice(0,9);
if (isFiltered && certItems.length > 8) certItems = certItems.slice(0,8);
let eduItems = String((t && t.eduL) || UI.en.eduL).split(/\s*\u00b7\s*/).filter(Boolean);
if (!isFiltered) eduItems = eduItems.slice(0,3);
else if (active.size === 1 && (active.has('kitchen') || active.has('volunteer') || active.has('performance') || active.has('seminarschools'))) showEdu = false;
else eduItems = eduItems.slice(0,3);
const sideSection = (head, arr, cls='') => (!arr || !arr.length) ? '' : '<div class="sideSec '+cls+'"><div class="sideHead">'+esc(head)+'</div>'+arr.map(v => '<div class="sideItem">'+esc(v)+'</div>').join('')+'</div>';
const compHtml = compList.map(c => '<span>'+esc(c)+'</span>').join('');
const FIT_BY_CAT = {
  teaching:['Formative assessment','Adaptive scaffolding','Curriculum revision','Teacher development','Google Forms and feedback'],
  education:['Research synthesis','Questionnaire design','Mixed-method interpretation','Program assessment','Academic development'],
  community:['Excel budgeting','Volunteer and partner coordination','Fundraising','Public programs','International logistics'],
  kitchen:['Kitchen operations','Front-of-house service','Shift coordination','Event hospitality'],
  volunteer:['Accessibility support','Festival volunteering','Refugee support','Farm and care work'],
  performance:['Screen Arts','Conceptual art and criticism','Public presentation','Audience awareness'],
  seminarschools:['Public-information research','Source verification','Website quality assurance','Teaching resources','Projects in development']
};
let fitItems = [];
if (isFiltered && cvDensity !== 'cv-dense') {
  const seenFit = {};
  activeCats.forEach(c => (FIT_BY_CAT[c] || []).forEach(v => { if (!seenFit[v]) { seenFit[v]=1; fitItems.push(v); } }));
  fitItems = fitItems.slice(0,6);
}
const fitHtml = fitItems.length ? sideSection('Selected Strengths', fitItems, 'fit') : '';
const css = `@page{size:Letter;margin:10mm 10mm 10mm 10mm;}html,body{margin:0;padding:0;background:#fff;}body{font-family:Arial,Helvetica,sans-serif;color:#171717;background:#fff;font-size:8.65pt;line-height:1.23;}*{box-sizing:border-box;}a{color:inherit;text-decoration:none;}.folio{border-top:4pt solid #111;padding-top:8pt;}.cv-ultra,.cv-sparse,.cv-airy{height:252mm;position:relative;}.head{width:100%;border-collapse:collapse;border-bottom:1.5pt solid #111;padding-bottom:5pt;}.head td{vertical-align:bottom;padding:0 0 5pt 0;}.name{font-size:23pt;line-height:.9;font-weight:700;letter-spacing:1.9pt;text-transform:uppercase;color:#111;}.role{margin-top:4pt;font-size:8.5pt;text-transform:uppercase;letter-spacing:2.2pt;color:#7A2632;font-weight:700;}.contact{text-align:right;font-size:7.6pt;line-height:1.45;letter-spacing:.35pt;color:#333;white-space:nowrap;}.profile{display:table;width:100%;border-bottom:1pt solid #b7a2a5;margin:6pt 0 6pt 0;padding-bottom:5pt;}.profile .pkey{display:table-cell;width:78pt;font-size:7.2pt;letter-spacing:2pt;text-transform:uppercase;color:#7A2632;font-weight:700;vertical-align:top;padding-top:1pt;}.profile .ptext{display:table-cell;font-family:Georgia,'Times New Roman',serif;font-size:8.35pt;line-height:1.31;color:#202020;}.main{display:table;width:100%;table-layout:fixed;}.left{display:table-cell;width:68%;vertical-align:top;padding-right:12pt;border-right:1pt solid #d7c7ca;}.right{display:table-cell;width:32%;vertical-align:top;padding-left:12pt;}.sectionHead{font-size:8.2pt;letter-spacing:2pt;text-transform:uppercase;color:#7A2632;border-bottom:1pt solid #7A2632;font-weight:700;padding-bottom:2pt;margin:0 0 4pt;}table.rows{width:100%;border-collapse:collapse;}.rows td{vertical-align:top;padding:1.65pt 0;}.cv-airy .rows td{padding:2.5pt 0;}.cv-sparse .rows td{padding:3.5pt 0;}.cv-ultra .rows td{padding:5.8pt 0;}.rows .d{width:92pt;text-align:right;white-space:nowrap;color:#555;font-size:7.35pt;padding-right:12pt;font-variant-numeric:tabular-nums;}.rows .r{border-left:2pt solid #111;padding-left:8pt;font-family:Georgia,'Times New Roman',serif;font-size:8.3pt;line-height:1.22;}.cv-airy .rows .r{font-size:8.55pt;line-height:1.25;}.cv-sparse .rows .r{font-size:8.9pt;line-height:1.28;}.cv-ultra .rows .r{font-size:9.25pt;line-height:1.33;}.t{font-weight:700;color:#111;}.n{font-style:italic;color:#555;}.tag{font-family:Arial,Helvetica,sans-serif;font-size:6.65pt;letter-spacing:.9pt;text-transform:uppercase;color:#7A2632;white-space:nowrap;}.desc{display:block;margin-top:1.5pt;color:#3f3f3f;font-size:7.75pt;line-height:1.25;}.cv-sparse .desc{font-size:8.05pt;line-height:1.28;margin-top:1.8pt;}.cv-ultra .desc{font-size:8.45pt;line-height:1.32;margin-top:2.2pt;}.chips{margin:0 0 6pt 0;}.chips span{display:inline-block;border:1pt solid #d7c7ca;border-left:3pt solid #7A2632;padding:2pt 3pt;margin:0 2pt 3pt 0;font-size:6.9pt;line-height:1.05;background:#fbf9f9;}.cv-airy .chips span,.cv-sparse .chips span,.cv-ultra .chips span{padding:2.4pt 3.2pt;margin-bottom:3.5pt;}.sideSec{margin:0 0 7pt 0;}.sideHead{font-size:7.8pt;letter-spacing:1.7pt;text-transform:uppercase;color:#7A2632;font-weight:700;border-bottom:1pt solid #d7c7ca;padding-bottom:2pt;margin-bottom:3pt;}.sideItem{font-family:Georgia,'Times New Roman',serif;font-size:7.75pt;line-height:1.24;padding:1.2pt 0;border-bottom:.35pt solid #eee;}.cv-airy .sideItem,.cv-sparse .sideItem,.cv-ultra .sideItem{font-size:8pt;line-height:1.3;padding:1.8pt 0;}.links .sideItem{font-family:Arial,Helvetica,sans-serif;font-size:7.2pt;letter-spacing:.3pt;}.foot{margin-top:5pt;border-top:1pt solid #111;padding-top:3pt;text-align:center;font-size:7pt;letter-spacing:1.2pt;text-transform:uppercase;color:#333;}.cv-ultra .foot,.cv-sparse .foot,.cv-airy .foot{position:absolute;left:0;right:0;bottom:0;margin-top:0;}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Saul Karim Nassau CV</title><style>${css}</style></head><body><div class="folio ${cvDensity}" data-cv-output-revamp="2026-07-11" data-cv-whitespace-fill="2026-07-09" data-cv-610-synthesis="true"><table class="head"><tr><td><div class="name">Saul Karim Nassau <span style="font-size:10pt;letter-spacing:1pt;color:#7A2632">MA</span></div><div class="role">${esc(focusTitle)}</div></td><td class="contact">Toronto, Ontario<br>416&middot;771&middot;0382<br>saulnassau@protonmail.com<br>seminarschools.com/saul/</td></tr></table><div class="profile"><div class="pkey">Profile</div><div class="ptext">${esc(focusSummary)}</div></div><div class="main"><div class="left"><div class="sectionHead">${isFiltered ? 'Selected Experience' : 'Professional Experience'}</div><table class="rows">${rows.map(rowHtml).join('')}</table></div><div class="right"><div class="sectionHead">Key Skills</div><div class="chips">${compHtml}</div>${fitHtml}${showEdu ? sideSection((t&&t.edu)||'Education', eduItems, 'edu') : ''}${sideSection((t&&t.certs)||'Selected Professional Development', certItems, 'certs')}${sideSection('Links', ['seminarschools.com/saul/', 'saulnassau@protonmail.com'], 'links')}</div></div><div class="foot">Reviews and references: seminarschools.com/reviews</div></div></body></html>`;
fs.writeFileSync(OUT, html, 'utf8');
console.log(`wrote ${OUT}: ${rows.length} rows, focus=${focusTitle}, cats=${activeCats.join(',') || 'all'}`);
