/** 23F7A — read-only projection for the authenticated disposable Gym portal.
 * Never serialize frozen preparations, NPC title metadata, receipt internals or entropy proofs.
 * One SQL statement gives the revision, active reservation and log coherently.
 */
import {loadCombatAdapter} from './battlePreview.mjs';
import {ciOnlineFeatureEnabled} from './onlineFeatureGate.mjs';
export function gymPortalEnabled(env=process.env){
 return ciOnlineFeatureEnabled('ONLINE_GYM_PORTAL_CI_ONLY',env);
}
function side(p){
 return {activeIndex:p.activeIndex,needsReplacement:p.needsReplacement,
  voluntarySwitchesUsed:p.voluntarySwitchesUsed,
  fighters:p.fighters.map(f=>({uid:f.uid,speciesId:f.combatant.speciesId,
   level:f.combatant.level,hp:f.hp,maxHp:f.combatant.stats.hp,
   sp:f.sp,maxSp:f.maxSp,status:f.status,retreatRecoveriesUsed:f.retreatRecoveriesUsed}))};
}
export async function readCurrentGym(pool,accountId){
 const q=await pool.query(
  `SELECT s.revision,s.state,g.id,g.gym_id,g.team_uids,
    g.frozen_preparation->>'leader' AS leader,g.frozen_preparation->'leaderTrainer'->'level' AS leader_level,g.turn_state,
    g.certificate_action_id,
    EXISTS(SELECT 1 FROM game_encounter_reservations e
      WHERE e.account_id=s.account_id AND e.status='reserved') AS regional_busy,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('actionNumber',r.action_number,
      'log',r.turn_result->'logDelta') ORDER BY r.action_number)
      FROM game_gym_turn_receipts r WHERE r.account_id=s.account_id
      AND r.gym_reservation_id=g.id),'[]'::jsonb) AS history
   FROM game_saves s LEFT JOIN game_gym_reservations g
    ON g.account_id=s.account_id AND g.status='reserved'
   WHERE s.account_id=$1`,[accountId]);
 if(!q.rowCount)return {status:'missing-save'};
 const row=q.rows[0],revision=Number(row.revision);
 const core=await loadCombatAdapter();
 if(row.id){
  const state=row.turn_state;
  const phase=row.certificate_action_id?'certified':!state?'reserved':
    state.outcome==='ongoing'?'await-player':'resolved';
  return {status:'ok',revision,nextGym:null,canReserve:false,gym:{
   id:row.id,gymId:row.gym_id,leader:row.leader,leaderLevel:row.leader_level??null,teamUids:row.team_uids,
   phase,turn:state?.turn??0,outcome:state?.outcome??null,
   actionNumber:row.history.at(-1)?.actionNumber??0,
   player:state?side(state.player):null,opponent:state?side(state.leader):null,
   actions:phase==='await-player'?core.gymLegalTurnActions(state,'player'):[],
   log:row.history.flatMap(r=>Array.isArray(r.log)?r.log.filter(x=>typeof x==='string'):[])
  }};
 }
 let raw;
 try{raw=JSON.parse(row.state?.journal?.raw);}catch{return {status:'invalid-save'};}
 const preparation=core.canonicalOnlineGymPreparation(raw);
 return {status:'ok',revision,gym:null,canReserve:!!preparation&&!row.regional_busy,
  nextGym:preparation?{gymId:preparation.gymId,leader:preparation.leader,
   leaderLevel:preparation.leaderTrainer.level,teamUids:preparation.teamUids}:null};
}
