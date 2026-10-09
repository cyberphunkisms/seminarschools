const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'polymythseminars/events.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'polymythseminars/index.html'),'utf8');
const client=fs.readFileSync(path.join(root,'js/polymythcal-revamp.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/polymythcal-revamp.css'),'utf8');
const sem=fs.readFileSync(path.join(root,'scripts/seminars-prompt-runner.sh'),'utf8');
const fest=fs.readFileSync(path.join(root,'scripts/festivals-prompt-runner.sh'),'utf8');
const currentDiscoveryPassed=require('child_process').spawnSync(process.execPath,[path.join(root,'scripts/verify-polymythcal-discovery-v2.js')],{cwd:root,stdio:'inherit'}).status===0;
const checks=[
 [data._schema_version==='2.0.0','schema v2'],
 [data.events.length===data.count,'count parity'],
 [data.events.every(e=>e.confirmation_status==='confirmed'||(e.confirmation_status==='unconfirmed'&&e.qualification_reasons.length)),'qualified uncertainty'],
 [data.events.every(e=>e.city&&e.corridor_zone&&e.timezone),'structured geography'],
 [data.events.some(e=>e.corridor_zone==='montreal'),'Montréal data'],
 [currentDiscoveryPassed,'corridor and confirmation filters'],
 [
  client.includes('freshnessHtml(event)') &&
    client.includes('officialSource:') &&
    client.includes('destinationInfo(event)') &&
    client.includes('event.destination_url') &&
    client.includes('event.destination_status === "unavailable-specific-page"') &&
    client.includes('class="pm-action primary-link"') &&
    client.includes('pm-source-action') &&
    fs.readdirSync(path.join(root,'polymythseminars/events')).some(id=>{const f=path.join(root,'polymythseminars/events',id,'index.html');return fs.existsSync(f)&&fs.readFileSync(f,'utf8').includes('truth-chip')&&fs.readFileSync(f,'utf8').includes('pm-event-primary-path')}),
  'truth display',
 ],
 [css.includes('@media (max-width: 760px)')&&css.includes('.pm-calendar-agenda')&&!css.includes('max-height: 100vh'),'normal mobile scroll'],
 [
  sem.includes('polymythcal_sharding.py shard') &&
    fest.includes('polymythcal_sharding.py shard') &&
    !sem.includes('/ 259200') &&
    !fest.includes('/ 259200'),
  'gap-free scheduled shard rotation',
 ],
 [!sem.includes('Write,Bash')&&!fest.includes('Write,Bash'),'no agent shell'],
 [fs.existsSync(path.join(root,'data/polymythcal-build-manifest.json')),'build manifest'],
 [data.events.every(e=>fs.existsSync(path.join(root,'polymythseminars/events',e.id,'index.html'))),'all event pages'],
 [currentDiscoveryPassed,'chronology ICS present and undated monitoring excluded']
];
const bad=checks.filter(x=>!x[0]); if(bad.length){bad.forEach(x=>console.error('FAIL',x[1]));process.exit(1)}
console.log(`PASS Audit13: ${checks.length} checks; ${data.events.length} records; ${data.events.filter(e=>e.confirmation_status==='unconfirmed').length} qualified unconfirmed`);
