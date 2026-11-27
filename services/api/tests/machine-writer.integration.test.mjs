import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {firstSave} from '../src/initialAdventure.mjs';
import {teachPokemonMachine} from '../src/machineWriter.mjs';
import {readMachines} from '../src/machineHttp.mjs';
import {equipPokemonMoves} from '../src/pokemonMoveEquipment.mjs';
import {upgradePokemonMove} from '../src/pokemonMoveRankWriter.mjs';
import {loadCombatAdapter} from '../src/battlePreview.mjs';
test('TM teaching: atomic stock, compatible UID, permanent lesson, concurrency and equip/rank',async()=>{
 const db=new URL(process.env.DATABASE_URL);
 assert.equal(db.protocol,'postgresql:');assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'55432');
 assert.equal(db.pathname,'/kanto_ci');assert.equal(db.username,'kanto_ci');assert.equal(db.search,'');
 const pool=new pg.Pool({connectionString:db.href});let id;
 try{
  id=(await pool.query("INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id",['tm-'+randomUUID()+'@example.test','x'.repeat(48)])).rows[0].id;
  const save=firstSave('TM CI',4,1740000000000),raw=JSON.parse(save.journal.raw);
  raw.roster[0].level=10;
  raw.roster.push({...structuredClone(raw.roster[0]),uid:2,pokemonId:7,moveName:'tackle'});
  raw.nextUid=3;raw.machineStock={tm35:2,tm24:1};
  save.journal.raw=JSON.stringify(raw);
  await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[id,JSON.stringify(save)]);
  const teach=(command,expectedRevision,actionId=randomUUID())=>teachPokemonMachine(pool,{accountId:id,actionId,expectedRevision,command});
  const read=async()=>{const row=(await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',[id])).rows[0];return {revision:Number(row.revision),raw:JSON.parse(row.state.journal.raw)};};
  const initial=await readMachines(pool,id);
  assert.equal(initial.status,'ok');assert.equal(initial.machines.length,50);
  assert.equal(initial.pokemon[0].compatible.find(x=>x.tmId==='tm35').canTeach,true);
  assert.equal(initial.pokemon[1].compatible.some(x=>x.tmId==='tm35'),false);
  assert.equal((await teach({uid:2,tmId:'tm35'},0)).status,'incompatible');
  assert.equal((await teach({uid:1,tmId:'tm35',quantity:0},0)).status,'invalid');
  assert.equal((await teach({uid:99,tmId:'tm35'},0)).status,'missing-pokemon');
  assert.deepEqual((await read()).raw,raw);
  const action=randomUUID();
  const outcomes=await Promise.all([teach({uid:1,tmId:'tm35'},0,action),teach({uid:1,tmId:'tm35'},0,action)]);
  assert.deepEqual(outcomes.map(x=>x.status).sort(),['applied','duplicate']);
  const after=await read();
  assert.equal(after.revision,1);assert.equal(after.raw.machineStock.tm35,1);
  assert.deepEqual(after.raw.roster[0].machineLessons,[{tmId:'tm35',speciesId:4}]);
  assert.equal(after.raw.roster[0].moveName,'scratch');
  assert.deepEqual(after.raw.roster[1],raw.roster[1]);
  assert.equal((await teach({uid:1,tmId:'tm35'},0)).status,'stale');
  assert.equal((await teach({uid:1,tmId:'tm35'},1)).status,'already-learned');
  const view=await readMachines(pool,id);
  assert.equal(view.pokemon[0].compatible.find(x=>x.tmId==='tm35').origin,'tm');
  assert.equal(view.pokemon[0].compatible.find(x=>x.tmId==='tm35').canTeach,false);
  const core=await loadCombatAdapter();
  assert.ok(core.onlineMoveProjection(JSON.stringify(after.raw)).pokemon[0].learned.some(x=>x.name==='flamethrower'));
  const equip=await equipPokemonMoves(pool,{accountId:id,actionId:randomUUID(),expectedRevision:1,pokemonUid:1,moveNames:['flamethrower']});
  assert.equal(equip.status,'equipped');
  const rank=await upgradePokemonMove(pool,{accountId:id,actionId:randomUUID(),expectedRevision:2,pokemonUid:1,moveName:'flamethrower'});
  assert.equal(rank.status,'upgraded');
  const final=await read();assert.equal(final.revision,3);assert.equal(final.raw.machineStock.tm35,1);
  assert.equal(final.raw.roster[0].upgrades.flamethrower,1);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM game_action_receipts WHERE account_id=$1 AND kind='pokemon-tm-teach'",[id])).rows[0].n),1);
 }finally{if(id)await pool.query('DELETE FROM game_accounts WHERE id=$1',[id]);await pool.end();}
});

test('TM regional loot: certified overlevel win credits stock exactly once and survives finalization',async()=>{
 const db=new URL(process.env.DATABASE_URL);
 assert.equal(db.protocol,'postgresql:');assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'55432');
 assert.equal(db.pathname,'/kanto_ci');assert.equal(db.username,'kanto_ci');assert.equal(db.search,'');
 const pool=new pg.Pool({connectionString:db.href});let accountId;
 const flags=['NODE_ENV','ONLINE_REGISTRATION_ENABLED','ONLINE_TM_CI_ONLY'];
 const previous=Object.fromEntries(flags.map(f=>[f,process.env[f]]));
 try{
  process.env.NODE_ENV='test';process.env.ONLINE_REGISTRATION_ENABLED='true';process.env.ONLINE_TM_CI_ONLY='true';
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {startReservedWildTurnSession}=await import('../src/wildTurnSession.mjs');
  const {applyReservedWildTurn}=await import('../src/wildTurnAction.mjs');
  const {certifyResolvedWildTurn}=await import('../src/wildTurnCertificate.mjs');
  const {payCertifiedWildTurns}=await import('../src/wildTurnSettlement.mjs');
  const {finishPaidWildTurnEncounter}=await import('../src/wildTurnFinalization.mjs');
  const {createPrivateBattleRandom}=await import('../src/battleEntropy.mjs');
  const {quoteCertifiedRegionalLoot}=await import('../src/regionalLootQuote.mjs');
  const core=await loadCombatAdapter();
  accountId=(await pool.query("INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id",['tm-loot-'+randomUUID()+'@example.test','x'.repeat(48)])).rows[0].id;
  const initial=firstSave('TM Loot CI',4,1740000000000),before=JSON.parse(initial.journal.raw);
  before.trainer.level=80;before.roster[0].level=80;
  initial.journal.raw=JSON.stringify(before);
  await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[accountId,JSON.stringify(initial)]);
  const booked=await reserveEncounter(pool,{accountId,actionId:randomUUID(),expectedRevision:0,regionId:3,allowExpandedRegions:true});
  assert.equal(booked.status,'reserved');
  const ids={accountId,encounterId:booked.encounterId};
  // Find a synthetic CI key for a genuine executable TM drop; no runtime
  // override of the roll, payout, opponent catalogue, or player command.
  let entropyKey,tmId,opponent;
  for(let n=0;n<8192;n++){
   const candidate=Buffer.alloc(32);candidate.writeUInt32BE(n);
   const encounterRng=createPrivateBattleRandom(candidate,{...ids,phase:'wild-encounter'});
   const selected=core.serverRegionalRoll(3,80,80,encounterRng.integer);
   assert.ok(selected);
   const random=createPrivateBattleRandom(candidate,{...ids,phase:'wild-battle-tm-drop'});
   const rolled=core.rollRegionalMachine({regionId:3,speciesId:selected.speciesId,wildLevel:selected.level,trainerLevel:80,pokemonLevel:80,won:true},random.integer);
   assert.ok(rolled);
   if(rolled.tmId){entropyKey=candidate;tmId=rolled.tmId;opponent=selected;break;}
  }
  assert.ok(entropyKey&&tmId,'exercise a real nonempty R3 TM pool');
  const materialized=await materializeReservedEncounter(pool,{...ids,entropyKey});
  assert.equal(materialized.status,'materialized');assert.equal(materialized.speciesId,opponent.speciesId);assert.equal(materialized.level,opponent.level);
  const prepared=await prepareReservedBattle(pool,ids);
  assert.equal(prepared.status,'prepared');assert.equal(prepared.snapshot.tmLootVersion,1);
  const opening=await startReservedWildTurnSession(pool,{...ids,expectedRevision:1});
  assert.equal(opening.status,'started');
  let revision=1,state=opening.turnState;
  for(let n=0;n<30&&state.phase==='await-player';n++){
   const result=await applyReservedWildTurn(pool,{...ids,actionId:randomUUID(),expectedRevision:revision,action:{kind:'basic'},entropyKey});
   assert.equal(result.status,'applied');revision=result.revision;
   state=(await pool.query('SELECT battle_turn_state FROM game_encounter_reservations WHERE id=$1',[ids.encounterId])).rows[0].battle_turn_state;
  }
  assert.equal(state.phase,'resolved');assert.equal(state.outcome,'win');
  const cert=await certifyResolvedWildTurn(pool,{...ids,actionId:randomUUID(),expectedRevision:revision});
  assert.equal(cert.status,'certified');revision=cert.revision;
  const args={...ids,actionId:randomUUID(),expectedRevision:revision,entropyKey};
  const results=await Promise.all([payCertifiedWildTurns(pool,args),payCertifiedWildTurns(pool,args)]);
  assert.deepEqual(results.map(x=>x.status).sort(),['paid','replay']);
  const paid=results.find(x=>x.status==='paid');
  assert.deepEqual(results[0].quote,results[1].quote);assert.deepEqual(results[0].paid,results[1].paid);
  assert.equal(paid.quote.loot.tmId,tmId);
  const legacy={...prepared.snapshot};delete legacy.tmLootVersion;
  const baseLoot=quoteCertifiedRegionalLoot(core,legacy,{outcome:'win'},{...ids,entropyKey});
  const {tmId:quotedTm,...otherLoot}=paid.quote.loot;
  assert.deepEqual(otherLoot,baseLoot,'TM has its own HMAC domain; existing loot unchanged');
  assert.equal(quotedTm,tmId);
  assert.equal(paid.paid.pokemonXp,0);assert.equal(paid.paid.trainerXp,0);
  assert.deepEqual(paid.paid.loot.stored.filter(x=>x.kind==='tm'),[{kind:'tm',itemId:tmId,quantity:1}]);
  assert.equal(paid.paid.loot.pending.some(x=>x.kind==='tm'),false);
  const read=async()=>JSON.parse((await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[accountId])).rows[0].state.journal.raw);
  const after=await read();
  assert.equal(after.machineStock[tmId],1);
  assert.equal(after.roster[0].xp,before.roster[0].xp);assert.equal(after.trainer.xp,before.trainer.xp);
  assert.equal((await payCertifiedWildTurns(pool,{...args,actionId:randomUUID(),expectedRevision:paid.revision})).status,'already-paid');
  const row=await pool.query('SELECT battle_turn_payout_quote FROM game_encounter_reservations WHERE id=$1',[ids.encounterId]);
  assert.equal(row.rows[0].battle_turn_payout_quote.loot.tmId,tmId);
  // Forge only the TM quote, then restore the certified record.
  const forged=structuredClone(row.rows[0].battle_turn_payout_quote);forged.loot.tmId=null;
  await pool.query('UPDATE game_encounter_reservations SET battle_turn_payout_quote=$2::jsonb WHERE id=$1',[ids.encounterId,JSON.stringify(forged)]);
  const finish={...ids,actionId:randomUUID(),expectedRevision:paid.revision,choice:'skip',entropyKey};
  assert.equal((await finishPaidWildTurnEncounter(pool,finish)).status,'invalid-payout');
  assert.equal((await read()).machineStock[tmId],1);
  await pool.query('UPDATE game_encounter_reservations SET battle_turn_payout_quote=$2::jsonb WHERE id=$1',[ids.encounterId,JSON.stringify(row.rows[0].battle_turn_payout_quote)]);
  assert.equal((await finishPaidWildTurnEncounter(pool,finish)).status,'finished');
  assert.equal((await read()).machineStock[tmId],1);
  const view=await readMachines(pool,accountId);
  assert.equal(view.status,'ok');assert.equal(view.machines.find(x=>x.id===tmId).quantity,1);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM game_action_receipts WHERE account_id=$1 AND kind='wild-turn-payout'",[accountId])).rows[0].n),1);
 }finally{
  for(const f of flags){if(previous[f]===undefined)delete process.env[f];else process.env[f]=previous[f];}
  if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
  await pool.end();
 }
});
