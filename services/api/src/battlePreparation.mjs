/** ONLINE-01C-10: freeze a minimal, SERVER-OWNED battle input.
 * Not a combat engine or HTTP endpoint. Never grant XP/coins/captures here.
 * A move roster is explicit only when persisted by the equip writer.
 * A later server game-core adapter must recompute stats/moves from trusted
 * catalogs and must not use client-supplied stats or moves.
 */
import {machineHttpEnabled} from './machineHttp.mjs';
import {loadCombatAdapter} from './battlePreview.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATS=['hp','attack','defense','specialAttack','specialDefense','speed'];
const manualStats=(value,maxPerStat=40)=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).some(k=>!STATS.includes(k)))return null;
  const out={};
  for(const stat of STATS){
    if(!Number.isSafeInteger(value[stat])||value[stat]<0||value[stat]>maxPerStat)
      return null;
    out[stat]=value[stat];
  }
  return out;
};
/** Pure preparation from the DB save and the already materialized encounter. */
export function buildBattleSnapshot(save,encounter,regionalPolicy,tmLoot=false){
  if(!save||save.schemaVersion!==2||
     !save.journal||typeof save.journal.raw!=='string'||
     !encounter||!Number.isInteger(encounter.regionId)||encounter.regionId<1||encounter.regionId>10||
     !Number.isSafeInteger(encounter.speciesId)||
     !Number.isSafeInteger(encounter.level)||
     encounter.level<2||encounter.level>100||
     (encounter.regionId===1?encounter.level>10:typeof regionalPolicy!=='function'))
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
  if(encounter.regionId!==1&&!regionalPolicy(encounter.regionId,trainerLevel,encounter.speciesId,encounter.level))
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
  const pokemonManual=manualStats(selected.manual,(selected.level-1)*2);
  if(!pokemonManual||STATS.reduce((n,s)=>n+pokemonManual[s],0)>
      (selected.level-1)*2)return null;
  const history=selected.evolutionHistory;
  const lessons=selected.machineLessons;
  const upgrades=selected.upgrades;
  if(upgrades!==undefined&&(!upgrades||typeof upgrades!=='object'||Array.isArray(upgrades)||Object.keys(upgrades).some(n=>! /^[a-z][a-z-]{1,63}$/.test(n)||!Number.isSafeInteger(upgrades[n])||upgrades[n]<1||upgrades[n]>10)))return null;
  const ranked=upgrades!==undefined&&Object.keys(upgrades).length>0;
  const equipped=selected.equippedMoveNames===undefined?(history!==undefined||lessons!==undefined||ranked?[selected.moveName]:undefined):selected.equippedMoveNames;
  if(equipped!==undefined&&
    (!Array.isArray(equipped)||equipped.length<1||equipped.length>4||
     equipped[0]!==selected.moveName||
     equipped.some(name=>typeof name!=='string'||
       !/^[a-z][a-z-]{1,63}$/.test(name))||
     new Set(equipped).size!==equipped.length))
    return null;
  if(raw.research!==undefined&&(!raw.research||typeof raw.research!=='object'||Array.isArray(raw.research)||!raw.research.points||typeof raw.research.points!=='object'||Array.isArray(raw.research.points)))return null;
  // Canonical move legality, HP/SP, types, and stats remain the engine's
  // responsibility. Snapshot freezes identities/levels only.
  return {
    version:equipped===undefined?1:2,regionId:encounter.regionId,
    ...(tmLoot?{tmLootVersion:1}:{}),
    ...(raw.research===undefined?{}:{masteryPoints:{...raw.research.points}}),opponent:{
      speciesId:encounter.speciesId,level:encounter.level
    },trainer:{level:trainerLevel,manual:trainerManual,
      equipped:raw.trainer.equipped,title:raw.trainer.title,
      wins:raw.wins,seen:raw.seen,badges:raw.badges,inventory:raw.inventory},
    activePokemon:{
      uid:selected.uid,speciesId:selected.pokemonId,
      level:selected.level,affinity:selected.affinity,
      manual:pokemonManual,moveName:selected.moveName,
      ...(equipped===undefined?{}:{moveNames:[...equipped]}),
      ...(history===undefined?{}:{evolutionHistory:history}),
      ...(lessons===undefined?{}:{machineLessons:lessons}),
      ...(ranked?{upgrades:{...upgrades}}:{})
    }
  };
}

/** Only server code supplies the canonical regional validator. */
export async function buildPersistedBattleSnapshot(save,encounter,tmLoot=machineHttpEnabled()){
  const core=await loadCombatAdapter();
  const snapshot=buildBattleSnapshot(save,encounter,core.serverRegionalOpponent,tmLoot);
  return snapshot&&core.canonicalFrozenCombatants(snapshot)?snapshot:null;
}
/** All account/encounter identifiers originate from the server session/DB. */
export async function prepareReservedBattle(pool,{accountId,encounterId,tmLoot=machineHttpEnabled()}){
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
    if(encounter.status!=='reserved'||
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
    const snapshot=await buildPersistedBattleSnapshot(save,{
      regionId:Number(encounter.region_id),
      speciesId:Number(encounter.species_id),
      level:Number(encounter.pokemon_level)
    },tmLoot);
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
