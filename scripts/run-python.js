#!/usr/bin/env node
'use strict';
const {spawnSync}=require('child_process');
const args=process.argv.slice(2);
if(!args.length){console.error('Usage: node scripts/run-python.js <script-or-module> [args...]');process.exit(2);}
const explicit=process.env.PYTHON_BIN ? [{cmd:process.env.PYTHON_BIN,prefix:[]}] : [];
const candidates=[...explicit,{cmd:'python3',prefix:[]},{cmd:'python',prefix:[]},{cmd:'py',prefix:['-3']}];
for(const candidate of candidates){
  const result=spawnSync(candidate.cmd,[...candidate.prefix,...args],{stdio:'inherit'});
  if(result.error && result.error.code==='ENOENT') continue;
  if(result.error){console.error(result.error.message);process.exit(1);}
  process.exit(result.status ?? 1);
}
console.error('Python 3 was not found. Install Python 3 or set PYTHON_BIN.');
process.exit(127);
