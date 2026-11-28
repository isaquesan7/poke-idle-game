/** Private weekly Arena commands. Never register as a public route until
 * cross-activity guards and HTTP authorization are complete.
 * All commands serialize on the existing per-account save lock.
 */
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {loadCombatAdapter} from './battlePreview.mjs';
import {createPrivateBattleRandom} from './battleEntropy.mjs';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,96}$/;
const id=v=>typeof v==='string'&&UUID.test(v);
const natural=v=>Number.isSafeInteger(v)&&v>=0;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const keys=v=>Object.keys(v).sort().join(',');
const rollback=async(c,result)=>{await c.query('ROLLBACK');return result;};
const fighter=f=>({uid:f.uid,speciesId:f.combatant.speciesId,
 ...(f.combatant.megaForm?{megaForm:f.combatant.megaForm}:{}),name:f.combatant.name,
 level:f.combatant.level,hp:f.hp,maxHp:f.combatant.stats.hp,sp:f.sp,maxSp:f.maxSp});
function validCommand(command){
 if(!object(command))return false;
 if(command.type==='purchase')return keys(command)==='offerId,type'&&typeof command.offerId==='string'&&command.offerId.length<=96;
 if(command.type==='start')return keys(command)==='type';
 if(command.type==='abandon')return keys(command)==='runId,type'&&id(command.runId);
 return command.type==='challenge'&&keys(command)==='floor,runId,type,uid,weekStartMs'&&id(command.runId)&&
  natural(command.weekStartMs)&&natural(command.floor)&&command.floor>=1&&command.floor<=40&&
  natural(command.uid)&&command.uid>0;
}
export async function writeArenaAction(pool,params){
 if(!object(params)||!id(params.accountId)||typeof params.actionId!=='string'||!ACTION.test(params.actionId)||
  !natural(params.expectedRevision)||!validCommand(params.command))return {status:'invalid'};
 const {accountId,actionId,expectedRevision,command,entropyKey}=params;
 const challenge=command.type==='challenge';
 if(keys(params)!==(challenge?'accountId,actionId,command,entropyKey,expectedRevision':'accountId,actionId,command,expectedRevision')||
  (challenge&&(!Buffer.isBuffer(entropyKey)||entropyKey.length<32)))return {status:'invalid'};
 const kind='arena-'+command.type;
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const found=await c.query('SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',[accountId]);
  if(!found.rowCount)return await rollback(c,{status:'missing-save'});
  const row=found.rows[0],revision=Number(row.revision),save=row.state;
  if(!natural(revision)||row.schema_version!==2||save?.schemaVersion!==2||save.revision!==revision||
   save.journal?.revision!==revision||typeof save.journal.raw!=='string')return await rollback(c,{status:'invalid-save'});
  let source;try{source=JSON.parse(save.journal.raw);}catch{return await rollback(c,{status:'invalid-save'});}
  if(!object(source))return await rollback(c,{status:'invalid-save'});
  const receipt=await c.query('SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',[accountId,actionId]);
  if(receipt.rowCount){
   const last=source.lastArenaAction,prior=receipt.rows[0];
   if(prior.kind===kind&&last?.actionId===actionId&&last.revision===Number(prior.save_revision)&&
    isDeepStrictEqual(last.command,command))
    return await rollback(c,{status:'replay',revision:last.revision,result:last.result});
   return await rollback(c,{status:'duplicate'});
  }
  if(revision!==expectedRevision)return await rollback(c,{status:'stale'});
  const nextRevision=revision+1;if(!natural(nextRevision))return await rollback(c,{status:'invalid-save'});
  // Read the real database clock after acquiring the lock, once per action.
  // A duel settles the week reserved at this instant, atomically.
  const clock=await c.query('SELECT floor(extract(epoch from clock_timestamp())*1000)::bigint AS ms');
  const nowMs=Number(clock.rows[0].ms);
  if(!natural(nowMs))return await rollback(c,{status:'invalid-clock'});
  const busy=await c.query(`SELECT EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=$1 AND status='reserved')
   OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=$1 AND status='reserved') AS busy`,[accountId]);
  if(busy.rows[0].busy&&command.type!=='abandon')return await rollback(c,{status:'busy'});
  const core=await loadCombatAdapter();
  const view=core.onlineArenaProgress(save.journal.raw,nowMs);
  if(!view)return await rollback(c,{status:'invalid-save'});
  let transition,duel=null;
  if(command.type==='start'){
   transition=core.startOnlineArenaRun(save.journal.raw,nowMs,randomUUID());
  }else if(command.type==='purchase'){
   transition=core.applyOnlineArenaPurchase(save.journal.raw,nowMs,command.offerId,randomUUID());
  }else if(command.type==='abandon'){
   transition=core.abandonOnlineArenaRun(save.journal.raw,nowMs,command.runId);
  }else{
   if(view.busy)return await rollback(c,{status:'busy'});
   if(!view.teamEligible)return await rollback(c,{status:'invalid-team'});
   const prior=source.weeklyArena?.progress??null;
   const prepared=core.prepareArenaFloorBattle(save.journal.raw,nowMs,prior,command.weekStartMs,
    command.runId,command.floor,command.uid);
   if(prepared.status!=='ok')return await rollback(c,{status:prepared.status});
   // Reserve unique action before drawing the server-owned entropy.
   await c.query('INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision) VALUES($1,$2,$3,$4)',
    [accountId,actionId,kind,nextRevision]);
   const encounterId=randomUUID();
   const rng=createPrivateBattleRandom(entropyKey,{accountId,encounterId,phase:'arena-floor-turn'});
   const fight=core.resolvePreparedArenaDuel(prepared.battle,()=>rng.integer(2**32));
   if(fight.status!=='ok')return await rollback(c,{status:fight.status});
   transition=core.applyCertifiedOnlineArenaResult(save.journal.raw,nowMs,command.weekStartMs,
    command.runId,command.floor,command.uid,fight.outcome);
   duel={id:encounterId,weekStartMs:command.weekStartMs,runId:command.runId,floor:command.floor,
    uid:command.uid,rotationVersion:prepared.rotationVersion,outcome:fight.outcome,turns:fight.turns,
    player:fighter(fight.final.player.fighters[0]),opponent:fighter(fight.final.leader.fighters[0]),
    log:fight.log,frames:fight.frames};
  }
  if(transition.status!=='ok')return await rollback(c,{status:transition.status});
  if(!challenge)await c.query('INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision) VALUES($1,$2,$3,$4)',
   [accountId,actionId,kind,nextRevision]);
  const {raw,status,...details}=transition;
  if(duel)Object.assign(duel,{points:details.points,rewardEligible:details.rewardEligible,reward:details.reward});
  const result={...details,...(duel?{duel}:{})};
  const updated=JSON.parse(raw);
  updated.lastArenaAction={actionId,command,revision:nextRevision,result};
  if(duel)updated.lastArenaDuel=duel;
  const next={...save,revision:nextRevision,journal:{...save.journal,revision:nextRevision,raw:JSON.stringify(updated)}};
  await c.query('UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',
   [accountId,JSON.stringify(next),nextRevision]);
  await c.query('COMMIT');
  return {status:'applied',revision:nextRevision,result};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
