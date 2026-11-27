/** ONLINE-01C-21: an independent, deterministic replay before a
 * transactionally paid wild-turn result. PRIVATE INTERNAL API, NO HTTP.
 *
 * The old automatic battle_preview is never populated or executed. Its pure
 * Kanto reward POLICY may be reused on a summary derived from replayed turns.
 * A digest alone is insufficient: every round is independently recomputed
 * from the server-owned snapshot, actions and domain-separated HMAC.
 */
import {isDeepStrictEqual} from 'node:util';
import {quoteCertifiedRegionalLoot} from './regionalLootQuote.mjs';
import {auditResolvedWildTurnTranscript} from './wildTurnCertificate.mjs';
import {buildPersistedBattleSnapshot} from './battlePreparation.mjs';
import {loadCombatAdapter} from './battlePreview.mjs';
import {BATTLE_ENTROPY_VERSION,createPrivateBattleRandom,createPrivateBattleKeyProof} from './battleEntropy.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const rollback=async(client,value)=>{await client.query('ROLLBACK');return value;};
const jsonValue=value=>JSON.parse(JSON.stringify(value));

/** Re-run the canonical Kanto gym AI/damage engine for EACH persisted turn.
 * Fails closed after a key rotation without the historical entropy key;
 * key versioning/recovery is a separate operational requirement.
 *
 * @returns {null|{certificate:object,summary:object}} Verified canonical result.
 */
export function replayVerifiedWildTurnHistory(core,{
  snapshot,turnState,history,accountId,encounterId,entropyKey
}){
  if(!core||typeof core.createFrozenWildTurnSession!=='function'||
     typeof core.resolveFrozenWildTurn!=='function'||
     !Buffer.isBuffer(entropyKey)||entropyKey.length<32)return null;
  const certificate=auditResolvedWildTurnTranscript(
    snapshot,turnState,history);
  if(!certificate)return null;
  let current=core.createFrozenWildTurnSession(snapshot);
  if(!current)return null;
  for(let i=0;i<history.length;i++){
    const record=history[i];
    const seed=createPrivateBattleRandom(entropyKey,{
      accountId,encounterId,phase:'wild-turn-'+(i+1)
    }).integer(2**32);
    const applied=core.resolveFrozenWildTurn(
      snapshot,current,record.player_action,seed);
    if(applied?.status!=='applied')return null;
    const next=jsonValue(applied.turnState);
    const expectedReceipt=jsonValue({
      turn:i+1,phase:next.phase,outcome:next.outcome??null,
      player:next.player,wild:next.wild,
      playerAction:applied.playerAction,wildAction:applied.wildAction,
      logDelta:applied.logDelta,framesDelta:applied.framesDelta,
      nextActions:applied.nextActions
    });
    // Receipts are JSONB: canonical actions may have optional undefined
    // fields that JSON serialization drops. Compare the durable wire shape.
    if(!isDeepStrictEqual(expectedReceipt,record.turn_result)||
       !isDeepStrictEqual(jsonValue(applied.playerAction),record.player_action)||
       !isDeepStrictEqual(jsonValue(applied.wildAction),record.wild_action)||
       (i+1<history.length&&next.phase!=='await-player')||
       (i+1===history.length&&next.phase!=='resolved'))return null;
    current=next;
  }
  if(!isDeepStrictEqual(current,turnState)||!certificate.turns||
     current.phase!=='resolved'||current.outcome!==certificate.outcome)
    return null;
  // This is an in-memory settlement summary, never an auto-resolved preview.
  return {certificate,summary:{
    outcome:current.outcome,turns:current.turn,
    playerRemainingHp:current.player.hp,wildRemainingHp:current.wild.hp,
    playerRemainingSp:current.player.sp,wildRemainingSp:current.wild.sp,
    log:current.log,frames:current.frames
  }};
}

/** A new distinct receipt kind; no client-supplied outcome/coins/seed/save.
 * Save→encounter lock order is identical to all account mutation writers.
 */
export async function payCertifiedWildTurns(pool,{
  accountId,encounterId,actionId,expectedRevision,entropyKey
}){
  if(typeof accountId!=='string'||!UUID.test(accountId)||
     typeof encounterId!=='string'||!UUID.test(encounterId)||
     typeof actionId!=='string'||!ACTION.test(actionId)||
     !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
     !Buffer.isBuffer(entropyKey)||entropyKey.length<32)
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
    if(prior.rowCount&&prior.rows[0].kind!=='wild-turn-payout')
      return await rollback(client,{status:'duplicate-action'});
    const found=await client.query(
      `SELECT status,region_id,species_id,pokemon_level,entropy_version,
              battle_snapshot,battle_turn_state,battle_preview,
              battle_sealed_outcome,battle_reward_quote,battle_payout_action_id,
              battle_turn_certificate_action_id,battle_turn_certificate_outcome,
              battle_turn_certificate_revision,battle_turn_certificate_digest,
              battle_turn_certificate_turns,battle_turn_entropy_proof,
              battle_turn_payout_action_id,battle_turn_payout_revision,
              battle_turn_payout_quote,battle_turn_payout_receipt,final_action_id
         FROM game_encounter_reservations
        WHERE account_id=$1 AND id=$2 FOR UPDATE`,
      [accountId,encounterId]);
    if(!found.rowCount)return await rollback(client,{status:'missing'});
    const encounter=found.rows[0];
    if(encounter.battle_turn_payout_action_id!==null){
      const same=encounter.battle_turn_payout_action_id===actionId&&
        prior.rowCount===1&&Number(prior.rows[0].save_revision)===
        Number(encounter.battle_turn_payout_revision);
      return await rollback(client,same?
        {status:'replay',revision:Number(encounter.battle_turn_payout_revision),
          paid:encounter.battle_turn_payout_receipt,
          quote:encounter.battle_turn_payout_quote}:
        {status:'already-paid'});
    }
    if(prior.rowCount)return await rollback(client,{status:'duplicate-action'});
    const row=saves.rows[0],revision=Number(row.revision),save=row.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(row.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});
    if(encounter.status!=='reserved'||encounter.battle_snapshot?.regionId!==Number(encounter.region_id)||
       encounter.entropy_version!==BATTLE_ENTROPY_VERSION||
       encounter.final_action_id!==null||
       !encounter.battle_snapshot||!encounter.battle_turn_state||
       encounter.battle_turn_state.phase!=='resolved'||
       !encounter.battle_turn_certificate_action_id||
       !encounter.battle_turn_certificate_digest||
       encounter.battle_preview!==null||
       encounter.battle_sealed_outcome!==null||
       encounter.battle_reward_quote!==null||
       encounter.battle_payout_action_id!==null||
       encounter.battle_snapshot?.opponent?.speciesId!==Number(encounter.species_id)||
       encounter.battle_snapshot?.opponent?.level!==Number(encounter.pokemon_level))
      return await rollback(client,{status:'unavailable'});
    if(!encounter.battle_turn_entropy_proof||
       encounter.battle_turn_entropy_proof!==createPrivateBattleKeyProof(
         entropyKey,{accountId,encounterId}))
      return await rollback(client,{status:'entropy-mismatch'});
    // A certification must be an actual committed account receipt.
    const certRow=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,encounter.battle_turn_certificate_action_id]);
    if(certRow.rowCount!==1||
       certRow.rows[0].kind!=='wild-turn-certificate'||
       Number(certRow.rows[0].save_revision)!==
         Number(encounter.battle_turn_certificate_revision)||
       Number(encounter.battle_turn_certificate_revision)>revision)
      return await rollback(client,{status:'invalid-certificate'});
    const fresh=await buildPersistedBattleSnapshot(save,{
      regionId:Number(encounter.region_id),
      speciesId:Number(encounter.species_id),
      level:Number(encounter.pokemon_level)
    },encounter.battle_snapshot?.tmLootVersion===1);
    if(!fresh||!isDeepStrictEqual(fresh,encounter.battle_snapshot))
      return await rollback(client,{status:'stale-snapshot'});
    // 01C-20 digests the PostgreSQL JSONB snapshot, whose object key order
    // can differ from an equivalent newly constructed JS object. Validate
    // equivalence above, but replay/hash the canonical persisted snapshot.
    const snapshot=encounter.battle_snapshot;
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
    const verified=replayVerifiedWildTurnHistory(core,{
      snapshot,turnState:encounter.battle_turn_state,history:history.rows,
      accountId,encounterId,entropyKey
    });
    if(!verified||verified.certificate.digest!==
       encounter.battle_turn_certificate_digest||
       verified.certificate.turns!==Number(encounter.battle_turn_certificate_turns)||
       verified.certificate.outcome!==encounter.battle_turn_certificate_outcome||
       verified.certificate.lastRevision>=
          Number(encounter.battle_turn_certificate_revision))
      return await rollback(client,{status:'invalid-history'});
    if(typeof core.quoteFrozenBattleRewards!=='function'||
       typeof core.applyFrozenBattleRewardQuote!=='function')
      throw new Error('Canonical Kanto reward policy adapter missing');
    // These private streams MUST match the existing drop/affinity policy.
    const affinityRoll=createPrivateBattleRandom(entropyKey,{
      accountId,encounterId,phase:'wild-battle-affinity'
    }).integer(4);
    const ballRoll=createPrivateBattleRandom(entropyKey,{
      accountId,encounterId,phase:'wild-battle-ball-drop'
    }).integer(10000);
    const quote=core.quoteFrozenBattleRewards(
      snapshot,verified.summary,affinityRoll,ballRoll);
    if(!quote||quote.outcome!==verified.certificate.outcome)
      return await rollback(client,{status:'invalid-quote'});
    const candidate=core.applyFrozenBattleRewardQuote(
      save.journal.raw,snapshot,verified.summary,quote);
    if(!candidate||typeof candidate.raw!=='string'||!candidate.paid||
       candidate.paid.outcome!==verified.certificate.outcome)
      return await rollback(client,{status:'invalid-state'});
    const loot=quoteCertifiedRegionalLoot(core,snapshot,verified.summary,{accountId,encounterId,entropyKey});
    if(!loot)return await rollback(client,{status:'invalid-loot'});
    const placed=core.placeCertifiedRegionalLoot(save.journal.raw,candidate.raw,{
      encounterId,regionId:snapshot.regionId,speciesId:snapshot.opponent.speciesId,
      outcome:quote.outcome,gear:loot.gear,stone:loot.stone,ballId:quote.ballDropId,...(loot.tmId?{tmId:loot.tmId}:{}),...(loot.megaStoneId?{megaStoneId:loot.megaStoneId}:{})
    });
    if(!placed)return await rollback(client,{status:'invalid-inventory'});
    const fullQuote={...quote,loot};
    const paid={...candidate.paid,ballDrop:candidate.paid.ballDrop?{...candidate.paid.ballDrop,quantity:placed.ballQuantity}:null,
      loot:{stored:placed.stored,pending:placed.pending}};
    const nextRevision=revision+1;
    const next={...save,revision:nextRevision,
      journal:{...save.journal,raw:placed.raw,revision:nextRevision}};
    await client.query(
      `UPDATE game_encounter_reservations
          SET battle_turn_payout_action_id=$3,
              battle_turn_payout_revision=$4,
              battle_turn_payout_quote=$5::jsonb,
              battle_turn_payout_receipt=$6::jsonb,
              battle_turn_paid_at=now()
        WHERE account_id=$1 AND id=$2`,
      [accountId,encounterId,actionId,nextRevision,
       JSON.stringify(fullQuote),JSON.stringify(paid)]);
    await client.query(
      'UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(next),nextRevision]);
    await client.query(
      `INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision)
       VALUES($1,$2,'wild-turn-payout',$3)`,
      [accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'paid',revision:nextRevision,
      paid,quote:fullQuote};
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{client.release();}
}
