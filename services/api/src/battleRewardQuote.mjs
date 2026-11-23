/** ONLINE-01C-14. Freeze a canonical quote after a server-sealed battle.
 * This is NOT a payout. Do not credit XP, affinity, items or captures, or
 * change save revision/encounter status here. Only account/encounter IDs from
 * authenticated server context; private entropy key never reaches the UI.
 */
import {createPrivateBattleRandom} from './battleEntropy.mjs';
import {loadCombatAdapter} from './battlePreview.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rollback=async(client,result)=>{await client.query('ROLLBACK');return result;};

export async function quoteSealedBattleRewards(pool,{
  accountId,encounterId,entropyKey
}){
  if(typeof accountId!=='string'||!UUID.test(accountId)||
     typeof encounterId!=='string'||!UUID.test(encounterId)||
     !Buffer.isBuffer(entropyKey)||entropyKey.length<32)
    return {status:'invalid'};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const rows=await client.query(
      `SELECT status,region_id,species_id,pokemon_level,battle_snapshot,
              battle_preview,battle_sealed_outcome,battle_reward_quote
         FROM game_encounter_reservations
         WHERE account_id=$1 AND id=$2 FOR UPDATE`,[accountId,encounterId]);
    if(!rows.rowCount)return await rollback(client,{status:'missing'});
    const row=rows.rows[0];
    if(row.battle_reward_quote!==null)
      return await rollback(client,{status:'replay',quote:row.battle_reward_quote});
    if(row.status!=='reserved'||row.region_id!==1||
       !row.battle_sealed_outcome||!row.battle_snapshot||!row.battle_preview)
      return await rollback(client,{status:'unavailable'});
    const snap=row.battle_snapshot,preview=row.battle_preview;
    if(snap?.opponent?.speciesId!==Number(row.species_id)||
       snap?.opponent?.level!==Number(row.pokemon_level)||
       preview.outcome!==row.battle_sealed_outcome)
      return await rollback(client,{status:'invalid-state'});
    const {quoteFrozenBattleRewards}=await loadCombatAdapter();
    if(typeof quoteFrozenBattleRewards!=='function')
      throw new Error('Canonical battle reward quote adapter missing');
    const rng=createPrivateBattleRandom(entropyKey,{
      accountId,encounterId,phase:'wild-battle-affinity'
    });
    // Domain-separated HMAC roll independent of moves, capture and affinity.
    // No modulo bias: battleEntropy.integer(10000) uses rejection sampling.
    const dropRng=createPrivateBattleRandom(entropyKey,{
      accountId,encounterId,phase:'wild-battle-ball-drop'
    });
    const quote=quoteFrozenBattleRewards(snap,preview,rng.integer(4),
      dropRng.integer(10000));
    if(!quote||quote.outcome!==row.battle_sealed_outcome||
       !Number.isSafeInteger(quote.coins)||!Number.isSafeInteger(quote.trainerXp)||
       !Number.isSafeInteger(quote.pokemonXp)||!Number.isSafeInteger(quote.affinityDelta))
      return await rollback(client,{status:'invalid-state'});
    await client.query(
      `UPDATE game_encounter_reservations
         SET battle_reward_quote=$3::jsonb,battle_reward_quote_at=now()
         WHERE account_id=$1 AND id=$2`,
      [accountId,encounterId,JSON.stringify(quote)]);
    await client.query('COMMIT');
    return {status:'quoted',quote};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
