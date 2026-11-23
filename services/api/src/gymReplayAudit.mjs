/** ONLINE-01C-23B2F — PRIVATE, READ-ONLY replay of the existing audited
 * 3v3 Gym engine. Trust neither browser results nor a stored winner flag.
 * This certificate is ephemeral: no badge, money, save or reservation writer.
 */
import {createHmac} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createPrivateBattleRandom} from './battleEntropy.mjs';
import {loadCombatAdapter} from './battlePreview.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const encoded=x=>JSON.parse(JSON.stringify(x));
const equal=(a,b)=>isDeepStrictEqual(encoded(a),encoded(b));
const proof=(key,accountId,id)=>createHmac('sha256',key).update(
  JSON.stringify(['kanto-gym-entropy-v1','gym-key-proof-v1',
    accountId.toLowerCase(),id.toLowerCase()])
).digest('hex');

/** Read-only preflight for later, separately authorized Gym settlement. */
function validAuditParams(params){
  return !!params&&typeof params==='object'&&!Array.isArray(params)&&
    !Object.keys(params).some(k=>!['accountId','gymReservationId','entropyKey'].includes(k))&&
    typeof params.accountId==='string'&&UUID.test(params.accountId)&&
    typeof params.gymReservationId==='string'&&UUID.test(params.gymReservationId)&&
    Buffer.isBuffer(params.entropyKey)&&params.entropyKey.length>=32;
}

/** Caller holds a consistent transaction; settlement must acquire save lock
 * before calling this helper, just like the other server writers. */
export async function replayGymHistoryInTransaction(client,params){
  if(!validAuditParams(params))return {status:'invalid'};
  const {accountId,gymReservationId,entropyKey}=params;
    const found=await client.query(
      `SELECT status,team_uids,frozen_battle,turn_state,
              turn_entropy_proof
         FROM game_gym_reservations
        WHERE account_id=$1 AND id=$2`,[accountId,gymReservationId]);
    if(!found.rowCount){
      return {status:'missing'};
    }
    const row=found.rows[0],initial=row.frozen_battle,stored=row.turn_state;
    if(!initial||!stored||!Array.isArray(row.team_uids)||
       row.team_uids.length!==3||
       !equal(initial.player?.fighters?.map(x=>x.uid),row.team_uids)){
      return {status:'invalid-snapshot'};
    }
    const turns=await client.query(
      `SELECT action_number,player_action,leader_action,
              turn_result,save_revision
         FROM game_gym_turn_receipts
        WHERE account_id=$1 AND gym_reservation_id=$2
        ORDER BY action_number`,[accountId,gymReservationId]);
    if(row.turn_entropy_proof===null||turns.rowCount===0){
      
      return {status:'not-started'};
    }
    if(row.turn_entropy_proof!==proof(entropyKey,accountId,gymReservationId)){
      
      return {status:'entropy-mismatch'};
    }
    const core=await loadCombatAdapter();
    if(typeof core.gymLegalTurnActions!=='function'||
       typeof core.gymChooseAiAction!=='function'||
       typeof core.resolveGymTurn!=='function')
      throw new Error('Gym replay engine is unavailable');
    let state=initial,lastRevision=0;
    for(let i=0;i<turns.rows.length;i++){
      const receipt=turns.rows[i],ordinal=i+1;
      if(Number(receipt.action_number)!==ordinal||
         !Number.isSafeInteger(Number(receipt.save_revision))||
         Number(receipt.save_revision)<=lastRevision||
         state.outcome!=='ongoing'){
        
        return {status:'invalid-history',actionNumber:ordinal};
      }
      const action=receipt.player_action;
      if(!core.gymLegalTurnActions(state,'player').some(a=>equal(a,action))){
        
        return {status:'invalid-history',actionNumber:ordinal};
      }
      const ai=core.gymChooseAiAction(state,'leader');
      if(!equal(ai,receipt.leader_action)){
        
        return {status:'invalid-history',actionNumber:ordinal};
      }
      const seed=createPrivateBattleRandom(entropyKey,{
        accountId,encounterId:gymReservationId,phase:'gym-turn-'+ordinal
      }).integer(2**32);
      const result=core.resolveGymTurn(state,action,ai,seed);
      if(result?.status!=='applied'){
        
        return {status:'invalid-history',actionNumber:ordinal};
      }
      const expected={
        actionNumber:ordinal,turn:result.state.turn,
        outcome:result.state.outcome,playerAction:action,leaderAction:ai,
        state:result.state,logDelta:result.log,framesDelta:result.frames,
        nextActions:result.state.outcome==='ongoing'?
          core.gymLegalTurnActions(result.state,'player'):[]
      };
      if(!equal(expected,receipt.turn_result)){
        
        return {status:'invalid-history',actionNumber:ordinal};
      }
      lastRevision=Number(receipt.save_revision);
      state=result.state;
    }
    if(!equal(state,stored)){
      
      return {status:'state-mismatch'};
    }
    // Only this derived terminal status is eligible for a future settlement
    // writer. "draw" and "leader-win" do not unlock the next Gym.
    const terminal=state.outcome!=='ongoing';
    const answer={status:terminal?'verified-terminal':'verified-progress',
      turns:turns.rows.length,outcome:state.outcome,
      gymReservationId,eligibleForBadge:state.outcome==='player-win'};
    
    return answer;
}

/** Read-only snapshot wrapper, does not acquire any write locks. */
export async function auditReservedGymBattle(pool,params){
  if(!validAuditParams(params))return {status:'invalid'};
  const client=await pool.connect();
  try{
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const answer=await replayGymHistoryInTransaction(client,params);
    await client.query('COMMIT');
    return answer;
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
