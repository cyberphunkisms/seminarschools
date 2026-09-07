#!/usr/bin/env node
'use strict';
// Artifact hashes in these active verification maps bind current source files.
// Release IDs, original source provenance and historical decisions are retained.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),file=path.join(root,'RELEASE_MANIFEST.json');
const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
let count=0;
function refresh(object){if(!object||typeof object!=='object')return;
  if(object.artifact_sha256)for(const relative of Object.keys(object.artifact_sha256)){
    const target=path.join(root,relative);if(!fs.existsSync(target))throw new Error('Missing bound source '+relative);
    const hash=crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    if(object.artifact_sha256[relative]!==hash){object.artifact_sha256[relative]=hash;count++;}
  }
  for(const [key,value] of Object.entries(object))if(key!=='artifact_sha256')refresh(value);
}
// Only current owners bind mutable working files. Prior update records are
// immutable provenance and must never be recursively refreshed.
refresh(manifest.ml_star_update);
refresh(manifest.assistant_twisting_alwaysalready_update);
manifest.geometry_paint_repair={
  release_id:'seminar-schools-geometry-restored-complete-2026-09-07',
  predecessor_archive:'seminar-schools-alwaysalready-ml-complete-2026-09-06.zip',
  predecessor_sha256:'e545aa322f868502d962d1c20b9b338739abb8fbb09b068cbe1047e524272d0d',
  canonical_id:'polymyth-mandala-main-v32',
  semantic_sha256:'4ee88632a9eb1bb4d0062b0509163d822210f7c8acf055d4712b3ae7c5191ddc',
  change:'Explicit currentColor stroke and non-scaling-stroke travel with every SVG line through symbol/use instances.',
  geometry_coordinates_changed:false,
  palette_or_camera_or_input_changed:false,
  deployment:'No deployment performed.'
};
manifest.geometry_motion_update={
  release_id:'seminar-schools-geometry-motion-complete-2026-09-07',
  predecessor_archive:'seminar-schools-geometry-restored-complete-2026-09-07.zip',
  predecessor_sha256:'a953aa8f3d70bc2aa8ab7e462ce57d551488a4b63ae3240042aaa2557096db2b',
  canonical_id:'polymyth-mandala-main-v32',
  semantic_sha256:'4ee88632a9eb1bb4d0062b0509163d822210f7c8acf055d4712b3ae7c5191ddc',
  changes:['finite time-based camera smoothing','input-only deduplicated colour writes','stable phone camera framing with native endpoints','hidden/pagehide cancellation','five route-owned motion presets'],
  canonical_drawing_and_palette_changed:false,
  physical_phone_performance:'Unverified; cloud phone-size rendering and deterministic runtime tests are separately recorded.',
  deployment:'No deployment performed.'
};
const next=JSON.stringify(manifest,null,2)+'\n';if(fs.readFileSync(file,'utf8')!==next)fs.writeFileSync(file,next);
console.log('GEOMETRY RELEASE BINDINGS UPDATED — '+count+' current artifact hashes; provenance retained.');
