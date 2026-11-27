import {arenaActivityBlocks} from './arenaActivity.mjs';
/** ONLINE-01C-23A: private loadout writer for 1–4 explicitly equipped moves.
 * Cannot equip during any pending encounter, not even prior to turn-zero.
 * Learned moves, legal level, status/SP policies come from bundled game-core.
 * All modifications are server-originated, serialized, and idempotent.
 * INTERNAL ONLY: no HTTP, client supplied raw save, XP or manual stats.
 */
import {isDeepStrictEqual} from 'node:util';
import {loadCombatAdapter} from './battlePreview.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const MOVE=/^[a-z][a-z-]{1,63}$/;
const rollback=async(client,result)=>{await client.query('ROLLBACK');return result;};

/** User can choose move NAMES, never define type/damage/SP/stats.
 * Trusted account identity and action revision must come from the API layer.
 */
export async function equipPokemonMoves(pool,{
  accountId,actionId,expectedRevision,pokemonUid,moveNames
}){
  if(typeof accountId!=='string'||!UUID.test(accountId)||
     typeof actionId!=='string'||!ACTION.test(actionId)||
     !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
     !Number.isSafeInteger(pokemonUid)||pokemonUid<1||
     !Array.isArray(moveNames)||moveNames.length<1||moveNames.length>4||
     !moveNames.every(name=>typeof name==='string'&&MOVE.test(name))||
     new Set(moveNames).size!==moveNames.length)
    return {status:'invalid'};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    // All account writers lock the save first, serializing these transitions.
    const saved=await client.query(
      'SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saved.rowCount)return await rollback(client,{status:'missing-save'});
    const prior=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(prior.rowCount){
      if(prior.rows[0].kind!=='pokemon-moves-equip')
        return await rollback(client,{status:'duplicate-action'});
      const record=await client.query(
        `SELECT pokemon_uid,move_names,save_revision
           FROM game_pokemon_move_equip_receipts
          WHERE account_id=$1 AND action_id=$2`,[accountId,actionId]);
      const row=record.rows[0];
      return await rollback(client,row&&
        Number(row.pokemon_uid)===pokemonUid&&
        isDeepStrictEqual(row.move_names,moveNames)&&
        Number(row.save_revision)===Number(prior.rows[0].save_revision)?
        {status:'replay',revision:Number(row.save_revision),pokemonUid,
          moveNames:row.move_names}:
        {status:'duplicate-action'});
    }
    const current=saved.rows[0],revision=Number(current.revision),save=current.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(current.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});
    // Do not allow a loadout modification while a battle is reserved,
    // prepared, active, paid, or waiting for capture/skip.
    const busy=await client.query(
      "SELECT id FROM game_encounter_reservations WHERE account_id=$1 AND status='reserved'",
      [accountId]);
    if(busy.rowCount)return await rollback(client,{status:'busy'});
    const gymBusy=await client.query(
      "SELECT id FROM game_gym_reservations WHERE account_id=$1 AND status='reserved'",
      [accountId]);
    if(gymBusy.rowCount)return await rollback(client,{status:'busy'});
    let raw;
    try{raw=JSON.parse(save.journal.raw);}catch{
      return await rollback(client,{status:'invalid-save'});
    }
    if(!raw||raw.version!==1||raw.mode!=='normal'||
       !Array.isArray(raw.roster)||!Array.isArray(raw.team)||
       !Number.isSafeInteger(raw.nextUid)||raw.nextUid<2||
       raw.team.some(uid=>!Number.isSafeInteger(uid)||uid<1)||
       new Set(raw.roster.map(p=>p?.uid)).size!==raw.roster.length)
      return await rollback(client,{status:'invalid-save'});
    if(raw.expedition!==null||raw.pendingBattle!=null||raw.gymSession!=null||raw.lastBattle?.captureStatus==='available')return await rollback(client,{status:'busy'});
    if(await arenaActivityBlocks(client,save.journal.raw))return await rollback(client,{status:'busy'});
    const index=raw.roster.findIndex(p=>p?.uid===pokemonUid);
    if(index<0)return await rollback(client,{status:'missing-pokemon'});
    const pokemon=raw.roster[index];
    if(!Number.isSafeInteger(pokemon.pokemonId)||pokemon.pokemonId<1||
       pokemon.pokemonId>151||
       !Number.isSafeInteger(pokemon.level)||pokemon.level<1||
       pokemon.level>100||pokemonUid>=raw.nextUid||
       typeof pokemon.moveName!=='string')
      return await rollback(client,{status:'invalid-save'});
    const core=await loadCombatAdapter();
    if(typeof core.frozenValidatedEquippedMoves!=='function')
      throw new Error('Canonical FRLG loadout validator missing in private bundle');
    const legal=core.frozenValidatedEquippedMoves(
      pokemon.pokemonId,pokemon.level,moveNames,pokemon.evolutionHistory,pokemon.machineLessons);
    if(!legal||legal.length!==moveNames.length||
       legal.some((move,i)=>move.name!==moveNames[i])||
       !legal.some(move=>move.category!=='status'))
      return await rollback(client,{status:'illegal-moves'});
    // Preserve UID, level, XP, stats, trainer, team, drops, economy etc.
    raw.roster[index]={...pokemon,moveName:moveNames[0],
      equippedMoveNames:[...moveNames]};
    const nextRevision=revision+1;
    const next={...save,revision:nextRevision,
      journal:{...save.journal,raw:JSON.stringify(raw),revision:nextRevision}};
    await client.query(
      'UPDATE game_saves SET revision=$3,state=$2::jsonb,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(next),nextRevision]);
    await client.query(
      `INSERT INTO game_pokemon_move_equip_receipts
        (account_id,action_id,pokemon_uid,move_names,save_revision)
       VALUES($1,$2,$3,$4::jsonb,$5)`,
      [accountId,actionId,pokemonUid,JSON.stringify(moveNames),nextRevision]);
    await client.query(
      `INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision)
       VALUES($1,$2,'pokemon-moves-equip',$3)`,
      [accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'equipped',revision:nextRevision,pokemonUid,
      moveNames:[...moveNames]};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
