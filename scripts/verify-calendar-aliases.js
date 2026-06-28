#!/usr/bin/env node
/* Keeps memorable calendar shortcuts as direct permanent redirects. */
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const text=fs.readFileSync(path.join(ROOT,'_redirects'),'utf8');
const wanted={
  '/polymythcalendar':'/polymythseminars/',
  '/polymythcalendar/':'/polymythseminars/',
  '/polymythcal':'/polymythseminars/',
  '/polymythcal/':'/polymythseminars/'
};
const rows={};
for(const line of text.split(/\r?\n/)){
  const trimmed=line.trim();
  if(!trimmed || trimmed.startsWith('#')) continue;
  const parts=trimmed.split(/\s+/);
  if(parts.length>=3 && parts[0].startsWith('/')) rows[parts[0]]={to:parts[1],status:parts[2]};
}
const errors=[];
for(const [from,to] of Object.entries(wanted)){
  const row=rows[from];
  if(!row) errors.push(`missing ${from} redirect`);
  else if(row.to!==to || row.status!=='301') errors.push(`${from} must 301 directly to ${to}; found ${row.to} ${row.status}`);
}
if(errors.length){
  errors.forEach(error=>console.error('FAIL '+error));
  process.exit(1);
}
console.log('PASS — polymyth calendar aliases redirect directly to the canonical calendar.');
