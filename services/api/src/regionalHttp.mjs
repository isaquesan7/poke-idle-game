/** Regional HTTP bridge for the disposable CI environment only.
 * No combat rules here: calls the existing canonical writers. Never return
 * entropy keys, proofs, snapshots, internal engine state or receipt digests.
 */
import {createWildEntropyKeyring,selectWildEncounterKey} from './wildEntropyKeyring.mjs';
import {loadCombatAdapter} from './battlePreview.mjs';
import {reserveEncounter} from './encounterReservation.mjs';
import {materializeReservedEncounter} from './encounterMaterialization.mjs';
import {prepareReservedBattle} from './battlePreparation.mjs';
import {startReservedWildTurnSession} from './wildTurnSession.mjs';
import {applyReservedWildTurn} from './wildTurnAction.mjs';
import {certifyResolvedWildTurn} from './wildTurnCertificate.mjs';
import {payCertifiedWildTurns} from './wildTurnSettlement.mjs';
import {finishPaidWildTurnEncounter} from './wildTurnFinalization.mjs';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const shapes=Object.freeze({
 reserve:'actionId,expectedRevision,regionId',
 start:'encounterId,expectedRevision',
 turn:'action,actionId,encounterId,expectedRevision',
 certify:'actionId,encounterId,expectedRevision',
 settle:'actionId,encounterId,expectedRevision',
 finish:'actionId,choice,encounterId,expectedRevision'
});
export const regionalPaths=Object.freeze(Object.keys(shapes).map(k=>'/api/v1/region/'+k));
export function loadRegionalTestKey(env=process.env){
 const db=new URL(env.DATABASE_URL??'');
 const hex=env.WILD_CI_ENTROPY_HEX;
 if(env.NODE_ENV!=='test'||env.ONLINE_REGISTRATION_ENABLED!=='true'||
    db.protocol!=='postgresql:'||db.hostname!=='127.0.0.1'||db.port!=='55432'||
    db.pathname!=='/kanto_ci'||db.username!=='kanto_ci'||db.search||
    typeof hex!=='string'||!/^[a-f0-9]{64}$/.test(hex))
   throw new Error('Regional CI key unavailable');
 return Buffer.from(hex,'hex');
}
export function loadRegionalTestKeyring(env=process.env){
 return createWildEntropyKeyring({activeId:'ci',keys:{ci:loadRegionalTestKey(env).toString('hex')}});
}
export function regionalExpansionEnabled(env=process.env){
 if(env.ONLINE_REGIONAL_EXPANSION_CI_ONLY!=='true')return false;
 loadRegionalTestKey(env);
 return true;
}
function actor(p){return p?{speciesId:p.speciesId,hp:p.hp,maxHp:p.maxHp,
 sp:p.sp,maxSp:p.maxSp,status:p.status,equippedMoves:p.equippedMoves,
 ...(p.uid===undefined?{}:{uid:p.uid})}:null;}
export async function readRegionalEncounter(pool,accountId,expanded=false){
 const result=await pool.query(
  `SELECT s.revision,s.state,e.id,e.region_id,e.species_id,e.pokemon_level,
     e.battle_snapshot,e.battle_turn_state,e.battle_turn_certificate_action_id,e.battle_turn_payout_action_id,e.battle_turn_payout_receipt
     FROM game_saves s LEFT JOIN game_encounter_reservations e
       ON e.account_id=s.account_id AND e.status='reserved'
     WHERE s.account_id=$1`,[accountId]);
 if(!result.rowCount)return {status:'missing-save'};
 const row=result.rows[0],state=row.battle_turn_state;
 let raw;
 try{raw=JSON.parse(row.state?.journal?.raw);}catch{return {status:'invalid-save'};}
 const core=await loadCombatAdapter();
 const regions=core.serverRegionalCatalog(raw?.trainer?.level);
 if(!regions)return {status:'invalid-save'};
 const phase=row.battle_turn_payout_action_id?'paid':row.battle_turn_certificate_action_id?'certified':state?.phase??'reserved';
 const actions=phase==='await-player'?core.legalFrozenWildTurnActions(row.battle_snapshot,state):[];
 const captureChoices=phase==='paid'&&state?.outcome==='win'?core.serverRegionalCaptureChoices(Number(row.region_id),Number(row.species_id),state.wild.maxHp,raw.ballPocket):[];
 return {status:'ok',revision:Number(row.revision),
  regions:expanded?regions:regions.filter(r=>r.id===1),pendingLoot:raw.pendingRegionalLoot!=null||raw.pendingExpeditionLoot!=null,encounter:row.id?{
  id:row.id,regionId:Number(row.region_id),speciesId:row.species_id,level:row.pokemon_level,
  phase,actions:actions??[],recommendedAction:phase==='await-player'?core.chooseFrozenWildPlayerAction(row.battle_snapshot,state):null,captureChoices,loot:phase==='paid'?row.battle_turn_payout_receipt?.loot??null:null,playerLevel:row.battle_snapshot?.activePokemon?.level??null,
  turn:state?.turn??0,outcome:state?.outcome??null,player:actor(state?.player),wild:actor(state?.wild),
  log:Array.isArray(state?.log)?state.log:[],frames:Array.isArray(state?.frames)?state.frames:[]
 }:null};
}
export async function runRegionalCommand(pool,accountId,command,data,entropyKey,expanded=false){
 if(!Object.hasOwn(shapes,command)||!data||Object.keys(data).sort().join(',')!==shapes[command]||
    !Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<0||
    (command!=='reserve'&&(typeof data.encounterId!=='string'||!UUID.test(data.encounterId)))||
    (command!=='start'&&(typeof data.actionId!=='string'||!ACTION.test(data.actionId))))
  return {status:'invalid'};
 if(!Buffer.isBuffer(entropyKey)&&['turn','settle','finish'].includes(command)){
  const selected=await selectWildEncounterKey(pool,entropyKey,{accountId,encounterId:data.encounterId});
  if(!['new','resolved'].includes(selected.status))return {status:selected.status};
  entropyKey=selected.key;
 }
 const params={accountId,...data};
 let result;
 if(command==='reserve')result=await reserveEncounter(pool,{...params,allowExpandedRegions:expanded===true});
 else if(command==='start'){
  // Each stage is idempotent; a network interruption can be resumed with
  // the same reserved encounter. No client can supply species or a seed.
  const pending=await readRegionalEncounter(pool,accountId,expanded);
  if(pending.status!=='ok')return pending;
  if(pending.encounter?.id!==data.encounterId)return {status:'missing'};
  if(pending.revision!==data.expectedRevision)return {status:'stale'};
  const materialized=await materializeReservedEncounter(pool,{accountId,encounterId:data.encounterId,entropyKey});
  if(!['materialized','replay'].includes(materialized.status))return {status:materialized.status};
  const prepared=await prepareReservedBattle(pool,{accountId,encounterId:data.encounterId});
  if(!['prepared','replay'].includes(prepared.status))return {status:prepared.status};
  result=await startReservedWildTurnSession(pool,params);
 }else if(command==='turn')result=await applyReservedWildTurn(pool,{...params,entropyKey});
 else if(command==='certify')result=await certifyResolvedWildTurn(pool,params);
 else if(command==='settle')result=await payCertifiedWildTurns(pool,{...params,entropyKey});
 else result=await finishPaidWildTurnEncounter(pool,{...params,entropyKey});
 // Re-read authoritative state on success. Never serialize internal result
 // indiscriminately, especially the turn engine or certificate digest.
 if(!['reserved','started','applied','certified','paid','finished','replay'].includes(result.status))
   return {status:result.status};
 const current=await readRegionalEncounter(pool,accountId,expanded);
 return {status:result.status,revision:current.revision,regions:current.regions,encounter:current.encounter,pendingLoot:current.pendingLoot,
   ...(command==='finish'?{capture:result.result?.outcome??null,rewardSummary:result.paid?{
     outcome:result.paid.outcome,coins:result.paid.coins,trainerXp:result.paid.trainerXp,pokemonXp:result.paid.pokemonXp,
     loot:result.paid.loot??{stored:[],pending:[]},capture:result.result?.outcome??null
   }:null}: {})};
}
