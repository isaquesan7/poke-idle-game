import {arenaActivityBlocks} from './arenaActivity.mjs';
/** ONLINE-01C-23B2A — PRIVATE Collection team composer.
 *
 * This writer only orders 1–3 owned Pokémon UIDs in the server save.
 * The first UID remains the SOLE fighter in regional battles. Gym sessions
 * later freeze exactly the same order already selected in Collection.
 * Never accept client raw save, Pokémon statistics, battle outcomes or prizes.
 * No HTTP endpoint, registration, or migration from /play.
 */
import {isDeepStrictEqual} from 'node:util';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION=/^[A-Za-z0-9_-]{12,100}$/;
const rollback=async(client,result)=>{await client.query('ROLLBACK');return result;};
const validUid=uid=>Number.isSafeInteger(uid)&&uid>0;

/** A user may submit ONLY ordered UIDs, already owned by their account.
 * The trusted accountId comes from verified server session context.
 * All writers use SELECT game_saves FOR UPDATE before any encounter lock.
 */
export async function setCollectionTeam(pool,{
  accountId,actionId,expectedRevision,teamUids
}){
  if(typeof accountId!=='string'||!UUID.test(accountId)||
     typeof actionId!=='string'||!ACTION.test(actionId)||
     !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
     !Array.isArray(teamUids)||teamUids.length<1||teamUids.length>3||
     teamUids.some(uid=>!validUid(uid))||
     new Set(teamUids).size!==teamUids.length)
    return {status:'invalid'};
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const saved=await client.query(
      'SELECT schema_version,revision,state FROM game_saves WHERE account_id=$1 FOR UPDATE',
      [accountId]);
    if(!saved.rowCount)return await rollback(client,{status:'missing-save'});

    // Replays are exact, durable and independent of stale revisions.
    const earlier=await client.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,actionId]);
    if(earlier.rowCount){
      if(earlier.rows[0].kind!=='collection-team-set')
        return await rollback(client,{status:'duplicate-action'});
      const rows=await client.query(
        `SELECT team_uids,save_revision
           FROM game_collection_team_receipts
          WHERE account_id=$1 AND action_id=$2`,
        [accountId,actionId]);
      const receipt=rows.rows[0];
      return await rollback(client,receipt&&
        Number(receipt.save_revision)===Number(earlier.rows[0].save_revision)&&
        isDeepStrictEqual(receipt.team_uids,teamUids)?
        {status:'replay',revision:Number(receipt.save_revision),
          teamUids:receipt.team_uids}:
        {status:'duplicate-action'});
    }
    const current=saved.rows[0],revision=Number(current.revision),save=current.state;
    if(!Number.isSafeInteger(revision)||revision!==expectedRevision)
      return await rollback(client,{status:'stale'});
    if(current.schema_version!==2||save?.schemaVersion!==2||
       save?.revision!==revision||save?.journal?.revision!==revision||
       typeof save?.journal?.raw!=='string')
      return await rollback(client,{status:'invalid-save'});

    // Never permit changing the leader during an unresolved encounter,
    // regional capture, expedition or a Gym battle already in progress.
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
       !Array.isArray(raw.roster)||raw.roster.length<1||
       !Array.isArray(raw.team)||raw.team.length<1||raw.team.length>3||
       !Number.isSafeInteger(raw.nextUid)||raw.nextUid<2||
       raw.team.some(uid=>!validUid(uid))||
       new Set(raw.team).size!==raw.team.length||
       !raw.roster.every(p=>p&&validUid(p.uid)&&p.uid<raw.nextUid)||
       new Set(raw.roster.map(p=>p.uid)).size!==raw.roster.length)
      return await rollback(client,{status:'invalid-save'});
    const owned=new Map(raw.roster.map(p=>[p.uid,p]));
    if(raw.team.some(uid=>!owned.has(uid)))
      return await rollback(client,{status:'invalid-save'});
    if(teamUids.some(uid=>!owned.has(uid)))
      return await rollback(client,{status:'missing-pokemon'});
    if(teamUids.some(uid=>{
      const p=owned.get(uid);
      return !Number.isSafeInteger(p.pokemonId)||p.pokemonId<1||
        p.pokemonId>151||!Number.isSafeInteger(p.level)||
        p.level<1||p.level>100;
    }))return await rollback(client,{status:'invalid-save'});
    if(raw.expedition!==null||
       (raw.gymSession!==undefined&&raw.gymSession!==null)||
       (raw.pendingBattle!==undefined&&raw.pendingBattle!==null)||
       raw.lastBattle?.captureStatus==='available')
      return await rollback(client,{status:'busy'});

    if(await arenaActivityBlocks(client,save.journal.raw))return await rollback(client,{status:'busy'});

    // The one—and only—gameplay modification: ordered Collection team.
    const nextRevision=revision+1;
    const nextRaw={...raw,team:[...teamUids]};
    const next={...save,revision:nextRevision,
      journal:{...save.journal,revision:nextRevision,
        raw:JSON.stringify(nextRaw)}};
    await client.query(
      'UPDATE game_saves SET state=$2::jsonb,revision=$3,updated_at=now() WHERE account_id=$1',
      [accountId,JSON.stringify(next),nextRevision]);
    await client.query(
      `INSERT INTO game_collection_team_receipts
        (account_id,action_id,team_uids,save_revision)
       VALUES($1,$2,$3::jsonb,$4)`,
      [accountId,actionId,JSON.stringify(teamUids),nextRevision]);
    await client.query(
      `INSERT INTO game_action_receipts
        (account_id,action_id,kind,save_revision)
       VALUES($1,$2,'collection-team-set',$3)`,
      [accountId,actionId,nextRevision]);
    await client.query('COMMIT');
    return {status:'set',revision:nextRevision,teamUids:[...teamUids]};
  }catch(error){
    await client.query('ROLLBACK');throw error;
  }finally{client.release();}
}
