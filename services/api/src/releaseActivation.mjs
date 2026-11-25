/** Real production opt-in. Existing review evidence + live migration ledger;
 * no production permissions from CI flags or request input. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {evaluateReleaseConfig} from './releaseConfigPreflight.mjs';
import {evaluateReleaseReview} from './releaseReview.mjs';
export const RELEASE_MIGRATIONS=Object.freeze(['026_proxy_identity_nonces.sql','027_regional_turn_binding.sql']);
export async function releaseMigrationChecksums(){
 return Object.fromEntries(await Promise.all(RELEASE_MIGRATIONS.map(async name=>[
  name,createHash('sha256').update(await readFile(new URL('../sql/'+name,import.meta.url))).digest('hex')
 ])));
}
export async function approvedReleaseEvidence(env=process.env,{now=new Date()}={}){
 const sha=env.RAILWAY_GIT_COMMIT_SHA;
 if(typeof sha!=='string'||!/^[a-f0-9]{40}$/.test(sha))throw Error('Release commit unavailable');
 if(!evaluateReleaseConfig('api',{...env,ONLINE_REGISTRATION_ENABLED:'false'}).configShapeValid)
  throw Error('Release configuration rejected');
 let evidence;
 try{evidence=JSON.parse(env.ONLINE_RELEASE_REVIEW_JSON??'');}catch{throw Error('Release review unavailable');}
 if(evidence?.headSha!==sha||!evaluateReleaseReview(evidence,{now}).reviewComplete)
  throw Error('Release review rejected');
 const hashes=await releaseMigrationChecksums();
 for(const name of RELEASE_MIGRATIONS)
  if(evidence.reviews['migration-'+name.slice(0,3)]?.sqlSha256!==hashes[name])
   throw Error('Release migration review mismatch');
 return hashes;
}
export async function productionReleaseState(pool,env=process.env,{now=new Date()}={}){
 const closed={savesEnabled:false,registrationEnabled:false};
 if(env.NODE_ENV!=='production'||env.ONLINE_RELEASE_MODE===undefined)return closed;
 if(env.ONLINE_RELEASE_MODE!=='reviewed')throw Error('Invalid release mode');
 if(![undefined,'false','true'].includes(env.ONLINE_PUBLIC_SAVES_ENABLED)||
    ![undefined,'false','true'].includes(env.ONLINE_REGISTRATION_ENABLED))
  throw Error('Invalid release switches');
 if(env.ONLINE_PUBLIC_SAVES_ENABLED!=='true'){
  if(env.ONLINE_REGISTRATION_ENABLED==='true')throw Error('Registration requires online saves');
  return closed;
 }
 const hashes=await approvedReleaseEvidence(env,{now});
 const result=await pool.query('SELECT name,checksum FROM public.game_schema_migrations WHERE name=ANY($1::text[])',[RELEASE_MIGRATIONS]);
 if(result.rows.length!==RELEASE_MIGRATIONS.length||
    RELEASE_MIGRATIONS.some(name=>!result.rows.some(row=>row.name===name&&row.checksum===hashes[name])))
  throw Error('Release migrations not applied');
 const schema=await pool.query(`SELECT to_regclass('public.game_proxy_identity_nonces') IS NOT NULL AS nonce,
 EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.game_encounter_reservations'::regclass
 AND conname='game_encounter_turn_mode_exclusive' AND convalidated
 AND pg_get_constraintdef(oid) LIKE '%battle_snapshot%regionId%region_id%') AS regional`);
 if(schema.rows[0]?.nonce!==true||schema.rows[0]?.regional!==true)throw Error('Release schema not ready');
 return {savesEnabled:true,registrationEnabled:env.ONLINE_REGISTRATION_ENABLED==='true'};
}
