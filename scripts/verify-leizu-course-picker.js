#!/usr/bin/env node
const fs=require('fs');
function must(file, pattern, label){const text=fs.readFileSync(file,'utf8');if(!pattern.test(text)){console.error('FAIL '+label);process.exitCode=1;}else console.log('PASS '+label);}
must('leizu/index.html',/wireCoursePickerInteractions/, 'delegated course picker wiring');
must('leizu/index.html',/window\.LEIZU_CURRENT_ROUTE/, 'persistent path state');
must('leizu/index.html',/eslAutoSelected\.add\(course\.id\)/, 'Simple English marks automatic course ESL flags');
must('leizu/booking-button.js',/params\.set\('path', path\)/, 'path reaches intake URL');
must('leizu/intake/index.html',/name="selected-path"/, 'intake stores path');
must('leizu/intake/index.html',/Selected path/, 'intake shows path');
if(!process.exitCode) console.log('Leizu course picker guard passed.');
