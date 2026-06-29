const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let failed = false;
function pass(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed = true;
}
const main = read('main/index.html');
const intake = read('leizu/intake/index.html');
const netlify = read('netlify.toml');
const tree = read('polymyth/sitemap/index.html');
const graph = read('polymyth/sitemap/graph/index.html');
const receipt = read('netlify/functions/leizu-form-events.mjs');
pass('main route enters canonical portfolio intake', (main.match(/\/leizu\/intake\/\?source=portfolio/g) || []).length >= 3);
pass('standalone application form removed', !/leizu-application|apply-form|apply-portfolio|\/apply\/success\//.test(main));
pass('portfolio statement remains present', /first session is offered at half price/i.test(main));
pass('intake recognises the portfolio source', /sourcePurposes\s*=\s*\{[^}]*portfolio:'portfolio'/.test(intake));
pass('intake offers a portfolio purpose', /value="portfolio">Sharing a portfolio with Leizu/.test(intake));
pass('portfolio source avoids automatic payment', /sourceRequiresReview\(\)/.test(intake) && /if\(product && !portfolioRoute\)/.test(intake));
pass('portfolio receives its own manual-review receipt', /purpose === 'portfolio'/.test(receipt) && /formName !== 'leizu-intake'/.test(receipt));
pass('retired standalone form file is absent', !fs.existsSync(path.join(root, 'main', 'index.before-leizu-funnel.html')));
pass('legacy success route redirects to portfolio intake', /from = "\/apply\/success\/"[\s\S]*?to = "\/leizu\/intake\/\?source=portfolio"/.test(netlify));
pass('tree sitemap points to canonical portfolio intake', tree.includes('/leizu/intake/?source=portfolio'));
pass('graph replaces retired portfolio success route', graph.includes('/leizu/intake/?source=portfolio') && !graph.includes('"/apply/success/"'));
if (failed) process.exit(1);
console.log('Main to Leizu portfolio funnel guard passed.');
process.exit(0);
