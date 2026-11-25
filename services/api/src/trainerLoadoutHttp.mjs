import {loadCombatAdapter} from './battlePreview.mjs';
import {ciOnlineFeatureEnabled} from './onlineFeatureGate.mjs';
export function trainerLoadoutHttpEnabled(env=process.env){
 return ciOnlineFeatureEnabled('ONLINE_TRAINER_LOADOUT_CI_ONLY',env);
}
export async function readTrainerLoadout(pool,accountId){
 const q=await pool.query(`SELECT s.revision,s.state,
 (EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=s.account_id AND status='reserved')
 OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=s.account_id AND status='reserved')) AS busy
 FROM game_saves s WHERE account_id=$1`,[accountId]);
 if(!q.rowCount)return {status:'missing-save'};
 const row=q.rows[0],core=await loadCombatAdapter();
 const rev=Number(row.revision);
 if(!Number.isSafeInteger(rev)||rev<0||row.state?.schemaVersion!==2||row.state.revision!==rev||row.state.journal?.revision!==rev||typeof row.state.journal.raw!=='string')return {status:'invalid-save'};
 const projection=core.onlineInventoryProjection(row.state.journal.raw);
 if(!projection)return {status:'invalid-save'};
 const raw=JSON.parse(row.state.journal.raw),pending=raw.pendingRegionalLoot==null?null:core.inspectPendingRegionalLoot(raw.pendingRegionalLoot);
 if(raw.pendingRegionalLoot!=null&&!pending)return {status:'invalid-save'};
 const expeditionPending=raw.pendingExpeditionLoot==null?null:core.inspectPendingExpeditionLoot(raw.pendingExpeditionLoot);
 if(raw.pendingExpeditionLoot!=null&&!expeditionPending)return {status:'invalid-save'};
 return {status:'ok',revision:Number(row.revision),...projection,pending,expeditionPending,canResolveExpeditionLoot:!!expeditionPending&&!row.busy&&raw.pendingBattle==null&&raw.gymSession==null&&raw.lastBattle?.captureStatus!=='available',busy:row.busy||projection.busy};
}
