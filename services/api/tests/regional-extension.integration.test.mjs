import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {firstSave} from '../src/initialAdventure.mjs';
import {loadRegionalTestKey,regionalExpansionEnabled,readRegionalEncounter,runRegionalCommand} from '../src/regionalHttp.mjs';
import {loadCombatAdapter} from '../src/battlePreview.mjs';

// Deliberately separate from standard integration and migration registry.
// A disposable PG18 workflow step runs this only after the ordinary suite.
test('23F6: candidate constraint and persisted regional lifecycles R2–R10',async()=>{
 assert.equal(process.env.GITHUB_ACTIONS,'true');
 assert.equal(regionalExpansionEnabled(),true);
 const key=loadRegionalTestKey();
 assert.throws(()=>regionalExpansionEnabled({...process.env,NODE_ENV:'production'}));
 assert.throws(()=>regionalExpansionEnabled({...process.env,DATABASE_URL:'postgresql://kanto_ci@remote:55432/kanto_ci'}));
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 const accounts=[];
 try{
  const core=await loadCombatAdapter();
  await pool.query(await readFile(new URL('../sql/027_regional_turn_binding.sql',import.meta.url),'utf8'));
  const migrations=await pool.query('SELECT count(*)::int AS n FROM game_schema_migrations');
  assert.equal(migrations.rows[0].n,25,'candidate SQL never enters registry');
  for(const region of core.serverRegionalCatalog(100).filter(r=>r.id>1)){
   const row=await pool.query("INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id",
    ['region-extension-'+randomUUID()+'@example.test','x'.repeat(48)]);
   const id=row.rows[0].id;accounts.push(id);
   const initial=firstSave('Regional CI',4,1740000000000);
   await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[id,JSON.stringify(initial)]);
   const command=(kind,fields,expanded=true)=>runRegionalCommand(pool,id,kind,fields,key,expanded);
   const action=()=>randomUUID();
   const denied=await command('reserve',{actionId:action(),expectedRevision:0,regionId:region.id});
   assert.equal(denied.status,'locked');
   assert.equal((await readRegionalEncounter(pool,id,true)).encounter,null);
   const raw=JSON.parse(initial.journal.raw);
   raw.trainer.level=region.trainerUnlockLevel;
   raw.roster[0].level=Math.min(100,region.levelMax+5);
   raw.roster[0].manual.attack=40;raw.roster[0].manual.hp=0;
   if(raw.roster[0].level<21)raw.roster[0].manual.attack=(raw.roster[0].level-1)*2;
   initial.journal.raw=JSON.stringify(raw);
   await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[id,JSON.stringify(initial)]);
   const catalog=await readRegionalEncounter(pool,id,true);
   assert.equal(catalog.regions.length,10);assert.equal(catalog.regions.find(r=>r.id===region.id).unlocked,true);
   assert.equal((await readRegionalEncounter(pool,id)).regions.length,1);
   const blocked=await command('reserve',{actionId:action(),expectedRevision:0,regionId:region.id},false);
   assert.equal(blocked.status,'invalid');
   const reserved=await command('reserve',{actionId:action(),expectedRevision:0,regionId:region.id});
   assert.equal(reserved.status,'reserved');const encounterId=reserved.encounter.id;
   let state=await command('start',{encounterId,expectedRevision:reserved.revision});
   assert.equal(state.status,'started',JSON.stringify({region:region.id,status:state.status}));
   assert.equal(state.encounter.regionId,region.id);
   assert.equal(state.encounter.player.uid,1);
   assert.ok(core.serverRegionalOpponent(region.id,raw.trainer.level,state.encounter.speciesId,state.encounter.level));
   await assert.rejects(pool.query("UPDATE game_encounter_reservations SET battle_turn_state=jsonb_set(battle_turn_state,'{regionId}','1'::jsonb) WHERE id=$1",[encounterId]),e=>e.code==='23514');
   const first={encounterId,actionId:action(),expectedRevision:state.revision,action:{kind:'basic'}};
   state=await command('turn',first);assert.equal(state.status,'applied');
   const replay=await command('turn',first);assert.equal(replay.status,'replay');assert.equal(replay.revision,state.revision);
   for(let i=1;state.encounter.phase==='await-player'&&i<30;i++){
    state=await command('turn',{encounterId,actionId:action(),expectedRevision:state.revision,action:{kind:'basic'}});
    assert.equal(state.status,'applied');
   }
   assert.equal(state.encounter.phase,'resolved');
   const cert=await command('certify',{encounterId,actionId:action(),expectedRevision:state.revision});
   assert.equal(cert.status,'certified');
   const paid=await command('settle',{encounterId,actionId:action(),expectedRevision:cert.revision});
   assert.equal(paid.status,'paid');
   const finished=await command('finish',{encounterId,actionId:action(),expectedRevision:paid.revision,choice:'skip'});
   assert.equal(finished.status,'finished');assert.equal(finished.encounter,null);
   const stored=await pool.query('SELECT status,region_id,battle_turn_payout_quote FROM game_encounter_reservations WHERE id=$1',[encounterId]);
   assert.equal(stored.rows[0].status,'completed');assert.equal(stored.rows[0].region_id,region.id);
   assert.equal(stored.rows[0].battle_turn_payout_quote.regionId,region.id);
   const save=await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[id]);
   const progress=JSON.parse(save.rows[0].state.journal.raw);
   assert.equal(progress.regionWins[region.id-1],stored.rows[0].battle_turn_payout_quote.wins);
   assert.equal(progress.regionWins.reduce((n,x)=>n+x,0),stored.rows[0].battle_turn_payout_quote.wins);
  }
 }finally{
  for(const id of accounts)await pool.query('DELETE FROM game_accounts WHERE id=$1',[id]);
  await pool.end();
 }
});
