/** ONLINE-01C-23B2B — read-only, INTERNAL preview of the NEXT Gym.
 * It freezes NO persisted battle, accepts NO team selection, bonus numbers,
 * achievements or moves from a browser. Account identity is server-verified.
 * The future Gym-start writer MUST recheck and persist a snapshot under this
 * same save lock + private RNG/turn receipt policy before a real online duel.
 */
import {loadCombatAdapter} from './battlePreview.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function rollback(client,result){
  await client.query('ROLLBACK');return result;
}
/** Preflight only. The snapshot is valid ONLY for the returned save revision;
 * do not treat it as a durable Gym reservation or proof of victory.
 */
export async function inspectNextGym(pool,params){
  if(!params||typeof params!=='object'||Array.isArray(params)||
     Object.keys(params).some(key=>!['accountId','expectedRevision'].includes(key))||
     typeof params.accountId!=='string'||!UUID.test(params.accountId)||
     !Number.isSafeInteger(params.expectedRevision)||params.expectedRevision<0)
    return {status:'invalid'};
  const {accountId,expectedRevision}=params;
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    // Serialize against the Collection writer and all account save actions.
    const saved=await client.query(
      'SELECT revision,schema_version,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saved.rowCount)return await rollback(client,{status:'missing-save'});
    const row=saved.rows[0],revision=Number(row.revision),save=row.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(row.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});
    const pending=await client.query(
      "SELECT id FROM game_encounter_reservations WHERE account_id=$1 AND status='reserved'",
      [accountId]);
    if(pending.rowCount)return await rollback(client,{status:'busy'});
    const gymBusy=await client.query(
      "SELECT id FROM game_gym_reservations WHERE account_id=$1 AND status='reserved'",
      [accountId]);
    if(gymBusy.rowCount)return await rollback(client,{status:'busy'});
    let raw;
    try{raw=JSON.parse(save.journal.raw);}catch{
      return await rollback(client,{status:'invalid-save'});
    }
    const adapter=await loadCombatAdapter();
    if(typeof adapter.canonicalOnlineGymOpeningState!=='function')
      throw new Error('Canonical Gym quote unavailable in private bundle');
    const opening=adapter.canonicalOnlineGymOpeningState(raw);
    if(!opening)return await rollback(client,{status:'unavailable'});
    return await rollback(client,{
      status:'ready',revision,
      preparation:opening.preparation,
      initialBattle:opening.battle
    });
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
