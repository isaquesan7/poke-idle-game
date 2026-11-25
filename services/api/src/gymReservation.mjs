/** ONLINE-01C-23B2C — INTERNAL, server-authoritative Gym reservation.
 * Freezes the NEXT Gym and the three owned UIDs ALREADY selected in Collection.
 * Neither web clients nor this writer can choose a trio, seed, result or loot.
 * This is NOT a resolved match: no HP changes, turns, badges or rewards.
 */
import {loadCombatAdapter} from './battlePreview.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const rollback=async(client,value)=>{await client.query('ROLLBACK');return value;};

/** accountId must originate from authenticated SERVER context. */
export async function reserveNextGym(pool,params){
  if(!params||typeof params!=='object'||Array.isArray(params)||
     Object.keys(params).some(k=>!['accountId','actionId','expectedRevision'].includes(k))||
     typeof params.accountId!=='string'||!UUID.test(params.accountId)||
     typeof params.actionId!=='string'||!ACTION.test(params.actionId)||
     !Number.isSafeInteger(params.expectedRevision)||params.expectedRevision<0)
    return {status:'invalid'};
  const {accountId,actionId,expectedRevision}=params;
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    // Lock order is always saves first, then gym / regional reservation.
    const saved=await client.query(
      'SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saved.rowCount)return await rollback(client,{status:'missing-save'});
    const receipt=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(receipt.rowCount){
      if(receipt.rows[0].kind!=='gym-reserve')
        return await rollback(client,{status:'duplicate-action'});
      const earlier=await client.query(
        'SELECT id,gym_id,team_uids,opened_revision,status FROM game_gym_reservations WHERE account_id=$1 AND action_id=$2',
        [accountId,actionId]);
      if(!earlier.rowCount||Number(earlier.rows[0].opened_revision)!==Number(receipt.rows[0].save_revision))
        return await rollback(client,{status:'duplicate-action'});
      const row=earlier.rows[0];
      return await rollback(client,{status:'replay',gymReservationId:row.id,
        gymId:row.gym_id,teamUids:row.team_uids,revision:Number(row.opened_revision),
        reservationStatus:row.status});
    }
    const row=saved.rows[0],revision=Number(row.revision),save=row.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(row.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});
    const reservedGym=await client.query(
      "SELECT id FROM game_gym_reservations WHERE account_id=$1 AND status='reserved'",
      [accountId]);
    if(reservedGym.rowCount)return await rollback(client,{status:'busy'});
    const wild=await client.query(
      "SELECT id FROM game_encounter_reservations WHERE account_id=$1 AND status='reserved'",
      [accountId]);
    if(wild.rowCount)return await rollback(client,{status:'busy'});
    let raw;
    try{raw=JSON.parse(save.journal.raw);}catch{
      return await rollback(client,{status:'invalid-save'});
    }
    if(raw?.pendingRegionalLoot!=null||raw?.pendingExpeditionLoot!=null)return await rollback(client,{status:'busy'});
    const adapter=await loadCombatAdapter();
    if(typeof adapter.canonicalOnlineGymOpeningState!=='function')
      throw new Error('Private Gym bundle unavailable');
    const opening=adapter.canonicalOnlineGymOpeningState(raw);
    if(!opening)return await rollback(client,{status:'unavailable'});
    const p=opening.preparation,b=opening.battle;
    if(p?.version!==1||typeof p.gymId!=='string'||
       !Array.isArray(p.teamUids)||p.teamUids.length!==3||
       !Array.isArray(raw.team)||raw.team.length!==3||
       p.teamUids.some((uid,i)=>uid!==raw.team[i])||!b)
      return await rollback(client,{status:'invalid-save'});
    const nextRevision=revision+1;
    const created=await client.query(
      `INSERT INTO game_gym_reservations
       (account_id,action_id,gym_id,team_uids,frozen_preparation,frozen_battle,opened_revision)
       VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7) RETURNING id`,
      [accountId,actionId,p.gymId,JSON.stringify(p.teamUids),
        JSON.stringify(p),JSON.stringify(b),nextRevision]);
    // Reserve revision only. The trainer and roster remain unchanged until
    // a separately audited turn / settlement protocol is shipped.
    const next={...save,revision:nextRevision,
      journal:{...save.journal,revision:nextRevision}};
    await client.query(
      'UPDATE game_saves SET state=$2::jsonb,revision=$3,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(next),nextRevision]);
    await client.query(
      `INSERT INTO game_action_receipts
       (account_id,action_id,kind,save_revision)
       VALUES($1,$2,'gym-reserve',$3)`,
      [accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'reserved',gymReservationId:created.rows[0].id,
      gymId:p.gymId,teamUids:[...p.teamUids],revision:nextRevision};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
