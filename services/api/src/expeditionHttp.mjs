/** 23F8B — disposable CI-only HTTP read projection. No client time. */
import {loadCombatAdapter} from './battlePreview.mjs';
import {ciOnlineFeatureEnabled} from './onlineFeatureGate.mjs';
export function expeditionHttpEnabled(env=process.env){
 return ciOnlineFeatureEnabled('ONLINE_EXPEDITION_CI_ONLY',env);
}
export async function readExpedition(pool,accountId){
 const q=await pool.query(`SELECT s.revision,s.state,
  floor(extract(epoch from clock_timestamp())*1000)::bigint AS now_ms,
  (EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=s.account_id AND status='reserved')
  OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=s.account_id AND status='reserved')) AS busy
  FROM game_saves s WHERE account_id=$1`,[accountId]);
 if(!q.rowCount)return {status:'missing-save'};
 const row=q.rows[0],core=await loadCombatAdapter();
 const projection=core.onlineExpeditionProjection(row.state?.journal?.raw,Number(row.now_ms));
 if(!projection)return {status:'invalid-save'};
 return {status:'ok',revision:Number(row.revision),...projection,busy:row.busy};
}
