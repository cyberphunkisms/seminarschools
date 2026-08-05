#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const home=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const main=fs.readFileSync(path.join(ROOT,'about/index.html'),'utf8');
const failures=[];
function fail(x){failures.push(x)}
if(!/data-homepage-contract="business-card-project-web-v1"/.test(home)) fail('home lacks the current business-card/project-web contract');
if(!/id="projectList"/.test(home) || !/const PROJECTS=\[/.test(home)) fail('home lacks the complete project-web index');
if(!/path-card/.test(main)) fail('main lacks descriptive work-path cards');
for(const [name,html] of [['home',home],['main',main]]) if(/Quick paths by role|role-strip|I’m a parent|I’m a student|I’m a teacher|>Parent<|>Student<|>Teacher<\s*<\/a>/.test(html)) fail(`${name} still contains flat role-strip language`);
for(const token of ['/leizu/','/polymythseminars/','/teacherresources/','/bb/','/aa/','/saul/']){
  if(!home.includes(`href="${token}"`) && !home.includes(`href='${token}'`)) fail(`home pathfinder missing ${token}`);
}
if((main.match(/<nav class="nav"/g)||[]).length!==1) fail('main primary nav missing or duplicated');
if(!/Find events, contests, and deadlines without losing the source trail/.test(main)) fail('main pathfinder lacks descriptive events heading');
if(failures.length){ console.error('PATHFINDER NAV CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log('PATHFINDER NAV CHECK PASSED — the homepage uses the complete project web and About retains descriptive work-path cards without flat role labels.');
