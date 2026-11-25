/** ONLINE-01C-23B2D — PRIVATE turn-zero for one reserved 3v3 Gym.
 * No turn, RNG, HP/SP mutation, reward, badge or HTTP exposure.
 * The immutable frozen opening must still match canonical Collection state.
 */
import {isDeepStrictEqual} from 'node:util';
import {loadCombatAdapter} from './battlePreview.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rollback=async(client,value)=>{await client.query('ROLLBACK');return value;};

/** AccountId must come from a verified server session, never the browser. */
export async function startReservedGymTurnSession(pool,params){
  if(!params||typeof params!=='object'||Array.isArray(params)||
     Object.keys(params).some(k=>!['accountId','gymReservationId','expectedRevision'].includes(k))||
     typeof params.accountId!=='string'||!UUID.test(params.accountId)||
     typeof params.gymReservationId!=='string'||!UUID.test(params.gymReservationId)||
     !Number.isSafeInteger(params.expectedRevision)||params.expectedRevision<0)
    return {status:'invalid'};
  const {accountId,gymReservationId,expectedRevision}=params;
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    // Global lock order: save before reservation, identical to Gym reserve.
    const saved=await client.query(
      'SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saved.rowCount)return await rollback(client,{status:'missing-save'});
    const result=await client.query(
      `SELECT gym_id,team_uids,status,opened_revision,
              frozen_preparation,frozen_battle,turn_state
         FROM game_gym_reservations WHERE account_id=$1 AND id=$2 FOR UPDATE`,
      [accountId,gymReservationId]);
    if(!result.rowCount)return await rollback(client,{status:'missing'});
    const gym=result.rows[0];
    // Turn zero is never recreated, and retries cannot reroll anything.
    if(gym.turn_state!==null){
      if(gym.status!=='reserved')return await rollback(client,{status:'unavailable'});
      const core=await loadCombatAdapter();
      const actions=core.gymLegalTurnActions(gym.turn_state,'player');
      return await rollback(client,{status:'replay',turnState:gym.turn_state,actions});
    }
    const row=saved.rows[0],revision=Number(row.revision),save=row.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(row.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});
    if(gym.status!=='reserved'||revision!==Number(gym.opened_revision))
      return await rollback(client,{status:'unavailable'});
    let raw;
    try{raw=JSON.parse(save.journal.raw);}catch{
      return await rollback(client,{status:'invalid-save'});
    }
    const core=await loadCombatAdapter();
    if(typeof core.canonicalOnlineGymOpeningState!=='function'||
       typeof core.gymLegalTurnActions!=='function')
      throw new Error('Canonical Gym turn-zero adapter unavailable');
    const opening=core.canonicalOnlineGymOpeningState(raw);
    if(!opening||opening.preparation.gymId!==gym.gym_id||
       !isDeepStrictEqual(opening.preparation.teamUids,gym.team_uids)||
       !isDeepStrictEqual(JSON.parse(JSON.stringify(opening.preparation)),gym.frozen_preparation)||
       !isDeepStrictEqual(JSON.parse(JSON.stringify(opening.battle)),gym.frozen_battle))
      return await rollback(client,{status:'stale-snapshot'});
    const state=opening.battle;
    const actions=core.gymLegalTurnActions(state,'player');
    if(state.turn!==0||state.outcome!=='ongoing'||actions.length<1||
       !state.player.fighters.every(f=>f.hp>0&&f.sp===f.maxSp)||
       !state.leader.fighters.every(f=>f.hp>0&&f.sp===f.maxSp))
      return await rollback(client,{status:'invalid-snapshot'});
    await client.query(
      `UPDATE game_gym_reservations
          SET turn_state=$3::jsonb,turn_started_at=now()
        WHERE account_id=$1 AND id=$2`,
      [accountId,gymReservationId,JSON.stringify(state)]);
    await client.query('COMMIT');
    return {status:'started',turnState:state,actions};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
