/** ONLINE-01C-22: finish one already-paid interactive wild encounter.
 *
 * INTERNAL ONLY: no HTTP, browser RNG, bonus rewards or save migration.
 * No SQL auto-preview/auto-payout fields are read as the turn outcome.
 * A winning player may throw ONE legal ball; loss/draw allows only skip.
 * Both the spend and optional capture share a transaction with the reserved
 * → completed transition and the one-and-only account action receipt.
 */
import {isDeepStrictEqual} from 'node:util';
import {createPrivateBattleRandom,createPrivateBattleKeyProof,
  BATTLE_ENTROPY_VERSION} from './battleEntropy.mjs';
import {loadCombatAdapter} from './battlePreview.mjs';
import {replayVerifiedWildTurnHistory} from './wildTurnSettlement.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const CHOICES=Object.freeze(['skip','poke-ball','great-ball','ultra-ball']);
const rollback=async(client,value)=>{await client.query('ROLLBACK');return value;};

/** The account identity is supplied by trusted server authentication only.
 * The historical entropy key must be available until the encounter closes.
 */
export async function finishPaidWildTurnEncounter(pool,{
  accountId,encounterId,actionId,expectedRevision,choice,entropyKey
}){
  if(typeof accountId!=='string'||!UUID.test(accountId)||
     typeof encounterId!=='string'||!UUID.test(encounterId)||
     typeof actionId!=='string'||!ACTION.test(actionId)||
     !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
     !CHOICES.includes(choice)||
     !Buffer.isBuffer(entropyKey)||entropyKey.length<32)
    return {status:'invalid'};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    // Global lock order is always save -> encounter -> immutable receipts.
    const saved=await client.query(
      'SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saved.rowCount)return await rollback(client,{status:'missing-save'});
    const previous=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(previous.rowCount&&previous.rows[0].kind!=='wild-turn-finish')
      return await rollback(client,{status:'duplicate-action'});
    const found=await client.query(
      `SELECT status,region_id,species_id,pokemon_level,entropy_version,
              battle_snapshot,battle_turn_state,battle_turn_entropy_proof,
              battle_turn_certificate_action_id,battle_turn_certificate_revision,
              battle_turn_certificate_outcome,battle_turn_certificate_digest,
              battle_turn_certificate_turns,battle_turn_payout_action_id,
              battle_turn_payout_revision,battle_turn_payout_quote,
              battle_turn_payout_receipt,battle_preview,battle_sealed_outcome,
              battle_reward_quote,battle_payout_action_id,final_action_id,
              battle_turn_final_action_id,battle_turn_final_choice,
              battle_turn_final_revision,battle_turn_final_result
         FROM game_encounter_reservations
        WHERE account_id=$1 AND id=$2 FOR UPDATE`,
      [accountId,encounterId]);
    if(!found.rowCount)return await rollback(client,{status:'missing'});
    const encounter=found.rows[0];
    if(encounter.battle_turn_final_action_id!==null){
      const replay=encounter.battle_turn_final_action_id===actionId&&
        encounter.battle_turn_final_choice===choice&&previous.rowCount===1&&
        Number(previous.rows[0].save_revision)===
          Number(encounter.battle_turn_final_revision);
      return await rollback(client,replay?
        {status:'replay',revision:Number(encounter.battle_turn_final_revision),
          result:encounter.battle_turn_final_result}:
        {status:'already-finished'});
    }
    if(previous.rowCount)return await rollback(client,{status:'duplicate-action'});
    const row=saved.rows[0],revision=Number(row.revision),save=row.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(row.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});
    const session=encounter.battle_turn_state;
    if(encounter.status!=='reserved'||encounter.battle_snapshot?.regionId!==Number(encounter.region_id)||
       encounter.entropy_version!==BATTLE_ENTROPY_VERSION||
       !encounter.battle_snapshot||!session||session.phase!=='resolved'||
       !encounter.battle_turn_certificate_action_id||
       !encounter.battle_turn_payout_action_id||
       !Number.isSafeInteger(Number(encounter.battle_turn_payout_revision))||
       revision<Number(encounter.battle_turn_payout_revision)||
       Number(encounter.battle_turn_payout_revision)<=
         Number(encounter.battle_turn_certificate_revision)||
       !encounter.battle_turn_payout_quote||
       !encounter.battle_turn_payout_receipt||
       encounter.battle_turn_payout_quote.outcome!==
         encounter.battle_turn_certificate_outcome||
       encounter.battle_turn_payout_receipt.outcome!==
         encounter.battle_turn_certificate_outcome||
       encounter.battle_snapshot.opponent?.speciesId!==Number(encounter.species_id)||
       encounter.battle_snapshot.opponent?.level!==Number(encounter.pokemon_level)||
       encounter.battle_preview!==null||encounter.battle_sealed_outcome!==null||
       encounter.battle_reward_quote!==null||
       encounter.battle_payout_action_id!==null||
       encounter.final_action_id!==null)
      return await rollback(client,{status:'unavailable'});
    // A failed/lost/drawn battle may only be skipped. Never debit a ball
    // on a request that is invalid before a legitimate victory.
    if(choice!=='skip'&&session.outcome!=='win')
      return await rollback(client,{status:'unavailable'});
    if(!encounter.battle_turn_entropy_proof||
       encounter.battle_turn_entropy_proof!==createPrivateBattleKeyProof(
         entropyKey,{accountId,encounterId}))
      return await rollback(client,{status:'entropy-mismatch'});
    // Both certificate and payout MUST be actual committed account receipts.
    const referenced=await client.query(
      `SELECT action_id,kind,save_revision FROM game_action_receipts
        WHERE account_id=$1 AND action_id IN ($2,$3)`,
      [accountId,encounter.battle_turn_certificate_action_id,
        encounter.battle_turn_payout_action_id]);
    const certified=referenced.rows.find(r=>
      r.action_id===encounter.battle_turn_certificate_action_id&&
      r.kind==='wild-turn-certificate'&&
      Number(r.save_revision)===Number(encounter.battle_turn_certificate_revision));
    const paid=referenced.rows.find(r=>
      r.action_id===encounter.battle_turn_payout_action_id&&
      r.kind==='wild-turn-payout'&&
      Number(r.save_revision)===Number(encounter.battle_turn_payout_revision));
    if(!certified||!paid)return await rollback(client,{status:'invalid-receipts'});
    const history=await client.query(
      `SELECT t.action_id,t.turn_number,t.player_action,t.wild_action,
              t.turn_result,t.save_revision,a.kind,
              a.save_revision AS receipt_revision
         FROM game_wild_turn_receipts t
         LEFT JOIN game_action_receipts a
           ON a.account_id=t.account_id AND a.action_id=t.action_id
        WHERE t.account_id=$1 AND t.encounter_id=$2
        ORDER BY t.turn_number ASC`,[accountId,encounterId]);
    const core=await loadCombatAdapter();
    const snapshot=encounter.battle_snapshot; // persistent JSONB order for digest
    const verified=replayVerifiedWildTurnHistory(core,{
      snapshot,turnState:session,history:history.rows,
      accountId,encounterId,entropyKey
    });
    if(!verified||
       verified.certificate.digest!==encounter.battle_turn_certificate_digest||
       verified.certificate.outcome!==encounter.battle_turn_certificate_outcome||
       verified.certificate.turns!==Number(encounter.battle_turn_certificate_turns)||
       verified.certificate.lastRevision>=
         Number(encounter.battle_turn_certificate_revision))
      return await rollback(client,{status:'invalid-history'});
    if(typeof core.quoteFrozenBattleRewards!=='function'||
       typeof core.finalizeFrozenWildEncounter!=='function')
      throw new Error('Canonical battle/capture policy not in private game-core');
    // Revalidate the payout's private quote using only replayed outcome,
    // never the auto-preview pathway or caller-defined damage.
    const affinityRoll=createPrivateBattleRandom(entropyKey,{
      accountId,encounterId,phase:'wild-battle-affinity'
    }).integer(4);
    const dropRoll=createPrivateBattleRandom(entropyKey,{
      accountId,encounterId,phase:'wild-battle-ball-drop'
    }).integer(10000);
    const expectedQuote=core.quoteFrozenBattleRewards(
      snapshot,verified.summary,affinityRoll,dropRoll);
    const persistedQuote=encounter.battle_turn_payout_quote;
    if(!expectedQuote||!isDeepStrictEqual(expectedQuote,persistedQuote))
      return await rollback(client,{status:'invalid-payout'});
    const receipt=encounter.battle_turn_payout_receipt;
    for(const name of ['coins','trainerXp','pokemonXp','affinityDelta']){
      if(receipt[name]!==expectedQuote[name])
        return await rollback(client,{status:'invalid-payout'});
    }
    if(receipt.outcome!==expectedQuote.outcome||
       receipt.activeUid!==expectedQuote.activeUid||
       (receipt.ballDrop?.ballId??null)!==(expectedQuote.ballDropId??null))
      return await rollback(client,{status:'invalid-payout'});
    // Independent capture entropy. One throw, one debit, and encounter
    // closure in the same transaction. No XP/coins/affinity here.
    const seed=createPrivateBattleRandom(entropyKey,{
      accountId,encounterId,phase:'wild-turn-capture'
    }).integer(2**32);
    const candidate=core.finalizeFrozenWildEncounter(
      save.journal.raw,snapshot,verified.summary,choice,seed,Date.now());
    if(!candidate||typeof candidate.raw!=='string'||!candidate.result||
       !['skipped','failed','captured'].includes(candidate.result.outcome)||
       candidate.result.speciesId!==Number(encounter.species_id)||
       (choice==='skip'&&candidate.result.outcome!=='skipped')||
       (choice!=='skip'&&(candidate.result.outcome==='skipped'||
         candidate.result.ballId!==choice)))
      return await rollback(client,{status:'unavailable'});
    const nextRevision=revision+1;
    const next={...save,revision:nextRevision,
      journal:{...save.journal,raw:candidate.raw,revision:nextRevision}};
    await client.query(
      `UPDATE game_encounter_reservations
          SET status='completed',
              battle_turn_final_action_id=$3,
              battle_turn_final_choice=$4,
              battle_turn_final_revision=$5,
              battle_turn_final_result=$6::jsonb,
              battle_turn_finalized_at=now()
        WHERE account_id=$1 AND id=$2`,
      [accountId,encounterId,actionId,choice,nextRevision,
        JSON.stringify(candidate.result)]);
    await client.query(
      'UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(next),nextRevision]);
    await client.query(
      `INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision)
       VALUES($1,$2,'wild-turn-finish',$3)`,
      [accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'finished',revision:nextRevision,result:candidate.result};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
