/** ONLINE-01C-15: award XP/coins/affinity ONCE from a DB-sealed quote.
 * INTERNAL ONLY: no HTTP, no client-supplied reward contents, no captures,
 * no Pokéball drops and no reservation release. All writes atomic.
 */
import {loadCombatAdapter} from './battlePreview.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const rollback=async(client,value)=>{await client.query('ROLLBACK');return value;};

export async function paySealedBattleRewards(pool,{
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
    // Global lock order: account save before encounter, matching battleSeal.
    const saves=await client.query(
      'SELECT revision,schema_version,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saves.rowCount)return await rollback(client,{status:'missing-save'});
    const prior=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(prior.rowCount&&prior.rows[0].kind!=='battle-payout')
      return await rollback(client,{status:'duplicate-action'});
    const found=await client.query(
      `SELECT status,region_id,species_id,pokemon_level,battle_sealed_outcome,
              battle_snapshot,battle_preview,battle_reward_quote,
              battle_payout_action_id,battle_payout_revision,battle_payout_receipt
         FROM game_encounter_reservations
        WHERE account_id=$1 AND id=$2 FOR UPDATE`,[accountId,encounterId]);
    if(!found.rowCount)return await rollback(client,{status:'missing'});
    const encounter=found.rows[0];
    if(encounter.battle_payout_action_id!==null){
      const replay=encounter.battle_payout_action_id===actionId&&prior.rowCount===1
        &&Number(prior.rows[0].save_revision)===Number(encounter.battle_payout_revision);
      return await rollback(client,replay?
        {status:'replay',revision:Number(encounter.battle_payout_revision),
         paid:encounter.battle_payout_receipt}:
        {status:'already-paid'});
    }
    if(prior.rowCount)return await rollback(client,{status:'duplicate-action'});
    const current=saves.rows[0],revision=Number(current.revision),save=current.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(current.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});
    if(encounter.status!=='reserved'||encounter.region_id!==1||
       !encounter.battle_sealed_outcome||!encounter.battle_reward_quote||
       !encounter.battle_snapshot||!encounter.battle_preview||
       encounter.battle_reward_quote.outcome!==encounter.battle_sealed_outcome||
       encounter.battle_preview.outcome!==encounter.battle_sealed_outcome||
       encounter.battle_snapshot?.opponent?.speciesId!==Number(encounter.species_id)||
       encounter.battle_snapshot?.opponent?.level!==Number(encounter.pokemon_level))
      return await rollback(client,{status:'unavailable'});
    const core=await loadCombatAdapter();
    if(typeof core.applyFrozenBattleRewardQuote!=='function')
      throw new Error('Canonical reward payout missing from server bundle');
    const candidate=core.applyFrozenBattleRewardQuote(
      save.journal.raw,encounter.battle_snapshot,encounter.battle_preview,
      encounter.battle_reward_quote);
    if(!candidate||typeof candidate.raw!=='string'||!candidate.paid)
      return await rollback(client,{status:'invalid-state'});
    const nextRevision=revision+1;
    const next={...save,revision:nextRevision,
      journal:{...save.journal,raw:candidate.raw,revision:nextRevision}};
    await client.query(
      'UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(next),nextRevision]);
    await client.query(
      `UPDATE game_encounter_reservations SET
         battle_payout_action_id=$3,battle_payout_revision=$4,
         battle_payout_receipt=$5::jsonb,battle_paid_at=now()
       WHERE account_id=$1 AND id=$2`,
      [accountId,encounterId,actionId,nextRevision,JSON.stringify(candidate.paid)]);
    await client.query(
      `INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision)
       VALUES($1,$2,'battle-payout',$3)`,[accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'paid',revision:nextRevision,paid:candidate.paid};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
