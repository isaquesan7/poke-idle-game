/** Read-only private projection. No HTTP route is mounted yet. */
import {loadCombatAdapter} from './battlePreview.mjs';
export async function readArena(pool,accountId){
 const q=await pool.query(`SELECT s.revision,s.state,
 floor(extract(epoch from clock_timestamp())*1000)::bigint AS ms,
 (EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=s.account_id AND status='reserved')
 OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=s.account_id AND status='reserved')) AS busy
 FROM game_saves s WHERE account_id=$1`,[accountId]);
 if(!q.rowCount)return {status:'missing-save'};
 const row=q.rows[0],revision=Number(row.revision),save=row.state;
 if(!Number.isSafeInteger(revision)||revision<0||save?.schemaVersion!==2||save.revision!==revision||
  save.journal?.revision!==revision||typeof save.journal.raw!=='string')return {status:'invalid-save'};
 const core=await loadCombatAdapter(),view=core.onlineArenaPublicProjection(save.journal.raw,Number(row.ms));
 if(!view)return {status:'invalid-save'};
 const last=JSON.parse(save.journal.raw).lastArenaAction;
 return {status:'ok',revision,...view,busy:row.busy||view.busy,
  lastDuel:last?.result?.duel?.weekStartMs===view.startMs?last.result.duel:null};
}
