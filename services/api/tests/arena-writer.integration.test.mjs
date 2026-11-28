import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {firstSave} from '../src/initialAdventure.mjs';
import {writeArenaAction} from '../src/arenaWriter.mjs';
import {setCollectionTeam} from '../src/collectionTeam.mjs';
import {reserveEncounter} from '../src/encounterReservation.mjs';
import {reserveNextGym} from '../src/gymReservation.mjs';
import {applyExpeditionCommand} from '../src/expeditionWriter.mjs';
import {trainPokemon} from '../src/pokemonTrainingWriter.mjs';
import {applyTrainerInvestment} from '../src/trainerInvestment.mjs';
import {readArena} from '../src/arenaHttp.mjs';
test('Arena private PostgreSQL writer: frozen trio, real duel, receipt and single first-clear reward',async()=>{
 const db=new URL(process.env.DATABASE_URL);
 assert.equal(db.protocol,'postgresql:');assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'55432');
 assert.equal(db.pathname,'/kanto_ci');assert.equal(db.username,'kanto_ci');assert.equal(db.search,'');
 const pool=new pg.Pool({connectionString:db.href});let accountId;
 try{
  accountId=(await pool.query("INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id",['arena-'+randomUUID()+'@example.test','x'.repeat(48)])).rows[0].id;
  const save=firstSave('Arena CI',4,1740000000000),raw=JSON.parse(save.journal.raw);
  raw.roster=Array.from({length:4},(_,i)=>({...structuredClone(raw.roster[0]),uid:i+1,pokemonId:6,level:100,moveName:'ember'}));
  raw.team=[1,2,3];raw.nextUid=5;raw.seen=[4,5,6];raw.caughtSpecies=[4,5,6];
  save.journal.raw=JSON.stringify(raw);
  await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[accountId,JSON.stringify(save)]);
  const read=async()=>{const row=(await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId])).rows[0];return {revision:Number(row.revision),raw:JSON.parse(row.state.journal.raw)};};
  const request=(command,expectedRevision,actionId=randomUUID())=>({accountId,command,expectedRevision,actionId,...(command.type==='challenge'?{entropyKey:Buffer.alloc(32,0x5a)}:{})});
  const apply=(command,rev)=>writeArenaAction(pool,request(command,rev));
  assert.equal((await apply({type:'start',team:[1,2,4]},0)).status,'invalid');
  const start=await apply({type:'start'},0);
  assert.equal(start.status,'applied');assert.equal(start.revision,1);
  const {weekStartMs,run}=start.result.progress;
  assert.deepEqual(run.team,[1,2,3]);assert.equal(run.cleared,0);
  assert.equal((await setCollectionTeam(pool,{accountId,actionId:randomUUID(),expectedRevision:1,teamUids:[1,2,4]})).status,'busy');
  const base=()=>({accountId,actionId:randomUUID(),expectedRevision:1});
  for(const action of [
   reserveEncounter(pool,{...base(),regionId:1}),
   reserveNextGym(pool,base()),
   applyExpeditionCommand(pool,{...base(),kind:'start',regionId:1}),
   trainPokemon(pool,{...base(),pokemonUid:2,increments:{attack:1}}),
   applyTrainerInvestment(pool,{...base(),stat:'attack'})
  ])assert.equal((await action).status,'busy');
  const view=await readArena(pool,accountId);
  assert.equal(view.status,'ok');assert.equal(view.opponents.length,40);
  assert.deepEqual(view.team.map(p=>p.uid),[1,2,3]);
  for(const p of view.opponents)for(const k of ['stats','ranks','moves','seed'])assert.equal(Object.hasOwn(p,k),false);
  assert.equal((await read()).revision,1);
  const command={type:'challenge',weekStartMs,runId:run.id,floor:1,uid:2};
  assert.equal((await apply({...command,outcome:'win'},1)).status,'invalid');
  assert.equal((await apply({...command,uid:4},1)).status,'outside-team');
  assert.equal((await apply({...command,floor:2},1)).status,'locked-floor');
  const same=request(command,1);
  const race=await Promise.all([writeArenaAction(pool,same),writeArenaAction(pool,same)]);
  assert.deepEqual(race.map(x=>x.status).sort(),['applied','replay']);
  assert.deepEqual(race[0].result,race[1].result);
  assert.equal(race[0].result.duel.outcome,'win');
  assert.equal(race[0].result.duel.player.uid,2);
  assert.equal(race[0].result.points,1);
  assert.equal(race[0].result.balance,1);
  assert.equal(race[0].result.duel.log.length,race[0].result.duel.frames.length);
  assert.deepEqual(race[0].result.reward,{coins:0,trainerXp:0,pokemonXp:0});
  assert.equal((await read()).revision,2);
  assert.equal((await apply(command,2)).status,'locked-floor');
  assert.equal((await apply({type:'abandon',runId:run.id},2)).status,'applied');
  const start2=await apply({type:'start'},3);assert.equal(start2.status,'applied');
  const replayFloor=await apply({...command,runId:start2.result.progress.run.id,uid:3},4);
  assert.equal(replayFloor.status,'applied');assert.equal(replayFloor.result.duel.outcome,'win');
  assert.equal(replayFloor.result.points,0);assert.equal(replayFloor.result.balance,1);
  const final=await read();
  assert.equal(final.revision,5);assert.equal(final.raw.weeklyArena.progress.paidThrough,1);
  for(const k of ['coins','wins','losses','trainer','roster','badges','inventory','ballPocket'])assert.deepEqual(final.raw[k],raw[k]);
  assert.equal((await writeArenaAction(pool,same)).status,'duplicate');
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM game_action_receipts WHERE account_id=$1 AND kind LIKE 'arena-%'",[accountId])).rows[0].n),5);
  // Fund only this disposable fixture; actual point earnings were proved above.
  const funded=(await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[accountId])).rows[0].state;
  const fundedRaw=JSON.parse(funded.journal.raw);fundedRaw.weeklyArena.balance=200;fundedRaw.weeklyArena.progress.run=null;
  funded.journal.raw=JSON.stringify(fundedRaw);
  await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[accountId,JSON.stringify(funded)]);
  const purchase=request({type:'purchase',offerId:'tm26'},5);
  assert.equal((await writeArenaAction(pool,{...purchase,command:{...purchase.command,cost:1}})).status,'invalid');
  const bought=await Promise.all([writeArenaAction(pool,purchase),writeArenaAction(pool,purchase)]);
  assert.deepEqual(bought.map(x=>x.status).sort(),['applied','replay']);
  assert.deepEqual(bought[0].result,bought[1].result);
  const boughtState=await read();
  assert.equal(boughtState.revision,6);assert.equal(boughtState.raw.weeklyArena.balance,100);
  assert.equal(boughtState.raw.machineStock.tm26,1);
  assert.equal(boughtState.raw.coins,raw.coins);
  assert.equal((await apply({type:'purchase',offerId:'tm26'},6)).status,'weekly-limit');
 }finally{if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);await pool.end();}
});
