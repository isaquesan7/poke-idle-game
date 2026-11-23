/** ONLINE-01C-16: ONE capture attempt OR skip; then close the paid encounter.
 * All game state, Pokéball consumption, resulting UID, action receipt,
 * revision and encounter release share one PostgreSQL transaction.
 * INTERNAL ONLY. No public HTTP route and no user-provided seeds/results.
 */
import {loadCombatAdapter} from './battlePreview.mjs';
import {createPrivateBattleRandom} from './battleEntropy.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const CHOICES=Object.freeze(['skip','poke-ball','great-ball','ultra-ball']);
const rollback=async(client,result)=>{await client.query('ROLLBACK');return result;};

/** Only ids from a verified account/session can reach this internal service. */
export async function finishPaidWildEncounter(pool,{
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
    // Account-first lock order is shared by reserve/seal/payout and prevents
    // opening a new encounter during the previous encounter's finalization.
    const saves=await client.query(
      'SELECT revision,schema_version,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saves.rowCount)return await rollback(client,{status:'missing-save'});
    const receipts=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(receipts.rowCount&&receipts.rows[0].kind!=='encounter-finish')
      return await rollback(client,{status:'duplicate-action'});
    const rows=await client.query(
      `SELECT status,region_id,species_id,pokemon_level,battle_sealed_outcome,
              battle_snapshot,battle_preview,battle_reward_quote,
              battle_payout_action_id,battle_payout_revision,
              final_action_id,final_choice,final_revision,final_result
         FROM game_encounter_reservations
        WHERE account_id=$1 AND id=$2 FOR UPDATE`,
      [accountId,encounterId]);
    if(!rows.rowCount)return await rollback(client,{status:'missing'});
    const encounter=rows.rows[0];
    if(encounter.final_action_id!==null){
      const match=encounter.final_action_id===actionId&&
        encounter.final_choice===choice&&receipts.rowCount===1&&
        Number(receipts.rows[0].save_revision)===Number(encounter.final_revision);
      return await rollback(client,match?
        {status:'replay',revision:Number(encounter.final_revision),
          result:encounter.final_result}:
        {status:'already-finished'});
    }
    if(receipts.rowCount)return await rollback(client,{status:'duplicate-action'});
    const saved=saves.rows[0],revision=Number(saved.revision),state=saved.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(saved.schema_version!==2||state?.schemaVersion!==2||
      state?.revision!==revision||state?.journal?.revision!==revision||
      typeof state?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});
    if(encounter.status!=='reserved'||encounter.region_id!==1||
      encounter.battle_payout_action_id===null||
      !Number.isSafeInteger(Number(encounter.battle_payout_revision))||
      revision<Number(encounter.battle_payout_revision)||
      !encounter.battle_snapshot||!encounter.battle_preview||
      !encounter.battle_reward_quote||!encounter.battle_sealed_outcome||
      encounter.battle_reward_quote.outcome!==encounter.battle_sealed_outcome||
      encounter.battle_preview.outcome!==encounter.battle_sealed_outcome||
      encounter.battle_snapshot.opponent?.speciesId!==Number(encounter.species_id)||
      encounter.battle_snapshot.opponent?.level!==Number(encounter.pokemon_level))
      return await rollback(client,{status:'unavailable'});
    const core=await loadCombatAdapter();
    if(typeof core.finalizeFrozenWildEncounter!=='function')
      throw new Error('Canonical encounter finalization not bundled');
    const captureSeed=createPrivateBattleRandom(entropyKey,{
      accountId,encounterId,phase:'wild-capture'
    }).integer(2**32);
    const candidate=core.finalizeFrozenWildEncounter(
      state.journal.raw,encounter.battle_snapshot,encounter.battle_preview,
      choice,captureSeed,Date.now());
    if(!candidate||typeof candidate.raw!=='string'||!candidate.result||
      !['skipped','failed','captured'].includes(candidate.result.outcome))
      return await rollback(client,{status:'unavailable'});
    const nextRevision=revision+1;
    const next={...state,revision:nextRevision,
      journal:{...state.journal,raw:candidate.raw,revision:nextRevision}};
    await client.query(
      'UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(next),nextRevision]);
    await client.query(
      `UPDATE game_encounter_reservations
          SET status='completed',final_action_id=$3,final_choice=$4,
              final_revision=$5,final_result=$6::jsonb,finalized_at=now()
        WHERE account_id=$1 AND id=$2`,
      [accountId,encounterId,actionId,choice,nextRevision,JSON.stringify(candidate.result)]);
    await client.query(
      `INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision)
         VALUES($1,$2,'encounter-finish',$3)`,
      [accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'finished',revision:nextRevision,result:candidate.result};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
