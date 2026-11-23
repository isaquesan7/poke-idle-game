/** ONLINE-01C-20: certify a FINISHED authoritative wild-turn transcript.
 * Internal audit boundary only: no HTTP, auto-preview, reward, capture,
 * reroll or encounter release. A certificate is NOT an economic settlement.
 */
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {buildBattleSnapshot} from './battlePreparation.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const rollback=async(client,value)=>{await client.query('ROLLBACK');return value;};
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

/** Check the append-only server receipts, the final state and terminal HP
 * before certifying. Does NOT claim cryptographic re-simulation after key
 * rotation: independent per-turn replay validation remains a release gate.
 */
export function auditResolvedWildTurnTranscript(snapshot,session,receipts){
  if(!isObject(snapshot)||!isObject(session)||!Array.isArray(receipts)||
     session.version!==1||session.mode!=='turns'||session.regionId!==1||
     session.phase!=='resolved'||!['win','loss','draw'].includes(session.outcome)||
     !Number.isSafeInteger(session.turn)||session.turn<1||session.turn>30||
     session.maxTurns!==30||receipts.length!==session.turn||
     !Array.isArray(session.log)||!Array.isArray(session.frames)||
     session.log.length!==session.frames.length||
     !isObject(session.player)||!isObject(session.wild)||
     !Number.isSafeInteger(session.player.hp)||
     !Number.isSafeInteger(session.wild.hp)||
     session.player.hp<0||session.wild.hp<0||
     session.player.hp>session.player.maxHp||
     session.wild.hp>session.wild.maxHp||
     !isObject(session.engine))return null;
  const expectedEngineOutcome=session.outcome==='win'?'player-win':
    session.outcome==='loss'?'leader-win':'draw';
  if(session.engine.outcome!==expectedEngineOutcome||
     session.engine.turn!==session.turn||
     (session.outcome==='win'&&
       (session.wild.hp!==0||session.player.hp===0))||
     (session.outcome==='loss'&&
       (session.player.hp!==0||session.wild.hp===0))||
     (session.outcome==='draw'&&session.turn<30&&
       (session.player.hp!==0||session.wild.hp!==0)))return null;
  const logs=[],frames=[];
  let lastRevision=0;
  for(let i=0;i<receipts.length;i++){
    const r=receipts[i],result=r?.turn_result;
    if(!isObject(result)||!isObject(r.player_action)||!isObject(r.wild_action)||
       !Number.isSafeInteger(Number(r.turn_number))||
       Number(r.turn_number)!==i+1||
       result.turn!==i+1||result.phase!==(i+1===receipts.length?
         'resolved':'await-player')||
       (i+1===receipts.length&&result.outcome!==session.outcome)||
       (i+1<receipts.length&&result.outcome!==null)||
       !isDeepStrictEqual(result.playerAction,r.player_action)||
       !isDeepStrictEqual(result.wildAction,r.wild_action)||
       !Array.isArray(result.logDelta)||!Array.isArray(result.framesDelta)||
       result.logDelta.length!==result.framesDelta.length||
       r.kind!=='wild-turn'||
       Number(r.save_revision)!==Number(r.receipt_revision)||
       !Number.isSafeInteger(Number(r.save_revision))||
       Number(r.save_revision)<=lastRevision||
       Object.hasOwn(result,'seed')||
       Object.hasOwn(result,'rewards')||
       Object.hasOwn(result,'captured'))return null;
    lastRevision=Number(r.save_revision);
    logs.push(...result.logDelta);
    frames.push(...result.framesDelta);
    if(i+1===receipts.length&&
       (!isDeepStrictEqual(result.player,session.player)||
        !isDeepStrictEqual(result.wild,session.wild)))return null;
  }
  if(!isDeepStrictEqual(logs,session.log)||
     !isDeepStrictEqual(frames,session.frames))return null;
  const digest=createHash('sha256').update(JSON.stringify({
    snapshot,session,turns:receipts.map(r=>({
      turn:r.turn_number,actionId:r.action_id,
      player:r.player_action,wild:r.wild_action,
      result:r.turn_result,revision:Number(r.save_revision)
    }))
  })).digest('hex');
  return {outcome:session.outcome,turns:session.turn,digest,lastRevision};
}

/** Account identity must originate from the authenticated server context.
 * Save lock comes before encounter lock, same as every other backend writer.
 */
export async function certifyResolvedWildTurn(pool,{
  accountId,encounterId,actionId,expectedRevision
}){
  if(typeof accountId!=='string'||!UUID.test(accountId)||
     typeof encounterId!=='string'||!UUID.test(encounterId)||
     typeof actionId!=='string'||!ACTION.test(actionId)||
     !Number.isSafeInteger(expectedRevision)||expectedRevision<0)
    return {status:'invalid'};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const saves=await client.query(
      'SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saves.rowCount)return await rollback(client,{status:'missing-save'});
    const prior=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(prior.rowCount&&prior.rows[0].kind!=='wild-turn-certificate')
      return await rollback(client,{status:'duplicate-action'});
    const found=await client.query(
      `SELECT status,region_id,species_id,pokemon_level,battle_snapshot,
              battle_turn_state,battle_preview,battle_sealed_outcome,
              battle_reward_quote,battle_payout_action_id,
              battle_turn_certificate_action_id,battle_turn_certificate_outcome,
              battle_turn_certificate_revision,battle_turn_certificate_digest,
              battle_turn_certificate_turns
         FROM game_encounter_reservations
        WHERE account_id=$1 AND id=$2 FOR UPDATE`,[accountId,encounterId]);
    if(!found.rowCount)return await rollback(client,{status:'missing'});
    const encounter=found.rows[0];
    if(encounter.battle_turn_certificate_action_id!==null){
      const same=encounter.battle_turn_certificate_action_id===actionId&&
        prior.rowCount===1&&
        Number(prior.rows[0].save_revision)===
          Number(encounter.battle_turn_certificate_revision);
      return await rollback(client,same?
        {status:'replay',revision:Number(encounter.battle_turn_certificate_revision),
         certificate:{outcome:encounter.battle_turn_certificate_outcome,
           turns:Number(encounter.battle_turn_certificate_turns),
           digest:encounter.battle_turn_certificate_digest}}:
        {status:'already-certified'});
    }
    if(prior.rowCount)return await rollback(client,{status:'duplicate-action'});
    const current=saves.rows[0],revision=Number(current.revision),save=current.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(current.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});
    const session=encounter.battle_turn_state;
    if(encounter.status!=='reserved'||encounter.region_id!==1||
       !encounter.battle_snapshot||!session||
       session.phase!=='resolved'||
       encounter.battle_preview!==null||
       encounter.battle_sealed_outcome!==null||
       encounter.battle_reward_quote!==null||
       encounter.battle_payout_action_id!==null||
       encounter.battle_snapshot?.opponent?.speciesId!==Number(encounter.species_id)||
       encounter.battle_snapshot?.opponent?.level!==Number(encounter.pokemon_level))
      return await rollback(client,{status:'unavailable'});
    const frozen=buildBattleSnapshot(save,{
      regionId:Number(encounter.region_id),
      speciesId:Number(encounter.species_id),
      level:Number(encounter.pokemon_level)
    });
    if(!frozen||!isDeepStrictEqual(frozen,encounter.battle_snapshot))
      return await rollback(client,{status:'stale-snapshot'});
    const history=await client.query(
      `SELECT t.action_id,t.turn_number,t.player_action,t.wild_action,
              t.turn_result,t.save_revision,a.kind,
              a.save_revision AS receipt_revision
         FROM game_wild_turn_receipts t
         LEFT JOIN game_action_receipts a
           ON a.account_id=t.account_id AND a.action_id=t.action_id
        WHERE t.account_id=$1 AND t.encounter_id=$2
        ORDER BY t.turn_number ASC`,
      [accountId,encounterId]);
    const certificate=auditResolvedWildTurnTranscript(
      encounter.battle_snapshot,session,history.rows);
    if(!certificate||certificate.lastRevision>revision)
      return await rollback(client,{status:'invalid-history'});
    const nextRevision=revision+1;
    const next={...save,revision:nextRevision,
      journal:{...save.journal,revision:nextRevision}};
    await client.query(
      `UPDATE game_encounter_reservations
          SET battle_turn_certificate_action_id=$3,
              battle_turn_certificate_outcome=$4,
              battle_turn_certificate_revision=$5,
              battle_turn_certificate_digest=$6,
              battle_turn_certificate_turns=$7,
              battle_turn_certified_at=now()
        WHERE account_id=$1 AND id=$2`,
      [accountId,encounterId,actionId,certificate.outcome,
       nextRevision,certificate.digest,certificate.turns]);
    await client.query(
      'UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(next),nextRevision]);
    await client.query(
      `INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision)
       VALUES($1,$2,'wild-turn-certificate',$3)`,
      [accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'certified',revision:nextRevision,
      certificate:{outcome:certificate.outcome,turns:certificate.turns,
        digest:certificate.digest}};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
