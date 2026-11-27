import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {firstSave} from '../src/initialAdventure.mjs';
import {evolvePokemonMega,challengePokemonMega} from '../src/megaWriter.mjs';
test('Mega evolution persists once per UID under concurrent requests',async()=>{
 const db=new URL(process.env.DATABASE_URL);
 assert.equal(db.protocol,'postgresql:');assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'55432');
 assert.equal(db.pathname,'/kanto_ci');assert.equal(db.username,'kanto_ci');assert.equal(db.search,'');
 const pool=new pg.Pool({connectionString:db.href});let id;
 try{
  id=(await pool.query("INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id",['mega-'+randomUUID()+'@example.test','x'.repeat(48)])).rows[0].id;
  const save=firstSave('Mega CI',4,1740000000000),raw=JSON.parse(save.journal.raw);
  Object.assign(raw.roster[0],{pokemonId:6,level:100,affinity:100});
  raw.badges=['boulder','cascade','thunder','rainbow','soul','marsh','volcano','earth'];
  raw.research={points:{'4':100},favorites:[],totalSent:0,history:[]};
  raw.roster[0].megaTrialForm='charizard-mega-x';
  save.journal.raw=JSON.stringify(raw);
  await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[id,JSON.stringify(save)]);
  const evolve=(formId,expectedRevision,actionId=randomUUID())=>evolvePokemonMega(pool,{accountId:id,actionId,expectedRevision,command:{uid:1,formId}});
  assert.equal((await evolve('venusaur-mega',0)).status,'incompatible');
  const action=randomUUID(),results=await Promise.all([evolve('charizard-mega-x',0,action),evolve('charizard-mega-x',0,action)]);
  assert.deepEqual(results.map(x=>x.status).sort(),['applied','duplicate']);
  assert.equal((await evolve('charizard-mega-y',0)).status,'stale');
  assert.equal((await evolve('charizard-mega-y',1)).status,'already-mega');
  const row=(await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',[id])).rows[0];
  assert.equal(Number(row.revision),1);
  assert.deepEqual(JSON.parse(row.state.journal.raw),{...raw,roster:[{...raw.roster[0],megaForm:'charizard-mega-x'}]});
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM game_action_receipts WHERE account_id=$1 AND kind='pokemon-mega-evolve'",[id])).rows[0].n),1);
 }finally{if(id)await pool.query('DELETE FROM game_accounts WHERE id=$1',[id]);await pool.end();}
});

test('Mega sanctuary: real server duel, retry on defeat, replay and exclusive stone',async()=>{
 const db=new URL(process.env.DATABASE_URL);
 assert.equal(db.protocol,'postgresql:');assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'55432');
 assert.equal(db.pathname,'/kanto_ci');assert.equal(db.username,'kanto_ci');assert.equal(db.search,'');
 const pool=new pg.Pool({connectionString:db.href});let id;
 try{
  id=(await pool.query("INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id",['mega-trial-'+randomUUID()+'@example.test','x'.repeat(48)])).rows[0].id;
  const save=firstSave('Mega Trial CI',4,1740000000000),raw=JSON.parse(save.journal.raw);
  raw.trainer.level=100;
  raw.trainer.manual={hp:40,attack:40,defense:19,specialAttack:40,specialDefense:19,speed:40};
  raw.badges=['boulder','cascade','thunder','rainbow','soul','marsh','volcano','earth'];
  raw.research={points:{'4':100},favorites:[],totalSent:0,history:[]};
  Object.assign(raw.roster[0],{pokemonId:6,level:100,affinity:100,moveName:'ember'});
  // Same family, two separate individuals; second is trained for the actual
  // type matchup, not a mocked outcome or injected enemy.
  const trained=structuredClone(raw.roster[0]);
  Object.assign(trained,{uid:2,manual:{hp:0,attack:0,defense:0,specialAttack:158,specialDefense:0,speed:40},
   moveName:'dragon-claw',equippedMoveNames:['dragon-claw','earthquake'],
   machineLessons:[{tmId:'tm02',speciesId:6},{tmId:'tm26',speciesId:6}],upgrades:{'dragon-claw':10,earthquake:10}});
  raw.roster.push(trained);raw.nextUid=3;raw.seen=[4,5,6];raw.caughtSpecies=[4,5,6];
  save.journal.raw=JSON.stringify(raw);
  await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[id,JSON.stringify(save)]);
  const read=async()=>{const row=(await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',[id])).rows[0];return {revision:Number(row.revision),raw:JSON.parse(row.state.journal.raw)};};
  const x='charizard-mega-x',y='charizard-mega-y',key=Buffer.alloc(32,0x7a);
  const request=(uid,formId,expectedRevision,actionId=randomUUID())=>({accountId:id,expectedRevision,actionId,command:{uid,formId},entropyKey:key});
  assert.equal((await challengePokemonMega(pool,{...request(1,x,0),command:{uid:1,formId:x,outcome:'win'}})).status,'invalid');
  assert.equal((await challengePokemonMega(pool,request(999,x,0))).status,'missing-pokemon');
  const weak=request(1,x,0);
  const race=await Promise.all([challengePokemonMega(pool,weak),challengePokemonMega(pool,weak)]);
  assert.deepEqual(race.map(r=>r.status).sort(),['applied','replay']);
  assert.deepEqual(race[0].trial,race[1].trial);
  assert.ok(['loss','draw'].includes(race[0].trial.outcome),'untrained Ember-only fixture must not beat boss');
  assert.equal(race[0].trial.stoneId,null);
  assert.equal((await read()).raw.roster[0].megaTrialForm,undefined);
  assert.equal((await challengePokemonMega(pool,{...weak,entropyKey:Buffer.alloc(32,0x31)})).status,'replay');
  assert.equal((await challengePokemonMega(pool,{...weak,command:{uid:1,formId:y}})).status,'duplicate');
  let victory,revision=1;
  for(let attempt=0;attempt<24;attempt++){
   const res=await challengePokemonMega(pool,request(2,x,revision));
   assert.equal(res.status,'applied');revision=res.revision;
   if(res.trial.outcome==='win'){victory=res;break;}
   assert.equal(res.trial.stoneId,null);
   assert.equal((await read()).raw.roster[1].megaTrialForm,undefined);
  }
  assert.ok(victory,'trained counter-build must be able to defeat the real boss');
  const won=await read();
  assert.equal(won.raw.roster[1].megaTrialForm,x);
  assert.equal(won.raw.roster[0].megaTrialForm,undefined);
  assert.equal(victory.trial.stoneId,'charizardite-x');
  assert.equal(victory.trial.log.length,victory.trial.frames.length);
  for(const k of ['coins','wins','losses','trainer','badges','ballPocket','research','inventory'])assert.deepEqual(won.raw[k],raw[k]);
  assert.deepEqual(won.raw.roster,[raw.roster[0],{...raw.roster[1],megaTrialForm:x}]);
  assert.equal((await challengePokemonMega(pool,request(2,y,revision))).status,'pass-consumed');
  assert.equal((await challengePokemonMega(pool,request(2,x,revision))).status,'pass-consumed');
  assert.equal((await challengePokemonMega(pool,weak)).status,'duplicate','old committed action may not reroll');
  const evolve=(uid,formId)=>evolvePokemonMega(pool,{accountId:id,actionId:randomUUID(),expectedRevision:revision,command:{uid,formId}});
  assert.equal((await evolve(1,x)).status,'no-stock');
  assert.equal((await evolve(2,y)).status,'no-stock');
  assert.equal((await evolve(2,x)).status,'applied');
  const final=await read();assert.equal(final.raw.roster[1].megaForm,x);
  assert.equal(final.raw.roster[1].megaTrialForm,x);
  assert.equal(final.revision,revision+1);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM game_action_receipts WHERE account_id=$1 AND kind='pokemon-mega-trial'",[id])).rows[0].n),revision);
 }finally{if(id)await pool.query('DELETE FROM game_accounts WHERE id=$1',[id]);await pool.end();}
});
