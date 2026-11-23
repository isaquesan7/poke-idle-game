/** ONLINE-01C-19: private, atomic one-human-action/one-wild-action turn writer.
 * Reuses canonical Kanto Gym resolver and AI via game-core bundle. All RNG
 * comes from server-only HMAC(account, encounter, turn). No HTTP routes.
 * Never settle battle preview/reward/capture until a later audited bridge.
 */
import {isDeepStrictEqual} from 'node:util';
import {createPrivateBattleRandom,createPrivateBattleKeyProof} from './battleEntropy.mjs';
import {buildBattleSnapshot} from './battlePreparation.mjs';
import {loadCombatAdapter} from './battlePreview.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const rollback=async(client,value)=>{await client.query('ROLLBACK');return value;};
const validAction=action=>action!==null&&typeof action==='object'&&!Array.isArray(action)&&
  ((Object.keys(action).length===1&&['basic','focus'].includes(action.kind))||
   (Object.keys(action).length===2&&action.kind==='move'&&
    typeof action.moveName==='string'&&/^[a-z][a-z-]{1,63}$/.test(action.moveName))||
   (Object.keys(action).length===2&&action.kind==='switch'&&
    Number.isSafeInteger(action.toIndex)&&action.toIndex>=0&&action.toIndex<=2));

export async function applyReservedWildTurn(pool,{
  accountId,encounterId,actionId,expectedRevision,action,entropyKey
}){
  if(typeof accountId!=='string'||!UUID.test(accountId)||
     typeof encounterId!=='string'||!UUID.test(encounterId)||
     typeof actionId!=='string'||!ACTION.test(actionId)||
     !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
     !validAction(action)||!Buffer.isBuffer(entropyKey)||entropyKey.length<32)
    return {status:'invalid'};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    // Consistent lock order with reserve, seal, payout and capture: save→encounter.
    const saved=await client.query(
      'SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saved.rowCount)return await rollback(client,{status:'missing-save'});
    const prior=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(prior.rowCount&&prior.rows[0].kind!=='wild-turn')
      return await rollback(client,{status:'duplicate-action'});
    const found=await client.query(
      `SELECT region_id,status,species_id,pokemon_level,battle_snapshot,
              battle_turn_state,battle_turn_entropy_proof,battle_preview,battle_sealed_outcome,
              battle_reward_quote,battle_payout_action_id
         FROM game_encounter_reservations
        WHERE account_id=$1 AND id=$2 FOR UPDATE`,[accountId,encounterId]);
    if(!found.rowCount)return await rollback(client,{status:'missing'});
    const encounter=found.rows[0];
    if(prior.rowCount){
      const logged=await client.query(
        `SELECT player_action,turn_result,save_revision
           FROM game_wild_turn_receipts
          WHERE account_id=$1 AND encounter_id=$2 AND action_id=$3`,
        [accountId,encounterId,actionId]);
      const record=logged.rows[0];
      const same=record&&isDeepStrictEqual(record.player_action,action)&&
        Number(prior.rows[0].save_revision)===Number(record.save_revision);
      return await rollback(client,same?
        {status:'replay',revision:Number(record.save_revision),result:record.turn_result}:
        {status:'duplicate-action'});
    }
    const row=saved.rows[0],revision=Number(row.revision),save=row.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(row.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});
    const session=encounter.battle_turn_state;
    if(encounter.status!=='reserved'||encounter.region_id!==1||
       !encounter.battle_snapshot||!session||
       session.phase!=='await-player'||
       !Number.isSafeInteger(session.turn)||session.turn<0||session.turn>=30||
       encounter.battle_preview!==null||encounter.battle_sealed_outcome!==null||
       encounter.battle_reward_quote!==null||encounter.battle_payout_action_id!==null||
       encounter.battle_snapshot?.opponent?.speciesId!==Number(encounter.species_id)||
       encounter.battle_snapshot?.opponent?.level!==Number(encounter.pokemon_level))
      return await rollback(client,{status:'unavailable'});
    const frozen=buildBattleSnapshot(save,{
      regionId:Number(encounter.region_id),speciesId:Number(encounter.species_id),
      level:Number(encounter.pokemon_level)
    });
    if(!frozen||!isDeepStrictEqual(frozen,encounter.battle_snapshot))
      return await rollback(client,{status:'stale-snapshot'});
    const keyProof=createPrivateBattleKeyProof(entropyKey,{accountId,encounterId});
    if(encounter.battle_turn_entropy_proof!==null&&
       encounter.battle_turn_entropy_proof!==keyProof)
      return await rollback(client,{status:'entropy-mismatch'});
    const core=await loadCombatAdapter();
    if(typeof core.resolveFrozenWildTurn!=='function')
      throw new Error('Missing canonical Kanto wild turn resolver');
    const seed=createPrivateBattleRandom(entropyKey,{
      accountId,encounterId,phase:'wild-turn-'+(session.turn+1)
    }).integer(2**32);
    const resolved=core.resolveFrozenWildTurn(
      encounter.battle_snapshot,session,action,seed);
    if(!resolved)return await rollback(client,{status:'invalid-state'});
    if(resolved.status!=='applied')
      return await rollback(client,{status:'blocked',reason:resolved.reason});
    const next=resolved.turnState,ordinal=session.turn+1;
    if(next.turn!==ordinal||!['await-player','resolved'].includes(next.phase)||
       next.log.length!==next.frames.length||
       next.log.length!==session.log.length+resolved.logDelta.length||
       resolved.logDelta.length!==resolved.framesDelta.length||
       Object.hasOwn(next,'seed')||Object.hasOwn(next,'rewards')||
       Object.hasOwn(next,'captured'))
      return await rollback(client,{status:'invalid-state'});
    const nextRevision=revision+1;
    const receipt={
      turn:ordinal,phase:next.phase,outcome:next.outcome??null,
      player:next.player,wild:next.wild,
      playerAction:resolved.playerAction,wildAction:resolved.wildAction,
      logDelta:resolved.logDelta,framesDelta:resolved.framesDelta,
      nextActions:resolved.nextActions
    };
    const updated={...save,revision:nextRevision,
      journal:{...save.journal,revision:nextRevision}};
    await client.query(
      `UPDATE game_encounter_reservations
         SET battle_turn_state=$3::jsonb,
             battle_turn_entropy_proof=COALESCE(battle_turn_entropy_proof,$4)
       WHERE account_id=$1 AND id=$2`,
      [accountId,encounterId,JSON.stringify(next),keyProof]);
    await client.query(
      `UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now()
        WHERE account_id=$1`,[accountId,JSON.stringify(updated),nextRevision]);
    await client.query(
      `INSERT INTO game_wild_turn_receipts
         (account_id,encounter_id,action_id,turn_number,player_action,
          wild_action,turn_result,save_revision)
        VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8)`,
      [accountId,encounterId,actionId,ordinal,JSON.stringify(action),
        JSON.stringify(resolved.wildAction),JSON.stringify(receipt),nextRevision]);
    await client.query(
      `INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision)
        VALUES($1,$2,'wild-turn',$3)`,[accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'applied',revision:nextRevision,result:receipt};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
