/** Private PostgreSQL Pokemon training writer: all increments atomic. */
import {loadCombatAdapter} from './battlePreview.mjs';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,96}$/;
const rollback=async(c,result)=>{await c.query('ROLLBACK');return result;};
export async function trainPokemon(pool,params){
 if(!params||!['accountId,actionId,expectedRevision,increments,pokemonUid','accountId,actionId,expectedRevision,increments,pokemonUid,reset'].includes(Object.keys(params).sort().join(','))||
  typeof params.accountId!=='string'||!UUID.test(params.accountId)||typeof params.actionId!=='string'||!ACTION.test(params.actionId)||
  !Number.isSafeInteger(params.expectedRevision)||params.expectedRevision<0||
  !Number.isSafeInteger(params.pokemonUid)||params.pokemonUid<1||
  (Object.hasOwn(params,'reset')&&typeof params.reset!=='boolean')||!params.increments||typeof params.increments!=='object'||Array.isArray(params.increments))return {status:'invalid'};
 const {accountId,actionId,expectedRevision,pokemonUid,increments,reset=false}=params;
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const found=await c.query('SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',[accountId]);
  if(!found.rowCount)return await rollback(c,{status:'missing-save'});
  const earlier=await c.query('SELECT 1 FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',[accountId,actionId]);
  if(earlier.rowCount)return await rollback(c,{status:'duplicate'});
  const row=found.rows[0],revision=Number(row.revision),save=row.state;
  if(!Number.isSafeInteger(revision)||revision!==expectedRevision)return await rollback(c,{status:'stale'});
  if(row.schema_version!==2||save?.schemaVersion!==2||save.revision!==revision||
   save.journal?.revision!==revision||typeof save.journal.raw!=='string')return await rollback(c,{status:'invalid-save'});
  const busy=await c.query(`SELECT EXISTS(SELECT 1 FROM game_encounter_reservations WHERE account_id=$1 AND status='reserved')
   OR EXISTS(SELECT 1 FROM game_gym_reservations WHERE account_id=$1 AND status='reserved') AS busy`,[accountId]);
  if(busy.rows[0].busy)return await rollback(c,{status:'busy'});
  const core=await loadCombatAdapter();
  const result=core.applyOnlinePokemonTraining(save.journal.raw,pokemonUid,increments,reset);
  if(result.status!=='ok')return await rollback(c,{status:result.status});
  const nextRevision=revision+1;
  const next={...save,revision:nextRevision,journal:{...save.journal,revision:nextRevision,raw:result.raw}};
  await c.query('UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',[accountId,JSON.stringify(next),nextRevision]);
  await c.query('INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision) VALUES($1,$2,$3,$4)',[accountId,actionId,reset?'pokemon-training-reset':'pokemon-training',nextRevision]);
  await c.query('COMMIT');
  return {status:'trained',revision:nextRevision,pokemonUid,manual:result.manual,remaining:result.remaining};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
