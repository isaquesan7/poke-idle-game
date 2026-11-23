/** ONLINE-01C-23B2G: PRIVATE transactional certificate of completed
 * Gym match, independently re-simulated with the same audited local core.
 * Neither badges nor XP/coins are granted here; no public HTTP.
 */
import {createHash} from 'node:crypto';
import {replayGymHistoryInTransaction} from './gymReplayAudit.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const rollback=async(client,value)=>{await client.query('ROLLBACK');return value;};

export async function certifyReservedGymBattle(pool,params){
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
    // Same save → Gym lock order as reserve, session start and every Gym action.
    const saved=await client.query(
      'SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saved.rowCount)return await rollback(client,{status:'missing-save'});
    const previous=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(previous.rowCount&&previous.rows[0].kind!=='gym-certificate')
      return await rollback(client,{status:'duplicate-action'});
    const found=await client.query(
      `SELECT status,certificate_action_id,certificate_outcome,
              certificate_revision,certificate_turns,certificate_digest
         FROM game_gym_reservations WHERE account_id=$1 AND id=$2 FOR UPDATE`,
      [accountId,gymReservationId]);
    if(!found.rowCount)return await rollback(client,{status:'missing'});
    const gym=found.rows[0];
    if(gym.certificate_action_id!==null){
      const same=gym.certificate_action_id===actionId&&
        previous.rowCount===1&&
        Number(previous.rows[0].save_revision)===Number(gym.certificate_revision);
      return await rollback(client,same?
        {status:'replay',revision:Number(gym.certificate_revision),
          certificate:{outcome:gym.certificate_outcome,turns:Number(gym.certificate_turns),
            digest:gym.certificate_digest}}:{status:'already-certified'});
    }
    if(previous.rowCount)return await rollback(client,{status:'duplicate-action'});
    const row=saved.rows[0],revision=Number(row.revision),save=row.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(row.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string)
      return await rollback(client,{status:'invalid-save'});
    if(gym.status!=='reserved')return await rollback(client,{status:'unavailable'});
    // Re-simulation happens UNDER the same save and reservation locks, so
    // there is no gap between replay verification and durable certificate.
    const audit=await replayGymHistoryInTransaction(client,{
      accountId,gymReservationId,entropyKey
    });
    if(audit.status!=='verified-terminal')
      return await rollback(client,{status:audit.status==='verified-progress'?
        'not-terminal':audit.status,actionNumber:audit.actionNumber});
    const transcript=await client.query(
      `SELECT action_number,player_action,leader_action,turn_result,
              save_revision FROM game_gym_turn_receipts
          WHERE account_id=$1 AND gym_reservation_id=$2 ORDER BY action_number`,
      [accountId,gymReservationId]);
    if(transcript.rowCount!==audit.turns)
      return await rollback(client,{status:'invalid-history'});
    const digest=createHash('sha256').update(JSON.stringify({
      version:1,gymReservationId,outcome:audit.outcome,
      turns:transcript.rows.map(r=>({
        actionNumber:r.action_number,playerAction:r.player_action,
        leaderAction:r.leader_action,result:r.turn_result,
        revision:Number(r.save_revision)
      }))
    })).digest('hex');
    const nextRevision=revision+1;
    const next={...save,revision:nextRevision,
      journal:{...save.journal,revision:nextRevision}};
    await client.query(
      `UPDATE game_gym_reservations
          SET certificate_action_id=$3,certificate_outcome=$4,
              certificate_revision=$5,certificate_turns=$6,
              certificate_digest=$7,certified_at=now()
        WHERE account_id=$1 AND id=$2`,
      [accountId,gymReservationId,actionId,audit.outcome,
       nextRevision,audit.turns,digest]);
    await client.query(
      'UPDATE game_saves SET state=$2::jsonb,revision=$3,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(next),nextRevision]);
    await client.query(
      `INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision)
       VALUES($1,$2,'gym-certificate',$3)`,
      [accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'certified',revision:nextRevision,
      certificate:{outcome:audit.outcome,turns:audit.turns,digest}};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
