#!/usr/bin/env node
const fs=require('fs');
function assert(file,rx,label){const text=fs.readFileSync(file,'utf8');if(!rx.test(text)){console.error('FAIL '+label);process.exitCode=1;}else console.log('PASS '+label);}
const home='leizu/index.html';
assert('leizu/booking-button.js',/currentPickerState\(\)/,'CTA state reader');
assert('leizu/booking-button.js',/data-intake-source/,'source CTA handoff');
assert('leizu/booking-button.js',/courseIds:state\.courseIds/,'course handoff across CTAs');
assert('leizu/booking-button.js',/path:state\.path/,'path handoff across CTAs');
assert(home,/const eslAutoSelected = new Set\(\)/,'automatic ESL state');
assert(home,/eslAutoSelected\.clear\(\)/,'automatic ESL cleared on exit');
assert(home,/selected\.clear\(\);\s*eslSelected\.clear\(\);/,'clear removes course support state');
assert(home,/LEIZU_SUPPORTED_LANGS/,'persistent language support');
assert(home,/document\.documentElement\.setAttribute\('dir', lang === 'fa' \? 'rtl' : 'ltr'\)/,'semantic RTL direction');
assert(home,/zh:\{unit:"一次付清"/,'Traditional Chinese Forest payment copy');
assert(home,/zhs:\{unit:"一次付清"/,'Simplified Chinese Forest payment copy');
assert(home,/fa:\{unit:"پرداخت یکجا"/,'Persian Forest payment copy');
assert(home,/研討課/,'Traditional Chinese seminar correction');
assert(home,/研讨课/,'Simplified Chinese seminar correction');
assert(home,/大学默认学生已具备/,'Simplified Chinese editorial correction');
assert(home,/四个核心单元/,'Simplified Chinese core-unit correction');
['leizu/intake/index.html','leizu/policies/index.html','leizu/scholarship/index.html','leizu/donate/index.html','leizu/cloud/index.html','leizu/teach/index.html','leizu/flyer/index.html','leizu/booking-success/index.html'].forEach(file=>assert(file,/\/leizu\/language-state\.js/,'language state on '+file));
if(!process.exitCode) console.log('Leizu localization and funnel guard passed.');
