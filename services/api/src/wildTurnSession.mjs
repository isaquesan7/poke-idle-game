/** ONLINE-01C-18: start a server-owned interactive battle, TURN ZERO ONLY.
 *
 * This deliberately does not execute any attack, AI action, damage, SP
 * consumption, payout or capture. Subsequent turns need a dedicated audited
 * writer and receipts. No public HTTP endpoint or client-provided combatants.
 */
import {isDeepStrictEqual} from 'node:util';
import {buildBattleSnapshot} from './battlePreparation.mjs';
import {loadCombatAdapter} from './battlePreview.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rollback=async(client,value)=>{await client.query('ROLLBACK');return value;};

export async function startReservedWildTurnSession(pool,{
  accountId,encounterId,expectedRevision
}){
  if(typeof accountId!=='string'||!UUID.test(accountId)||
     typeof encounterId!=='string'||!UUID.test(encounterId)||
     !Number.isSafeInteger(expectedRevision)||expectedRevision<0)
    return {status:'invalid'};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    // Global account-first lock ordering, same as reserve/seal/payout.
    const saved=await client.query(
      'SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saved.rowCount)return await rollback(client,{status:'missing-save'});
    const encounters=await client.query(
      `SELECT status,region_id,species_id,pokemon_level,
              battle_snapshot,battle_preview,battle_sealed_outcome,
              battle_reward_quote,battle_payout_action_id,
              battle_turn_state
         FROM game_encounter_reservations
        WHERE account_id=$1 AND id=$2 FOR UPDATE`,[accountId,encounterId]);
    if(!encounters.rowCount)return await rollback(client,{status:'missing'});
    const row=encounters.rows[0];
    // No new randomness on retries. Replays are stable, even if the caller
    // presents an outdated revision, because this operation is idempotent.
    if(row.battle_turn_state!==null)
      return await rollback(client,{status:'replay',turnState:row.battle_turn_state});
    const current=saved.rows[0],revision=Number(current.revision);
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    const save=current.state;
    if(current.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});
    if(row.status!=='reserved'||row.region_id!==1||
       row.species_id===null||row.pokemon_level===null||
       !row.battle_snapshot||row.battle_preview!==null||
       row.battle_sealed_outcome!==null||row.battle_reward_quote!==null||
       row.battle_payout_action_id!==null)
      return await rollback(client,{status:'unavailable'});
    // The prepared actor identities/manual stats must still match locked
    // saved account state. Do not silently start after a trainer/pet change.
    const fromSave=buildBattleSnapshot(save,{
      regionId:Number(row.region_id),speciesId:Number(row.species_id),
      level:Number(row.pokemon_level)
    });
    if(!fromSave||!isDeepStrictEqual(fromSave,row.battle_snapshot))
      return await rollback(client,{status:'stale-snapshot'});
    const core=await loadCombatAdapter();
    if(typeof core.createFrozenWildTurnSession!=='function'||
       typeof core.initialFrozenWildTurnActions!=='function')
      throw new Error('Canonical turn-zero adapter missing');
    const session=core.createFrozenWildTurnSession(row.battle_snapshot);
    const actions=core.initialFrozenWildTurnActions(row.battle_snapshot);
    if(!session||!Array.isArray(actions)||actions.length<2||
       session.turn!==0||session.phase!=='await-player'||
       session.player.hp<=0||session.wild.hp<=0)
      return await rollback(client,{status:'invalid-snapshot'});
    await client.query(
      `UPDATE game_encounter_reservations
          SET battle_turn_state=$3::jsonb,battle_turn_started_at=now()
        WHERE account_id=$1 AND id=$2`,
      [accountId,encounterId,JSON.stringify(session)]);
    await client.query('COMMIT');
    return {status:'started',turnState:session,actions};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
