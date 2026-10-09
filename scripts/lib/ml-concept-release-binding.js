'use strict';
const crypto=require('crypto');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const KEY='ml_star_concept_application_update_2026_10_05';
const BASE_ARCHIVE='4df57cd3e132f97a49694e03ce302663dbaedb727ab838d098d17ac6afcb18e1';
function currentConceptArtifactHash(manifest,relative,expected){
  const update=manifest[KEY];if(!update)return expected;
  if(update.schema!=='seminar-schools-ml-concept-application-update-v1'
    ||update.release_id!=='2026-10-05-ml-concept-application-v9'
    ||update.predecessor_archive_sha256!==BASE_ARCHIVE
    ||update.predecessor_maintenance_binding_sha256!==sha(JSON.stringify(manifest.polymythcal_maintenance_20261001)))throw Error('Invalid ML concept successor/predecessor binding');
  if(Object.prototype.hasOwnProperty.call(update.predecessor_artifact_sha256||{},relative)){
    if(update.predecessor_artifact_sha256[relative]!==expected && update.predecessor_declared_artifact_sha256?.[relative]!==expected)throw Error('ML concept predecessor artifact mismatch: '+relative);
    if(!/^[0-9a-f]{64}$/.test(update.artifact_sha256?.[relative]||''))throw Error('Missing ML concept successor hash: '+relative);
    return update.artifact_sha256[relative];
  }
  return expected;
}
module.exports={KEY,BASE_ARCHIVE,currentConceptArtifactHash};
