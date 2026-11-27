/** Atomic Mega Stone consumption and permanent form; private until gated HTTP. */
import {randomUUID} from 'node:crypto';
import {createPrivateBattleRandom} from './battleEntropy.mjs';
import {loadCombatAdapter} from './battlePreview.mjs';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,96}$/;
const rollback=async(c,result)=>{await c.query('ROLLBACK');return result;};
export async function evolvePokemonMega(pool,params){
 if(!params||Object.keys(params).sort().join(',')!=='accountId,actionId,command,expectedRevision'||
 typeof params.accountId!=='string'||!UUID.test(params.accountId)||typeof params.actionId!=='string'||!ACTION.test(params.actionId)||
 !Number.isSafeInteger(params.expectedRevision)||params.expectedRevision<0||!params.command||typeof params.command!=='object'||Array.isArray(params.command))return {status:'invalid'};
 const {accountId,actionId,expectedRevision,command}=params;
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const found=await c.query('SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',[accountId]);
  if(!found.rowCount)return await rollback(c,{status:'missing-save'});
  const prior=await c.query('SELECT 1 FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',[accountId,actionId]);
  if(prior.rowCount)return await rollback(c,{status:'duplicate'});
  const row=found.rows[0],revision=Number(row.revision),save=row.state;
  if(!Number.isSafeInteger(revision)||revision!==expectedRevision)return await rollback(c,{status:'stale'});
  if(row.schema_version!==2||save?.schemaVersion!==2||save.revision!==revision||save.journal?.revision!==revision||typeof save.journal.raw!=='string')return await rollback(c,{status:'invalid-save'});
  const busy=await c.query(`SELECT EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=$1 AND status='reserved')
   OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=$1 AND status='reserved') AS busy`,[accountId]);
  if(busy.rows[0].busy)return await rollback(c,{status:'busy'});
  const core=await loadCombatAdapter();
  const result=core.applyOnlineMegaEvolution(save.journal.raw,command);
  if(result.status!=='ok')return await rollback(c,{status:result.status});
  const nextRevision=revision+1;
  if(!Number.isSafeInteger(nextRevision))return await rollback(c,{status:'invalid-save'});
  const next={...save,revision:nextRevision,journal:{...save.journal,revision:nextRevision,raw:result.raw}};
  await c.query('UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',[accountId,JSON.stringify(next),nextRevision]);
  await c.query('INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision) VALUES($1,$2,$3,$4)',[accountId,actionId,'pokemon-mega-evolve',nextRevision]);
  await c.query('COMMIT');
  const {raw,status,...details}=result;
  return {status:'applied',revision:nextRevision,...details};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}

/** One complete automated duel in a single transaction. No external session
 * survives the request; the save lock excludes every competing writer.
 * The action receipt prevents rerolls even after the latest replay is replaced.
 * entropyKey is injected ONLY by the trusted HTTP adapter, never request JSON.
 */
export async function challengePokemonMega(pool,params){
 if(!params||Object.keys(params).sort().join(',')!=='accountId,actionId,command,entropyKey,expectedRevision'||
 typeof params.accountId!=='string'||!UUID.test(params.accountId)||typeof params.actionId!=='string'||!ACTION.test(params.actionId)||
 !Number.isSafeInteger(params.expectedRevision)||params.expectedRevision<0||
 !Buffer.isBuffer(params.entropyKey)||params.entropyKey.length<32||
 !params.command||typeof params.command!=='object'||Array.isArray(params.command)||
 Object.keys(params.command).sort().join(',')!=='formId,uid')return {status:'invalid'};
 const {accountId,actionId,expectedRevision,command,entropyKey}=params;
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const found=await c.query('SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',[accountId]);
  if(!found.rowCount)return await rollback(c,{status:'missing-save'});
  const row=found.rows[0],revision=Number(row.revision),save=row.state;
  if(!Number.isSafeInteger(revision)||row.schema_version!==2||save?.schemaVersion!==2||save.revision!==revision||
     save.journal?.revision!==revision||typeof save.journal.raw!=='string')return await rollback(c,{status:'invalid-save'});
  const source=JSON.parse(save.journal.raw);
  const prior=await c.query('SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',[accountId,actionId]);
  if(prior.rowCount){
   const last=source.lastMegaTrial;
   if(prior.rows[0].kind==='pokemon-mega-trial'&&last?.actionId===actionId&&
      last.uid===command.uid&&last.formId===command.formId&&last.revision===Number(prior.rows[0].save_revision))
    return await rollback(c,{status:'replay',revision:last.revision,trial:last});
   return await rollback(c,{status:'duplicate'});
  }
  if(revision!==expectedRevision)return await rollback(c,{status:'stale'});
  const busy=await c.query(`SELECT EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=$1 AND status='reserved')
   OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=$1 AND status='reserved') AS busy`,[accountId]);
  if(busy.rows[0].busy)return await rollback(c,{status:'busy'});
  const core=await loadCombatAdapter();
  const eligibility=core.quoteOnlineMegaTrial(save.journal.raw,command);
  if(eligibility.status!=='ok')return await rollback(c,{status:eligibility.status});
  const nextRevision=revision+1;
  if(!Number.isSafeInteger(nextRevision))return await rollback(c,{status:'invalid-save'});
  const encounterId=randomUUID();
  // Insert receipt before the first roll; failure rolls the whole transaction
  // back, including this reservation. No client-controlled entropy identity.
  await c.query('INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision) VALUES($1,$2,$3,$4)',[accountId,actionId,'pokemon-mega-trial',nextRevision]);
  const rng=createPrivateBattleRandom(entropyKey,{accountId,encounterId,phase:'mega-trial-turn'});
  const duel=core.resolveMegaTrialBattle(save.journal.raw,command,()=>rng.integer(2**32));
  if(duel.status!=='ok')return await rollback(c,{status:duel.status});
  let updated=source;
  if(duel.outcome==='win'){
   const result=core.applyCertifiedMegaTrialVictory(save.journal.raw,command);
   if(result.status!=='ok')return await rollback(c,{status:result.status});
   updated=JSON.parse(result.raw);
  }
  const publicFighter=f=>({uid:f.uid,speciesId:f.combatant.speciesId,
   ...(f.combatant.megaForm?{megaForm:f.combatant.megaForm}:{}),name:f.combatant.name,
   level:f.combatant.level,hp:f.hp,maxHp:f.combatant.stats.hp,sp:f.sp,maxSp:f.maxSp});
  const trial={id:encounterId,actionId,revision:nextRevision,uid:duel.uid,formId:duel.formId,
   outcome:duel.outcome,stoneId:duel.outcome==='win'?duel.stoneId:null,turns:duel.turns,
   player:publicFighter(duel.final.player.fighters[0]),boss:publicFighter(duel.final.leader.fighters[0]),
   log:duel.log,frames:duel.frames};
  updated.lastMegaTrial=trial;
  const next={...save,revision:nextRevision,journal:{...save.journal,revision:nextRevision,raw:JSON.stringify(updated)}};
  await c.query('UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',[accountId,JSON.stringify(next),nextRevision]);
  await c.query('COMMIT');
  return {status:'applied',revision:nextRevision,trial};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
