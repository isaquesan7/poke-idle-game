/** ONLINE-01C-9: INTERNAL first-region encounter materialization.
 * The server owns the accountId/encounterId and entropy key; the client
 * cannot choose or refresh the species. A SQL row lock and persisted outcome
 * make retries and concurrent worker attempts return the SAME encounter.
 *
 * Region-1 roster/limits mirrored from the authoritative game-core map.
 * tests/encounterMaterialization.test.mjs checks parity against the source.
 * Expansion to other regions must reuse policy from game-core, not copy pools.
 */
import {createPrivateBattleRandom,BATTLE_ENTROPY_VERSION} from './battleEntropy.mjs';
export const FIRST_REGION_SPECIES=Object.freeze([
  10,13,16,54,21,29,32,43,46,48,60,69,1,4,7
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function materializeReservedEncounter(pool,{
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
      `SELECT region_id,status,species_id,pokemon_level,entropy_version
         FROM game_encounter_reservations WHERE account_id=$1 AND id=$2 FOR UPDATE`,
      [accountId,encounterId]);
    if(!rows.rowCount){await client.query('ROLLBACK');return {status:'missing'};}
    const row=rows.rows[0];
    if(row.species_id!==null){
      await client.query('ROLLBACK');
      return {status:'replay',speciesId:Number(row.species_id),
        level:Number(row.pokemon_level),entropyVersion:row.entropy_version};
    }
    if(row.status!=='reserved'||row.region_id!==1){
      await client.query('ROLLBACK');return {status:'unavailable'};
    }
    const saves=await client.query(
      'SELECT state,schema_version FROM game_saves WHERE account_id=$1',
      [accountId]);
    const state=saves.rows[0]?.state;
    let raw;
    try{raw=JSON.parse(state?.journal?.raw);}catch{}
    const level=raw?.trainer?.level;
    if(saves.rowCount!==1||saves.rows[0].schema_version!==2||
       state?.schemaVersion!==2||!Number.isSafeInteger(level)||
       level<1||level>100||raw?.version!==1||
       !Array.isArray(raw.roster)||!raw.roster.length){
      await client.query('ROLLBACK');return {status:'invalid-save'};
    }
    // Match current core regional weighting for R1 (all species common,
    // identical weight 1). Level formula is bounded by R1 level 2..10.
    const rng=createPrivateBattleRandom(entropyKey,{
      accountId,encounterId,phase:'wild-encounter'
    });
    const speciesId=FIRST_REGION_SPECIES[rng.integer(FIRST_REGION_SPECIES.length)];
    const pokemonLevel=Math.max(2,Math.min(10,level+rng.integer(5)-2));
    await client.query(
      `UPDATE game_encounter_reservations
         SET species_id=$3,pokemon_level=$4,entropy_version=$5,materialized_at=now()
         WHERE account_id=$1 AND id=$2`,
      [accountId,encounterId,speciesId,pokemonLevel,BATTLE_ENTROPY_VERSION]);
    await client.query('COMMIT');
    return {status:'materialized',speciesId,level:pokemonLevel,
      entropyVersion:BATTLE_ENTROPY_VERSION};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
