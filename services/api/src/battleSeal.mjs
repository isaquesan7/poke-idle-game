/** ONLINE-01C-13. INTERNAL seal-only transaction; no HTTP endpoint.
 * Refuses to release the sole reserved encounter and NEVER mutates raw game
 * progress, rewards, inventories, Pokémon HP/SP or trainer stats. A separate
 * audited settlement will later consume the sealed outcome.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const cancel=async(client,value)=>{await client.query('ROLLBACK');return value;};

export async function sealReservedBattle(pool,{
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
    // Same global account lock order as reserveEncounter and investTrainerPoint.
    const saves=await client.query(
      'SELECT revision,schema_version,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saves.rowCount)return await cancel(client,{status:'missing-save'});
    const receipts=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(receipts.rowCount&&receipts.rows[0].kind!=='battle-seal')
      return await cancel(client,{status:'duplicate-action'});
    const records=await client.query(
      `SELECT status,region_id,species_id,pokemon_level,battle_snapshot,
              battle_preview,battle_sealed_outcome,battle_seal_action_id,
              battle_seal_revision
         FROM game_encounter_reservations
        WHERE id=$1 AND account_id=$2 FOR UPDATE`,
      [encounterId,accountId]);
    if(!records.rowCount)return await cancel(client,{status:'missing'});
    const encounter=records.rows[0];
    if(encounter.battle_sealed_outcome!==null){
      const same=encounter.battle_seal_action_id===actionId&&
        receipts.rowCount===1;
      return await cancel(client,same?
        {status:'replay',outcome:encounter.battle_sealed_outcome,
         revision:Number(encounter.battle_seal_revision)}:
        {status:'already-sealed'});
    }
    if(receipts.rowCount)return await cancel(client,{status:'duplicate-action'});
    const current=saves.rows[0],revision=Number(current.revision);
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await cancel(client,{status:'stale'});
    const save=current.state;
    if(current.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save.journal.raw!=='string')
      return await cancel(client,{status:'invalid-save'});
    // Do not accept any result, species, stats, seed or log from the caller.
    if(encounter.status!=='reserved'||encounter.region_id!==1||
       encounter.species_id===null||encounter.pokemon_level===null||
       !encounter.battle_snapshot||!encounter.battle_preview)
      return await cancel(client,{status:'unavailable'});
    const result=encounter.battle_preview,snap=encounter.battle_snapshot;
    if(!['win','loss','draw'].includes(result.outcome)||
       !Number.isSafeInteger(result.turns)||result.turns<1||result.turns>30||
       !Array.isArray(result.log)||!Array.isArray(result.frames)||
       result.log.length!==result.frames.length||
       snap?.opponent?.speciesId!==Number(encounter.species_id)||
       snap?.opponent?.level!==Number(encounter.pokemon_level))
      return await cancel(client,{status:'invalid-preview'});
    const nextRevision=revision+1;
    await client.query(
      `UPDATE game_encounter_reservations
         SET battle_sealed_outcome=$3,battle_seal_action_id=$4,
             battle_seal_revision=$5,battle_sealed_at=now()
        WHERE account_id=$1 AND id=$2`,
      [accountId,encounterId,result.outcome,actionId,nextRevision]);
    // Revision only: game state and rewards are bit-for-bit unchanged.
    const next={...save,revision:nextRevision,
      journal:{...save.journal,revision:nextRevision}};
    await client.query(
      'UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(next),nextRevision]);
    await client.query(
      `INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision)
       VALUES($1,$2,'battle-seal',$3)`,[accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'sealed',outcome:result.outcome,revision:nextRevision};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
