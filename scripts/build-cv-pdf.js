#!/usr/bin/env node
'use strict';
const {spawnSync}=require('child_process');const path=require('path');
const r=spawnSync(process.env.PYTHON||'python3',[path.join(__dirname,'build-saul-cv-professional.py')],{stdio:'inherit'});
process.exit(r.status===null?1:r.status);
