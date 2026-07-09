const {spawnSync}=require('child_process');
const pkg=require('./package.json');
const cmd=pkg.scripts['verify:all'];
const parts=cmd.split(/\s*&&\s*/).filter(Boolean);
for (const part of parts) {
  const t=Date.now();
  const res=spawnSync(part,{shell:true,encoding:'utf8',timeout:45000,maxBuffer:10*1024*1024});
  const ms=Date.now()-t;
  const ok=res.status===0 && !res.error;
  console.log(`${ok?'OK':'FAIL'} ${ms}ms :: ${part}`);
  if (!ok) {
    if (res.error) console.log('ERROR',res.error.message);
    console.log((res.stderr||'').slice(-2000));
    console.log((res.stdout||'').slice(-2000));
    process.exit(1);
  }
}
