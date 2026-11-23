/** ONLINE-01C-12: private canonical battle preview, with atomic replay.
 * Server-only. A preview is NOT a resolved encounter and grants NOTHING.
 * No client-supplied seeds, species, snapshots or combatants accepted.
 */
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createPrivateBattleRandom} from './battleEntropy.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let adapterPromise;
function loadCombatAdapter(){
  // Explicit path override only in tests/build verification, never in Railway.
  const path=process.env.NODE_ENV==='test'&&process.env.CORE_BUNDLE_PATH
    ?resolve(process.env.CORE_BUNDLE_PATH)
    :new URL('../game-core/frozenBattle.mjs',import.meta.url);
  adapterPromise??=import(typeof path==='string'?pathToFileURL(path).href:path.href);
  return adapterPromise;
}
const rollback=async(client,value)=>{await client.query('ROLLBACK');return value;};

/** Serialized by encounter row lock; persistent result is returned on retries. */
export async function previewReservedBattle(pool,{accountId,encounterId,entropyKey}){
  if(typeof accountId!=='string'||!UUID.test(accountId)||
     typeof encounterId!=='string'||!UUID.test(encounterId)||
     !Buffer.isBuffer(entropyKey)||entropyKey.length<32)
    return {status:'invalid'};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const rows=await client.query(
      `SELECT status,region_id,species_id,pokemon_level,
              battle_snapshot,battle_preview
         FROM game_encounter_reservations
        WHERE account_id=$1 AND id=$2 FOR UPDATE`,
      [accountId,encounterId]);
    if(!rows.rowCount)return await rollback(client,{status:'missing'});
    const encounter=rows.rows[0];
    if(encounter.battle_preview!==null)
      return await rollback(client,{status:'replay',preview:encounter.battle_preview});
    if(encounter.status!=='reserved'||encounter.region_id!==1||
       encounter.species_id===null||encounter.pokemon_level===null||
       !encounter.battle_snapshot)
      return await rollback(client,{status:'unavailable'});
    const snap=encounter.battle_snapshot;
    // No action on malformed/tampered snapshots, including mismatch of
    // opponent to materialized identity. Complete legality is core-owned.
    if(snap?.version!==1||snap?.regionId!==1||
       snap?.opponent?.speciesId!==Number(encounter.species_id)||
       snap?.opponent?.level!==Number(encounter.pokemon_level))
      return await rollback(client,{status:'invalid-snapshot'});
    const adapter=await loadCombatAdapter();
    if(typeof adapter.previewFrozenWildBattle!=='function')
      throw new Error('Canonical battle adapter missing from API bundle');
    const seed=createPrivateBattleRandom(entropyKey,{
      accountId,encounterId,phase:'wild-battle'
    }).integer(2**32);
    const preview=adapter.previewFrozenWildBattle(snap,seed);
    if(!preview||!Array.isArray(preview.log)||!Array.isArray(preview.frames)||
       preview.log.length!==preview.frames.length||
       !['win','loss','draw'].includes(preview.outcome)||
       Object.hasOwn(preview,'captured')||Object.hasOwn(preview,'affinityGain'))
      return await rollback(client,{status:'invalid-snapshot'});
    await client.query(
      `UPDATE game_encounter_reservations
          SET battle_preview=$3::jsonb,battle_preview_at=now()
        WHERE account_id=$1 AND id=$2`,
      [accountId,encounterId,JSON.stringify(preview)]);
    await client.query('COMMIT');
    return {status:'previewed',preview};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
