import {arenaActivityBlocks} from './arenaActivity.mjs';
/** ONLINE-01C-8. INTERNAL reservation only; not an HTTP route.
 * Server obtains account ID from a verified session and fixes region policy
 * before calling this. NO Pokémon/loot/stats, no RNG or battle outcome yet.
 */
import {loadCombatAdapter} from './battlePreview.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
async function rollback(client,result){
  await client.query('ROLLBACK');return result;
}
export async function reserveEncounter(pool,{accountId,actionId,expectedRevision,regionId,allowExpandedRegions=false}){
  if(typeof accountId!=='string'||!UUID.test(accountId)||
     typeof actionId!=='string'||!ACTION.test(actionId)||
     !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
     (!Number.isInteger(regionId)||regionId<1||regionId>10||(!allowExpandedRegions&&regionId!==1)))
    return {status:'invalid'}; // Other regions require release of level gating rules.
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    // Serializes every action of the account, including trainer investments.
    const saved=await client.query(
      'SELECT revision,schema_version,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saved.rowCount)return await rollback(client,{status:'missing'});
    const receipt=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(receipt.rowCount){
      if(receipt.rows[0].kind!=='encounter-reserve')
        return await rollback(client,{status:'duplicate'});
      const previous=await client.query(
        'SELECT id,region_id,opened_revision,status FROM game_encounter_reservations WHERE account_id=$1 AND action_id=$2',
        [accountId,actionId]);
      if(!previous.rowCount||previous.rows[0].region_id!==regionId)
        return await rollback(client,{status:'duplicate'});
      const old=previous.rows[0];
      return await rollback(client,{status:'replay',encounterId:old.id,
        revision:Number(old.opened_revision),encounterStatus:old.status});
    }
    const current=saved.rows[0],revision=Number(current.revision);
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    const snap=current.state;
    if(current.schema_version!==2||snap?.schemaVersion!==2||
       snap.revision!==revision||snap?.journal?.revision!==revision||
       typeof snap.journal.raw!=='string')
      return await rollback(client,{status:'invalid'});
    let raw;
    try{raw=JSON.parse(snap.journal.raw);}catch{return await rollback(client,{status:'invalid'});}
    if(raw?.expedition!=null||raw?.pendingRegionalLoot!=null||raw?.pendingExpeditionLoot!=null)return await rollback(client,{status:'busy'});
    if(await arenaActivityBlocks(client,snap.journal.raw))return await rollback(client,{status:'busy'});
    if(regionId!==1){
      const core=await loadCombatAdapter();
      if(!core.serverRegionalAccess(regionId,raw?.trainer?.level))
        return await rollback(client,{status:'locked'});
    }
    // Even with a distinct actionId, prohibit rerolls before finishing.
    const pending=await client.query(
      "SELECT id FROM game_encounter_reservations WHERE account_id=$1 AND status='reserved'",
      [accountId]);
    if(pending.rowCount)return await rollback(client,{status:'busy'});
    const gymBusy=await client.query(
      "SELECT id FROM game_gym_reservations WHERE account_id=$1 AND status='reserved'",
      [accountId]);
    if(gymBusy.rowCount)return await rollback(client,{status:'busy'});
    const nextRevision=revision+1;
    const reserved=await client.query(
      `INSERT INTO game_encounter_reservations
       (account_id,action_id,region_id,opened_revision)
       VALUES($1,$2,$3,$4) RETURNING id`,
      [accountId,actionId,regionId,nextRevision]);
    const state={...snap,revision:nextRevision,journal:{...snap.journal,revision:nextRevision}};
    await client.query(
      'UPDATE game_saves SET state=$2::jsonb,revision=$3,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(state),nextRevision]);
    await client.query(
      `INSERT INTO game_action_receipts
       (account_id,action_id,kind,save_revision)
       VALUES($1,$2,'encounter-reserve',$3)`,
      [accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'reserved',encounterId:reserved.rows[0].id,
      revision:nextRevision,regionId};
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{client.release();}
}
