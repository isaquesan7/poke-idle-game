/** ONLINE-01C-10: freeze a minimal, SERVER-OWNED battle input.
 * Not a combat engine or HTTP endpoint. Never grant XP/coins/captures here.
 * A move roster is explicit only when persisted by the equip writer.
 * A later server game-core adapter must recompute stats/moves from trusted
 * catalogs and must not use client-supplied stats or moves.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATS=['hp','attack','defense','specialAttack','specialDefense','speed'];
const manualStats=value=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).some(k=>!STATS.includes(k)))return null;
  const out={};
  for(const stat of STATS){
    if(!Number.isSafeInteger(value[stat])||value[stat]<0||value[stat]>40)
      return null;
    out[stat]=value[stat];
  }
  return out;
};
/** Pure preparation from the DB save and the already materialized encounter. */
export function buildBattleSnapshot(save,encounter){
  if(!save||save.schemaVersion!==2||
     !save.journal||typeof save.journal.raw!=='string'||
     !encounter||encounter.regionId!==1||
     !Number.isSafeInteger(encounter.speciesId)||
     !Number.isSafeInteger(encounter.level)||
     encounter.level<2||encounter.level>10)
    return null;
  let raw;
  try{raw=JSON.parse(save.journal.raw);}catch{return null;}
  if(raw?.version!==1||raw?.mode!=='normal'||
     !raw.trainer||!Array.isArray(raw.roster)||
     !Array.isArray(raw.team)||raw.team.length<1||raw.team.length>3)
    return null;
  const trainerLevel=raw.trainer.level;
  const trainerManual=manualStats(raw.trainer.manual);
  if(!Number.isSafeInteger(trainerLevel)||trainerLevel<1||trainerLevel>100||
     !trainerManual||
     STATS.reduce((n,s)=>n+trainerManual[s],0)>(trainerLevel-1)*2)
    return null;
  const selected=raw.roster.find(p=>p?.uid===raw.team[0]);
  if(!selected||!Number.isSafeInteger(selected.uid)||selected.uid<1||
     !Number.isSafeInteger(selected.pokemonId)||selected.pokemonId<1||
     selected.pokemonId>151||
     !Number.isSafeInteger(selected.level)||selected.level<1||
     selected.level>100||!Number.isSafeInteger(selected.affinity)||
     selected.affinity<0||selected.affinity>100||
     !/^[a-z][a-z-]{1,63}$/.test(selected.moveName??''))
    return null;
  const pokemonManual=manualStats(selected.manual);
  if(!pokemonManual||STATS.reduce((n,s)=>n+pokemonManual[s],0)>
      (selected.level-1)*2)return null;
  const equipped=selected.equippedMoveNames;
  if(equipped!==undefined&&
    (!Array.isArray(equipped)||equipped.length<1||equipped.length>4||
     equipped[0]!==selected.moveName||
     equipped.some(name=>typeof name!=='string'||
       !/^[a-z][a-z-]{1,63}$/.test(name))||
     new Set(equipped).size!==equipped.length))
    return null;
  // Version 3 freezes every REAL member of the selected team, in order.
  // Do not silently promote a fainted bench Pokémon or auto-equip moves.
  if(raw.team.length>1){
    if(new Set(raw.team).size!==raw.team.length||
       new Set(raw.roster.map(p=>p?.uid)).size!==raw.roster.length)
      return null;
    const party=[];
    for(const uid of raw.team){
      const p=raw.roster.find(entry=>entry?.uid===uid);
      if(!p||!Number.isSafeInteger(p.uid)||p.uid<1||
         !Number.isSafeInteger(p.pokemonId)||p.pokemonId<1||p.pokemonId>151||
         !Number.isSafeInteger(p.level)||p.level<1||p.level>100||
         !Number.isSafeInteger(p.affinity)||p.affinity<0||p.affinity>100||
         !/^[a-z][a-z-]{1,63}$/.test(p.moveName??''))
        return null;
      const manual=manualStats(p.manual);
      if(!manual||STATS.reduce((n,stat)=>n+manual[stat],0)>(p.level-1)*2)
        return null;
      const names=p.equippedMoveNames===undefined?[p.moveName]:p.equippedMoveNames;
      if(!Array.isArray(names)||names.length<1||names.length>4||
         names[0]!==p.moveName||
         names.some(name=>typeof name!=='string'||
           !/^[a-z][a-z-]{1,63}$/.test(name))||
         new Set(names).size!==names.length)
        return null;
      party.push({uid:p.uid,speciesId:p.pokemonId,level:p.level,
        affinity:p.affinity,manual,moveName:p.moveName,moveNames:[...names]});
    }
    return {
      version:3,regionId:1,
      opponent:{speciesId:encounter.speciesId,level:encounter.level},
      trainer:{level:trainerLevel,manual:trainerManual},
      activePokemon:party[0],party
    };
  }
  // Canonical move legality, HP/SP, types, and stats remain the engine's
  // responsibility. Snapshot freezes identities/levels only.
  return {
    version:equipped===undefined?1:2,regionId:1,opponent:{
      speciesId:encounter.speciesId,level:encounter.level
    },trainer:{level:trainerLevel,manual:trainerManual},
    activePokemon:{
      uid:selected.uid,speciesId:selected.pokemonId,
      level:selected.level,affinity:selected.affinity,
      manual:pokemonManual,moveName:selected.moveName,
      ...(equipped===undefined?{}:{moveNames:[...equipped]})
    }
  };
}

/** All account/encounter identifiers originate from the server session/DB. */
export async function prepareReservedBattle(pool,{accountId,encounterId}){
  if(typeof accountId!=='string'||!UUID.test(accountId)||
     typeof encounterId!=='string'||!UUID.test(encounterId))
    return {status:'invalid'};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const rows=await client.query(
      `SELECT region_id,status,species_id,pokemon_level,battle_snapshot
         FROM game_encounter_reservations
        WHERE id=$1 AND account_id=$2 FOR UPDATE`,
      [encounterId,accountId]);
    if(!rows.rowCount){
      await client.query('ROLLBACK');return {status:'missing'};
    }
    const encounter=rows.rows[0];
    if(encounter.battle_snapshot!==null){
      await client.query('ROLLBACK');
      return {status:'replay',snapshot:encounter.battle_snapshot};
    }
    if(encounter.status!=='reserved'||encounter.region_id!==1||
       encounter.species_id===null||encounter.pokemon_level===null){
      await client.query('ROLLBACK');return {status:'unavailable'};
    }
    const saves=await client.query(
      'SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1',
      [accountId]);
    const row=saves.rows[0];
    const save=row?.state;
    if(row?.schema_version!==2||!Number.isSafeInteger(Number(row.revision))||
       save?.revision!==Number(row.revision)||
       save?.journal?.revision!==Number(row.revision)){
      await client.query('ROLLBACK');return {status:'invalid-save'};
    }
    const snapshot=buildBattleSnapshot(save,{
      regionId:Number(encounter.region_id),
      speciesId:Number(encounter.species_id),
      level:Number(encounter.pokemon_level)
    });
    if(!snapshot){
      await client.query('ROLLBACK');return {status:'invalid-save'};
    }
    await client.query(
      `UPDATE game_encounter_reservations
          SET battle_snapshot=$3::jsonb,battle_prepared_at=now()
        WHERE id=$1 AND account_id=$2`,
      [encounterId,accountId,JSON.stringify(snapshot)]);
    await client.query('COMMIT');
    return {status:'prepared',snapshot};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
