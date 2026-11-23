/** ONLINE-01C-23B2H — INTERNAL Gym settlement.
 * The original shared Gym battle engine is replayed AGAIN under the same
 * account/save transaction. Catalog + trainer XP policies match local GYM-03A.
 * No HTTP endpoint and no browser-supplied outcome, reward, RNG or team.
 */
import {createHash} from 'node:crypto';
import {replayGymHistoryInTransaction} from './gymReplayAudit.mjs';
import {loadCombatAdapter} from './battlePreview.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const rollback=async(c,value)=>{await c.query('ROLLBACK');return value;};

export async function settleCertifiedGym(pool,params){
  if(!params||typeof params!=='object'||Array.isArray(params)||
    Object.keys(params).some(k=>![
      'accountId','gymReservationId','actionId','expectedRevision','entropyKey'
    ].includes(k))||
    typeof params.accountId!=='string'||!UUID.test(params.accountId)||
    typeof params.gymReservationId!=='string'||!UUID.test(params.gymReservationId)||
    typeof params.actionId!=='string'||!ACTION.test(params.actionId)||
    !Number.isSafeInteger(params.expectedRevision)||params.expectedRevision<0||
    !Buffer.isBuffer(params.entropyKey)||params.entropyKey.length<32)
    return {status:'invalid'};
  const {accountId,gymReservationId,actionId,expectedRevision,entropyKey}=params;
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const saved=await client.query(
      'SELECT revision,schema_version,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saved.rowCount)return await rollback(client,{status:'missing-save'});
    const prior=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(prior.rowCount&&prior.rows[0].kind!=='gym-payout')
      return await rollback(client,{status:'duplicate-action'});
    const found=await client.query(
      `SELECT status,gym_id,team_uids,frozen_battle,turn_state,
              certificate_action_id,certificate_outcome,certificate_revision,
              certificate_digest,certificate_turns,
              payout_action_id,payout_revision,payout_receipt
         FROM game_gym_reservations WHERE account_id=$1 AND id=$2 FOR UPDATE`,
      [accountId,gymReservationId]);
    if(!found.rowCount)return await rollback(client,{status:'missing'});
    const gym=found.rows[0];
    if(gym.payout_action_id!==null){
      const same=gym.payout_action_id===actionId&&prior.rowCount===1&&
        Number(prior.rows[0].save_revision)===Number(gym.payout_revision);
      return await rollback(client,same?
        {status:'replay',revision:Number(gym.payout_revision),paid:gym.payout_receipt}:
        {status:'already-paid'});
    }
    if(prior.rowCount)return await rollback(client,{status:'duplicate-action'});
    const row=saved.rows[0],revision=Number(row.revision),save=row.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(row.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});
    if(gym.status!=='reserved'||!gym.certificate_action_id||
       !['player-win','leader-win','draw'].includes(gym.certificate_outcome)||
       Number(gym.certificate_revision)>revision||
       !gym.turn_state||!gym.frozen_battle)
      return await rollback(client,{status:'unavailable'});
    const audit=await replayGymHistoryInTransaction(client,{
      accountId,gymReservationId,entropyKey
    });
    if(audit.status!=='verified-terminal'||audit.outcome!==gym.certificate_outcome||
       audit.turns!==Number(gym.certificate_turns))
      return await rollback(client,{status:'invalid-history'});
    const transcript=await client.query(
      `SELECT action_number,player_action,leader_action,turn_result,save_revision
         FROM game_gym_turn_receipts WHERE account_id=$1 AND gym_reservation_id=$2
        ORDER BY action_number`,[accountId,gymReservationId]);
    if(transcript.rowCount!==audit.turns)return await rollback(client,{status:'invalid-history'});
    const digest=createHash('sha256').update(JSON.stringify({
      version:1,gymReservationId,outcome:audit.outcome,
      turns:transcript.rows.map(r=>({
        actionNumber:r.action_number,playerAction:r.player_action,
        leaderAction:r.leader_action,result:r.turn_result,
        revision:Number(r.save_revision)
      }))
    })).digest('hex');
    if(digest!==gym.certificate_digest)
      return await rollback(client,{status:'invalid-certificate'});
    const core=await loadCombatAdapter();
    if(typeof core.applyCertifiedGymSettlement!=='function')
      throw new Error('Canonical Gym settlement unavailable');
    const candidate=core.applyCertifiedGymSettlement(save.journal.raw,{
      gymId:gym.gym_id,outcome:audit.outcome,
      battle:gym.turn_state,eventId:actionId
    });
    if(!candidate||typeof candidate.raw!=='string'||!candidate.paid||
       candidate.paid.gymId!==gym.gym_id||candidate.paid.outcome!==audit.outcome)
      return await rollback(client,{status:'invalid-state'});
    const nextRevision=revision+1;
    const next={...save,revision:nextRevision,
      journal:{...save.journal,raw:candidate.raw,revision:nextRevision}};
    await client.query(
      'UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(next),nextRevision]);
    await client.query(
      `UPDATE game_gym_reservations SET
          status='completed',payout_action_id=$3,payout_revision=$4,
          payout_receipt=$5::jsonb,paid_at=now()
        WHERE account_id=$1 AND id=$2`,
      [accountId,gymReservationId,actionId,nextRevision,JSON.stringify(candidate.paid)]);
    await client.query(
      `INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision)
       VALUES($1,$2,'gym-payout',$3)`,[accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'paid',revision:nextRevision,paid:candidate.paid};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
