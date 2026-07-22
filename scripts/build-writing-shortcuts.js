#!/usr/bin/env node
'use strict';
const {buildGroup}=require('./polymythcal-route-shell');
const check=process.argv.includes('--check');
try { const writes=buildGroup('writing',check); console.log(`WRITING SHORTCUT ${check?'CHECK':'BUILD'} — unified clarity interface, ${writes} files updated.`); }
catch(error){ console.error('WRITING SHORTCUT BUILD FAILED:',error.message||error); process.exit(1); }
