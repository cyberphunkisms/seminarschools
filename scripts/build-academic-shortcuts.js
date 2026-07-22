#!/usr/bin/env node
'use strict';
const {buildGroup}=require('./polymythcal-route-shell');
const check=process.argv.includes('--check');
try { const writes=buildGroup('academic',check); console.log(`ACADEMIC SHORTCUT ${check?'CHECK':'BUILD'} — unified clarity interface, ${writes} files updated.`); }
catch(error){ console.error('ACADEMIC SHORTCUT BUILD FAILED:',error.message||error); process.exit(1); }
