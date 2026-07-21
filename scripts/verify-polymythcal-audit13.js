const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'polymythseminars/events.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'polymythseminars/index.html'),'utf8');
const sem=fs.readFileSync(path.join(root,'scripts/seminars-prompt-runner.sh'),'utf8');
const fest=fs.readFileSync(path.join(root,'scripts/festivals-prompt-runner.sh'),'utf8');
const checks=[
 [data._schema_version==='2.0.0','schema v2'],
 [data.events.length===data.count,'count parity'],
 [data.events.every(e=>e.confirmation_status==='confirmed'||(e.confirmation_status==='unconfirmed'&&e.qualification_reasons.length)),'qualified uncertainty'],
 [data.events.every(e=>e.city&&e.corridor_zone&&e.timezone),'structured geography'],
 [data.events.some(e=>e.corridor_zone==='montreal'),'Montréal data'],
 [html.includes('Kingston→Montréal')&&html.includes('data-focus="unconfirmed"'),'corridor and confirmation filters'],
 [html.includes('truth-chip')&&html.includes('Official source'),'truth display'],
 [html.includes('max-height:none!important;overflow:visible!important'),'normal mobile scroll'],
 [sem.includes('RUN_SLOT=')&&fest.includes('RUN_SLOT='),'rotating run slots'],
 [!sem.includes('Write,Bash')&&!fest.includes('Write,Bash'),'no agent shell'],
 [fs.existsSync(path.join(root,'data/polymythcal-build-manifest.json')),'build manifest'],
 [data.events.every(e=>fs.existsSync(path.join(root,'polymythseminars/events',e.id,'index.html'))),'all event pages'],
 [data.events.every(e=>fs.existsSync(path.join(root,'polymythseminars/ics',e.id+'.ics'))),'all ICS files']
];
const bad=checks.filter(x=>!x[0]); if(bad.length){bad.forEach(x=>console.error('FAIL',x[1]));process.exit(1)}
console.log(`PASS Audit13: ${checks.length} checks; ${data.events.length} records; ${data.events.filter(e=>e.confirmation_status==='unconfirmed').length} qualified unconfirmed`);
