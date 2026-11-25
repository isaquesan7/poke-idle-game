/** ONLINE-01C-23B2E: PRIVATE Gym turn writer with a per-action
 * domain-separated server-only HMAC seed, canonical 3v3 AI and receipts.
 * This never releases a reservation, pays prizes or issues badges.
 * A full historical audit and settlement are intentionally separate gates.
 */
import {createHmac} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createPrivateBattleRandom} from './battleEntropy.mjs';
import {loadCombatAdapter} from './battlePreview.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const MOVE=/^[a-z][a-z-]{1,63}$/;
const rollback=async(c,value)=>{await c.query('ROLLBACK');return value;};
const validAction=a=>a!==null&&typeof a==='object'&&!Array.isArray(a)&&(
  (Object.keys(a).length===1&&['basic','focus'].includes(a.kind))||
  (Object.keys(a).length===2&&a.kind==='move'&&
    typeof a.moveName==='string'&&MOVE.test(a.moveName))||
  (Object.keys(a).length===2&&a.kind==='switch'&&
    Number.isSafeInteger(a.toIndex)&&a.toIndex>=0&&a.toIndex<=2));
function keyProof(key,{accountId,gymReservationId}){
  return createHmac('sha256',key).update(JSON.stringify([
    'kanto-gym-entropy-v1','gym-key-proof-v1',
    accountId.toLowerCase(),gymReservationId.toLowerCase()
  ])).digest('hex');
}
function legalIncludes(list,action){
  return list.some(x=>isDeepStrictEqual(x,action));
}

export async function applyReservedGymTurn(pool,params){
  if(!params||typeof params!=='object'||Array.isArray(params)||
     Object.keys(params).some(k=>![
       'accountId','gymReservationId','actionId','expectedRevision','action','entropyKey','entropyKeyId'
     ].includes(k))||
     typeof params.accountId!=='string'||!UUID.test(params.accountId)||
     typeof params.gymReservationId!=='string'||!UUID.test(params.gymReservationId)||
     typeof params.actionId!=='string'||!ACTION.test(params.actionId)||
     !Number.isSafeInteger(params.expectedRevision)||params.expectedRevision<0||
     !validAction(params.action)||!Buffer.isBuffer(params.entropyKey)||
     params.entropyKey.length<32||
     (params.entropyKeyId!==undefined&&
       (typeof params.entropyKeyId!=='string'||
         !/^[a-z][a-z0-9_-]{0,31}$/.test(params.entropyKeyId))))
    return {status:'invalid'};
  const {accountId,gymReservationId,actionId,expectedRevision,action,entropyKey,entropyKeyId}=params;
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const saved=await client.query(
      'SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saved.rowCount)return await rollback(client,{status:'missing-save'});
    const earlier=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(earlier.rowCount&&earlier.rows[0].kind!=='gym-turn')
      return await rollback(client,{status:'duplicate-action'});
    const selected=await client.query(
      `SELECT status,opened_revision,turn_state,turn_entropy_proof,turn_entropy_key_id
         FROM game_gym_reservations WHERE account_id=$1 AND id=$2 FOR UPDATE`,
      [accountId,gymReservationId]);
    if(!selected.rowCount)return await rollback(client,{status:'missing'});
    const gym=selected.rows[0];
    // Replay with matching actionId and exact command must work even after
    // the session progresses. Never re-resolve an old turn or reroll an AI.
    if(earlier.rowCount){
      const receipt=await client.query(
        `SELECT player_action,turn_result,save_revision
           FROM game_gym_turn_receipts
          WHERE account_id=$1 AND gym_reservation_id=$2 AND action_id=$3`,
        [accountId,gymReservationId,actionId]);
      const r=receipt.rows[0];
      const same=r&&isDeepStrictEqual(r.player_action,action)&&
        Number(r.save_revision)===Number(earlier.rows[0].save_revision);
      return await rollback(client,same?
        {status:'replay',revision:Number(r.save_revision),result:r.turn_result}:
        {status:'duplicate-action'});
    }
    const row=saved.rows[0],revision=Number(row.revision),save=row.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(row.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});
    const state=gym.turn_state;
    if(gym.status!=='reserved'||!state||state.outcome!=='ongoing'||
       !Number.isSafeInteger(state.turn)||state.turn<0||state.turn>=120)
      return await rollback(client,{status:'unavailable'});
    const proof=keyProof(entropyKey,{accountId,gymReservationId});
    if(gym.turn_entropy_key_id!==null&&entropyKeyId!==undefined&&
       gym.turn_entropy_key_id!==entropyKeyId)
      return await rollback(client,{status:'entropy-key-version-mismatch'});
    if(gym.turn_entropy_proof!==null&&gym.turn_entropy_proof!==proof)
      return await rollback(client,{status:'entropy-mismatch'});
    const count=await client.query(
      'SELECT count(*)::int AS n FROM game_gym_turn_receipts WHERE gym_reservation_id=$1',
      [gymReservationId]);
    const ordinal=count.rows[0].n+1;
    if(ordinal>140)return await rollback(client,{status:'unavailable'});
    const core=await loadCombatAdapter();
    if(typeof core.gymLegalTurnActions!=='function'||
       typeof core.gymChooseAiAction!=='function'||
       typeof core.resolveGymTurn!=='function')
      throw new Error('Canonical Gym AI turn adapter missing');
    const legal=core.gymLegalTurnActions(state,'player');
    if(!Array.isArray(legal)||!legalIncludes(legal,action))
      return await rollback(client,{status:'blocked',reason:'illegal-action'});
    const leaderAction=core.gymChooseAiAction(state,'leader');
    if(!legalIncludes(core.gymLegalTurnActions(state,'leader'),leaderAction))
      return await rollback(client,{status:'invalid-state'});
    const seed=createPrivateBattleRandom(entropyKey,{
      accountId,encounterId:gymReservationId,phase:'gym-turn-'+ordinal
    }).integer(2**32);
    const resolved=core.resolveGymTurn(state,action,leaderAction,seed);
    if(resolved?.status!=='applied')
      return await rollback(client,{
        status:'blocked',reason:resolved?.reason??'invalid-state'
      });
    const next=resolved.state;
    // Forced KO replacement is free and does not increment turn number.
    const forced=state.player.needsReplacement||state.leader.needsReplacement;
    if(!next||next.turn!==(forced?state.turn:state.turn+1)||
       !['ongoing','player-win','leader-win','draw'].includes(next.outcome)||
       !Array.isArray(resolved.log)||!Array.isArray(resolved.frames)||
       resolved.log.length!==resolved.frames.length||
       resolved.log.length>90||!Array.isArray(resolved.snapshots)||
       resolved.snapshots.length!==resolved.log.length||
       !Array.isArray(next.player?.fighters)||next.player.fighters.length!==3||
       !Array.isArray(next.leader?.fighters)||next.leader.fighters.length!==3)
      return await rollback(client,{status:'invalid-state'});
    const nextActions=next.outcome==='ongoing'?
      core.gymLegalTurnActions(next,'player'):[];
    const result={
      actionNumber:ordinal,turn:next.turn,outcome:next.outcome,
      playerAction:action,leaderAction,state:next,
      logDelta:resolved.log,framesDelta:resolved.frames,
      nextActions
    };
    const nextRevision=revision+1;
    const updated={...save,revision:nextRevision,
      journal:{...save.journal,revision:nextRevision}};
    await client.query(
      `UPDATE game_gym_reservations SET turn_state=$3::jsonb,
          turn_entropy_proof=COALESCE(turn_entropy_proof,$4),
          turn_entropy_key_id=COALESCE(turn_entropy_key_id,$5)
        WHERE account_id=$1 AND id=$2`,
      [accountId,gymReservationId,JSON.stringify(next),proof,entropyKeyId??null]);
    await client.query(
      'UPDATE game_saves SET state=$2::jsonb,revision=$3,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(updated),nextRevision]);
    await client.query(
      `INSERT INTO game_gym_turn_receipts
        (account_id,gym_reservation_id,action_id,action_number,player_action,
         leader_action,turn_result,save_revision)
       VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8)`,
      [accountId,gymReservationId,actionId,ordinal,
        JSON.stringify(action),JSON.stringify(leaderAction),
        JSON.stringify(result),nextRevision]);
    await client.query(
      `INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision)
       VALUES($1,$2,'gym-turn',$3)`,[accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'applied',revision:nextRevision,result};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
