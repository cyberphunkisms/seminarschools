#!/usr/bin/env node
/* Prevents a return to one unbounded, opaque scraper job. */
const fs=require('fs'), path=require('path'); const ROOT=path.resolve(__dirname,'..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8')}
const need=(text,needle,file,problems)=>{if(!text.includes(needle)) problems.push(`${file} must contain ${needle}`)};
const problems=[];
for(const [runner,stream] of [['scripts/seminars-prompt-runner.sh','seminars'],['scripts/festivals-prompt-runner.sh','festivals']]){
 const s=read(runner);
 need(s,'timeout --signal=INT',runner,problems);
 need(s,'tee "${LOG_FILE}"',runner,problems);
 need(s,'HARVEST_TIMEOUT_SECONDS',runner,problems);
 need(s,'MAX_TURNS',runner,problems);
 need(s,'MAX_BUDGET_USD',runner,problems);
 if(stream==='festivals') need(s,'SHARD=',runner,problems);
 need(s,'data/harvest-runs',runner,problems);
 need(s,'expected output file',runner,problems);
 if(/\|\|\s*\{\s*echo\s+"ERROR: claude -p invocation failed"[^}]*exit 1/.test(s)) problems.push(`${runner} still drops the command exit context through the legacy one-line failure handler.`);
}
for(const workflow of ['.github/workflows/scrape-seminars.yml','.github/workflows/scrape-festivals.yml']){
 if(!fs.existsSync(path.join(ROOT,workflow))){problems.push(`${workflow} is missing`);continue}
 const s=read(workflow);
 need(s,'timeout-minutes:',workflow,problems);
 need(s,'actions/upload-artifact@v4',workflow,problems);
 need(s,'concurrency:',workflow,problems);
 need(s,'CLAUDE_CODE_OAUTH_TOKEN',workflow,problems);
 need(s,'Preserve harvest diagnostics',workflow,problems);
}
const seminarPrompt=read('scripts/seminars-prompt.md');
for(const needle of ['Kingston','Montréal','A screening qualifies **only when a creator or principal collaborator is confirmed','type: "festival"']) need(seminarPrompt,needle,'scripts/seminars-prompt.md',problems);
const festivalPrompt=read('scripts/festivals-prompt.md');
for(const needle of ['Kingston','Montréal','one parent festival record','individual production record','type: "festival"','SHARD','seven consecutive runs','source_yields']) need(festivalPrompt,needle,'scripts/festivals-prompt.md',problems);
const merger=read('scripts/merge_festivals.py');
for(const needle of ['merge-festival-harvest-into-calendar.js','sync-calendar-data.js','build-search-pages.js','normalize_festival_parents','"festival", "festival-of-form"']) need(merger,needle,'scripts/merge_festivals.py',problems);
if(problems.length){console.error('HARVEST PIPELINE FAILED\n- '+problems.join('\n- '));process.exit(1)}
console.log('HARVEST PIPELINE OK — bounded, observable regional harvest workflow.');
