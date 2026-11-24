/** 23F8A — private expedition writer. No HTTP or client timestamps.
 * One transaction locks save before reading other reservations. The DB clock
 * is sampled AFTER the lock; generic durable receipt prevents any second pay.
 */
import {loadCombatAdapter} from './battlePreview.mjs';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const rollback=async(c,result)=>{await c.query('ROLLBACK');return result;};
export async function applyExpeditionCommand(pool,params){
 if(!params||!['start','claim','stop'].includes(params.kind)||
   Object.keys(params).sort().join(',')!==(params.kind==='start'?'accountId,actionId,expectedRevision,kind,regionId':'accountId,actionId,expectedRevision,kind')||
   typeof params.accountId!=='string'||!UUID.test(params.accountId)||
   typeof params.actionId!=='string'||!ACTION.test(params.actionId)||
   !Number.isSafeInteger(params.expectedRevision)||params.expectedRevision<0||
   (params.kind==='start'&&(!Number.isInteger(params.regionId)||params.regionId<1||params.regionId>10)))return {status:'invalid'};
 const {accountId,actionId,expectedRevision,kind,regionId}=params;
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const found=await c.query('SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',[accountId]);
  if(!found.rowCount)return await rollback(c,{status:'missing-save'});
  const prior=await c.query('SELECT 1 FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',[accountId,actionId]);
  // Do not return a misleading historical success to a changed payload.
  // Caller reloads authoritative state on any duplicate, same or different.
  if(prior.rowCount)return await rollback(c,{status:'duplicate'});
  const row=found.rows[0],revision=Number(row.revision),save=row.state;
  if(!Number.isSafeInteger(revision)||revision!==expectedRevision)return await rollback(c,{status:'stale'});
  if(row.schema_version!==2||save?.schemaVersion!==2||save.revision!==revision||
   save.journal?.revision!==revision||typeof save.journal.raw!=='string')return await rollback(c,{status:'invalid-save'});
  const busy=await c.query(`SELECT EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=$1 AND status='reserved')
   OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=$1 AND status='reserved') AS busy`,[accountId]);
  if(busy.rows[0].busy)return await rollback(c,{status:'busy'});
  const time=await c.query('SELECT floor(extract(epoch from clock_timestamp())*1000)::bigint AS ms');
  const nowMs=Number(time.rows[0].ms);
  const core=await loadCombatAdapter();
  const raw=core.applyOnlineExpedition(save.journal.raw,kind,nowMs,regionId);
  if(typeof raw!=='string')return await rollback(c,{status:'unavailable'});
  const nextRevision=revision+1;
  const next={...save,revision:nextRevision,journal:{...save.journal,revision:nextRevision,raw}};
  await c.query('UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',[accountId,JSON.stringify(next),nextRevision]);
  await c.query('INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision) VALUES($1,$2,$3,$4)',[accountId,actionId,'expedition-'+kind,nextRevision]);
  await c.query('COMMIT');
  return {status:'applied',revision:nextRevision};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
