import {loadCombatAdapter} from './battlePreview.mjs';
import {ciOnlineFeatureEnabled} from './onlineFeatureGate.mjs';
export function movesHttpEnabled(env=process.env){
 return ciOnlineFeatureEnabled('ONLINE_MOVES_CI_ONLY',env);
}
export async function readMoves(pool,accountId){
 const q=await pool.query(`SELECT s.revision,s.state,
 (EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=s.account_id AND status='reserved')
 OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=s.account_id AND status='reserved')) AS busy
 FROM game_saves s WHERE account_id=$1`,[accountId]);
 if(!q.rowCount)return {status:'missing-save'};
 const row=q.rows[0],core=await loadCombatAdapter();
 const projection=core.onlineMoveProjection(row.state?.journal?.raw);
 if(!projection)return {status:'invalid-save'};
 return {status:'ok',revision:Number(row.revision),...projection,busy:row.busy||projection.busy};
}
