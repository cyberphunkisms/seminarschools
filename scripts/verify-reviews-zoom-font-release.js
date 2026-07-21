#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const LINKEDIN = 'https://www.linkedin.com/in/seminarschools/overlay/Position/1409449435/treasury/?profileId=ACoAAAoVpaQBwFL59ASEITFxwp8D-hzMxzfApMM';
const CONTRACT = '/css/site-wide-type-zoom.css?v=20260710-reviews-zoom-font-a';
const failures = [];

function read(p) { return fs.readFileSync(p, 'utf8'); }
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.isFile()) out.push(full);
  }
  return out;
}
function rel(p) { return path.relative(ROOT, p).replace(/\\/g, '/'); }
function stripCssComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ''); }
function requireTrue(ok, message) { if (!ok) failures.push(message); }

const sourceHtml = walk(ROOT).filter(p => p.endsWith('.html') && !p.startsWith(PUBLIC + path.sep));
const publicHtml = walk(PUBLIC).filter(p => p.endsWith('.html'));
const auditedSourceHtml = sourceHtml.filter(p => !/^google.*\.html$/i.test(path.basename(p)));
const auditedPublicHtml = publicHtml.filter(p => !/^google.*\.html$/i.test(path.basename(p)));
requireTrue(sourceHtml.length > 1000, `source HTML count unexpectedly low: ${sourceHtml.length}`);
requireTrue(sourceHtml.length === publicHtml.length, `source/public HTML count differs: ${sourceHtml.length}/${publicHtml.length}`);

for (const file of auditedSourceHtml) {
  const text = read(file);
  const where = rel(file);
  const isRedirect = /http-equiv=["']refresh["']/i.test(text) && /location\.replace\(/.test(text);
  if (isRedirect) continue;
  const contractCount = (text.match(/data-site-wide-type-zoom="20260710-reviews-zoom-font-a"/g) || []).length;
  requireTrue(contractCount === 1, `${where}: expected exactly one site-wide type/zoom contract link, found ${contractCount}`);
  const viewportTags = text.match(/<meta\b[^>]*>/gi) || [];
  requireTrue(viewportTags.some(tag => /name=["']viewport["']/i.test(tag) && /content=["'][^"']*width=device-width/i.test(tag)), `${where}: missing responsive viewport`);
  requireTrue(!/user-scalable\s*=\s*no/i.test(text), `${where}: disables user zoom`);
  requireTrue(!/maximum-scale\s*=\s*1(?:\.0+)?(?:[,"'])/i.test(text), `${where}: caps user zoom at 1`);
}

const reviews = read(path.join(ROOT, 'reviews', 'index.html'));
requireTrue(reviews.includes(LINKEDIN), 'reviews page does not contain the exact requested LinkedIn recommendation URL');
const firstReference = reviews.match(/<a\s+class="reference"[\s\S]*?href="([^"]+)"/i);
requireTrue(firstReference && firstReference[1] === LINKEDIN, 'requested LinkedIn recommendation is not the first reference card');
requireTrue(/<link\s+rel="canonical"\s+href="https:\/\/seminarschools\.com\/reviews\/"/i.test(reviews), 'reviews page canonical URL is missing');
requireTrue(fs.existsSync(path.join(PUBLIC, 'reviews', 'index.html')), 'public deploy is missing /reviews/index.html');

const redirects = read(path.join(ROOT, '_redirects'));
const toml = read(path.join(ROOT, 'netlify.toml'));
requireTrue(/^\/reviews\s+\/reviews\/\s+301/m.test(redirects), '_redirects does not canonicalize /reviews to /reviews/');
requireTrue(!/^\/reviews\s+\/marginalia/m.test(redirects), '/reviews still redirects to Marginalia');
requireTrue(/from\s*=\s*"\/reviews"[\s\S]*?to\s*=\s*"\/reviews\/"[\s\S]*?status\s*=\s*301/.test(toml), 'netlify.toml lacks the canonical reviews redirect');

const headers = read(path.join(ROOT, '_headers'));
requireTrue(/\/\*\s*\n\s*Cache-Control:\s*no-cache, max-age=0, must-revalidate/i.test(headers), 'global clean-route cache revalidation policy is missing');

const contractCss = read(path.join(ROOT, 'css', 'site-wide-type-zoom.css'));
for (const token of [
  'SITE-WIDE TYPOGRAPHY + ZOOM CONTRACT',
  'overflow-x: clip',
  'text-wrap: pretty',
  'overflow-wrap: break-word',
  '@media screen and (max-width: 1060px)',
  '@media screen and (max-width: 620px)'
]) requireTrue(contractCss.includes(token), `site-wide type/zoom CSS is missing: ${token}`);

const styleFiles = walk(ROOT).filter(p => !p.startsWith(PUBLIC + path.sep) && /\.(?:html|css)$/i.test(p));
const absoluteTiny = /font-size\s*:\s*(?:8|9|10)px\b|font-size\s*:\s*0\.(?:5(?:0+)?|5[1-9]\d*|6(?:0+)?|6[1-5]\d*)rem\b/gi;
for (const file of styleFiles) {
  const text = stripCssComments(read(file));
  if (/word-break\s*:\s*break-all/i.test(text)) failures.push(`${rel(file)}: still uses word-break: break-all`);
  const hits = text.match(absoluteTiny);
  if (hits) failures.push(`${rel(file)}: absolute screen font sizes below the readability floor remain (${[...new Set(hits)].join(', ')})`);
  const fontLinks = [...text.matchAll(/<link[^>]+href=["'](https:\/\/fonts\.googleapis\.com\/[^"']+)["']/gi)];
  for (const m of fontLinks) if (!m[1].includes('display=swap')) failures.push(`${rel(file)}: Google Fonts request lacks display=swap`);
}

const saul = read(path.join(ROOT, 'saul', 'index.html'));
requireTrue(saul.includes('href="/reviews/"'), 'Saul page does not link to the reviews page');
const footer = read(path.join(ROOT, 'js', 'footer.js'));
requireTrue(footer.includes("['Reviews & references', '/reviews/']"), 'shared footer does not expose reviews');
const sitemap = read(path.join(ROOT, 'sitemap.xml'));
requireTrue(sitemap.includes('<loc>https://seminarschools.com/reviews/</loc>'), 'XML sitemap omits reviews');
const tree = read(path.join(ROOT, 'polymyth', 'sitemap', 'index.html'));
requireTrue(tree.includes('href="/reviews/"'), 'visible sitemap omits reviews');
const llms = read(path.join(ROOT, 'llms.txt'));
requireTrue(llms.includes('https://seminarschools.com/reviews/'), 'llms.txt omits reviews');

const report = {
  generated_at: new Date().toISOString(),
  status: failures.length ? 'failed' : 'passed',
  source_html_files: sourceHtml.length,
  public_html_files: publicHtml.length,
  audited_source_pages: auditedSourceHtml.length,
  audited_public_pages: auditedPublicHtml.length,
  typography_contract: CONTRACT,
  reviews_first_reference: LINKEDIN,
  checks: {
    responsive_viewport_all_pages: !failures.some(x => x.includes('responsive viewport')),
    zoom_not_disabled: !failures.some(x => x.includes('user zoom')),
    contract_loaded_once_all_pages: !failures.some(x => x.includes('type/zoom contract')),
    natural_word_wrapping: !failures.some(x => x.includes('break-all')),
    absolute_tiny_type_removed: !failures.some(x => x.includes('readability floor')),
    clean_route_revalidation: !failures.some(x => x.includes('cache revalidation')),
    reviews_route_and_discovery: !failures.some(x => /reviews|sitemap|llms|footer|Saul page/i.test(x))
  },
  failures
};
const reportDir = path.join(ROOT, 'scripts', 'reports');
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, 'reviews-zoom-font-release.json'), JSON.stringify(report, null, 2) + '\n');

if (failures.length) {
  console.error('REVIEWS / ZOOM / FONT RELEASE CHECK FAILED');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log(`REVIEWS / ZOOM / FONT RELEASE CHECK PASSED — ${auditedSourceHtml.length} source pages and ${auditedPublicHtml.length} public pages audited; Google verification files preserved separately.`);
