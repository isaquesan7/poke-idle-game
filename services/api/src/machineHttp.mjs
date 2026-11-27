import {loadCombatAdapter} from './battlePreview.mjs';
import {ciOnlineFeatureEnabled} from './onlineFeatureGate.mjs';
export function machineHttpEnabled(env=process.env){return ciOnlineFeatureEnabled('ONLINE_TM_CI_ONLY',env);}
export async function readMachines(pool,accountId){
 const q=await pool.query(`SELECT s.revision,s.state,
 (EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=s.account_id AND status='reserved')
 OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=s.account_id AND status='reserved')) AS busy
 FROM game_saves s WHERE account_id=$1`,[accountId]);
 if(!q.rowCount)return {status:'missing-save'};
 const row=q.rows[0],rev=Number(row.revision);
 if(!Number.isSafeInteger(rev)||rev<0||row.state?.schemaVersion!==2||row.state.revision!==rev||row.state.journal?.revision!==rev||typeof row.state.journal.raw!=='string')return {status:'invalid-save'};
 const core=await loadCombatAdapter(),view=core.onlineMachineProjection(row.state.journal.raw);
 if(!view)return {status:'invalid-save'};
 return {status:'ok',revision:rev,...view,busy:row.busy||view.busy};
}
