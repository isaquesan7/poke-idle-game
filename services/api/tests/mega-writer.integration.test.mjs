import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {firstSave} from '../src/initialAdventure.mjs';
import {evolvePokemonMega} from '../src/megaWriter.mjs';
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
  raw.megaStoneStock={'charizardite-x':1,'charizardite-y':1};
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
  assert.deepEqual(JSON.parse(row.state.journal.raw),{...raw,roster:[{...raw.roster[0],megaForm:'charizard-mega-x'}],megaStoneStock:{'charizardite-y':1}});
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM game_action_receipts WHERE account_id=$1 AND kind='pokemon-mega-evolve'",[id])).rows[0].n),1);
 }finally{if(id)await pool.query('DELETE FROM game_accounts WHERE id=$1',[id]);await pool.end();}
});
