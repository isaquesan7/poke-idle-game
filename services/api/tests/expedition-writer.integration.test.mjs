import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {firstSave} from '../src/initialAdventure.mjs';
import {applyExpeditionCommand} from '../src/expeditionWriter.mjs';
import {reserveEncounter} from '../src/encounterReservation.mjs';
import {setCollectionTeam} from '../src/collectionTeam.mjs';
import {applyTrainerInvestment} from '../src/trainerInvestment.mjs';
test('23F8A private expedition: server clock, cap, lock, duplicate and leader XP',async()=>{
 const db=new URL(process.env.DATABASE_URL);
 assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'55432');assert.equal(db.pathname,'/kanto_ci');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 let id;
 try{
  id=(await pool.query("INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id",['expedition-'+randomUUID()+'@example.test','x'.repeat(48)])).rows[0].id;
  const save=firstSave('Expedition CI',4,1740000000000);
  await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[id,JSON.stringify(save)]);
  const command=(kind,expectedRevision,fields={})=>applyExpeditionCommand(pool,{accountId:id,actionId:randomUUID(),expectedRevision,kind,...fields});
  const read=async()=>{const row=(await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',[id])).rows[0];return {revision:Number(row.revision),save:row.state,raw:JSON.parse(row.state.journal.raw)};};
  assert.equal((await command('start',0,{regionId:1})).status,'unavailable');
  assert.equal((await command('start',0,{regionId:1,nowMs:0})).status,'invalid');
  const raw=JSON.parse(save.journal.raw);raw.roster[0].level=2;
  raw.roster.push({...structuredClone(raw.roster[0]),uid:2,pokemonId:7,moveName:'tackle'});
  raw.team=[1,2];raw.nextUid=3;save.journal.raw=JSON.stringify(raw);
  await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[id,JSON.stringify(save)]);
  assert.equal((await command('start',0,{regionId:10})).status,'unavailable');
  const started=await command('start',0,{regionId:1});assert.equal(started.status,'applied');
  const active=await read();assert.deepEqual(active.raw.expedition.teamUids,[1]);
  assert.ok(Math.abs(Date.now()-active.raw.expedition.startedAt)<30000);
  assert.equal((await reserveEncounter(pool,{accountId:id,actionId:randomUUID(),expectedRevision:1,regionId:1})).status,'busy');
  assert.equal((await setCollectionTeam(pool,{accountId:id,actionId:randomUUID(),expectedRevision:1,teamUids:[2]})).status,'busy');
  assert.equal((await applyTrainerInvestment(pool,{accountId:id,actionId:randomUUID(),expectedRevision:1,stat:'attack'})).status,'busy');
  // Synthetic aging only via isolated DB, never an API parameter.
  active.raw.expedition.startedAt-=12*3600000;active.raw.expedition.lastClaimAt=active.raw.expedition.startedAt;
  active.save.journal.raw=JSON.stringify(active.raw);
  await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[id,JSON.stringify(active.save)]);
  const actionId=randomUUID();
  const request={accountId:id,actionId,expectedRevision:1,kind:'claim'};
  const both=await Promise.all([applyExpeditionCommand(pool,request),applyExpeditionCommand(pool,request)]);
  assert.deepEqual(both.map(x=>x.status).sort(),['applied','duplicate']);
  const claimed=await read();
  assert.equal(claimed.raw.lastClaim.cycles,2880);
  assert.ok(claimed.raw.coins>0);assert.ok(claimed.raw.roster[0].level>2);
  assert.deepEqual(claimed.raw.roster[1],raw.roster[1]);
  assert.equal(claimed.raw.roster[0].affinity,0);
  assert.equal(claimed.raw.expedition.startedAt,active.raw.expedition.startedAt);
  assert.equal((await command('stop',1)).status,'stale');
  assert.equal((await command('stop',2)).status,'applied');
  const stopped=await read();assert.equal(stopped.raw.expedition,null);
  assert.equal(stopped.raw.coins,claimed.raw.coins);
  assert.equal(stopped.revision,3);
 }finally{if(id)await pool.query('DELETE FROM game_accounts WHERE id=$1',[id]);await pool.end();}
});


test('D4C2: full bag preserves expedition XP, coins and overflow; resolve during activity',async()=>{
 const db=new URL(process.env.DATABASE_URL);assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'55432');assert.equal(db.pathname,'/kanto_ci');assert.equal(db.username,'kanto_ci');
 const pool=new pg.Pool({connectionString:db.href});let id;
 try{
  const {changeTrainerLoadout}=await import('../src/trainerLoadoutWriter.mjs');
  const {loadCombatAdapter}=await import('../src/battlePreview.mjs');
  const core=await loadCombatAdapter();
  id=(await pool.query("INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id",['exp-loot-'+randomUUID()+'@example.test','x'.repeat(48)])).rows[0].id;
  const save=firstSave('Exp Loot CI',4,1740000000000),raw=JSON.parse(save.journal.raw);
  raw.trainer.level=82;raw.roster[0].level=81;
  raw.inventory.gear=Array.from({length:9},(_,i)=>({id:'gear-exp-'+i,source:'drop',templateId:'cap',slot:'hat',rarity:'common',regionId:1,requiredLevel:1,stats:{hp:2}}));
  raw.ballPocket.quantities['poke-ball']=100000;
  raw.expeditionBallProgress={'poke-ball':1439,'great-ball':2879,'ultra-ball':8639};
  save.journal.raw=JSON.stringify(raw);
  await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[id,JSON.stringify(save)]);
  const command=(kind,expectedRevision,fields={})=>applyExpeditionCommand(pool,{accountId:id,actionId:randomUUID(),kind,expectedRevision,...fields});
  const read=async()=>{const r=(await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',[id])).rows[0];return {revision:Number(r.revision),save:r.state,raw:JSON.parse(r.state.journal.raw)};};
  assert.equal((await command('start',0,{regionId:9})).status,'applied');
  const active=await read();active.raw.expedition.startedAt-=30000;active.raw.expedition.lastClaimAt=active.raw.expedition.startedAt;active.save.journal.raw=JSON.stringify(active.raw);
  await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[id,JSON.stringify(active.save)]);
  const actionId=randomUUID(),request={accountId:id,actionId,expectedRevision:1,kind:'claim'};
  const both=await Promise.all([applyExpeditionCommand(pool,request),applyExpeditionCommand(pool,request)]);
  assert.deepEqual(both.map(x=>x.status).sort(),['applied','duplicate']);
  const claimed=await read(),p=claimed.raw.pendingExpeditionLoot;
  assert.ok(claimed.raw.coins>0);assert.ok(claimed.raw.lastClaim.trainerXP>0);assert.ok(claimed.raw.lastClaim.pokemonXP>0);
  assert.deepEqual(p.quantities,{'poke-ball':1,'great-ball':1,'ultra-ball':1});
  assert.equal(claimed.raw.ballPocket.quantities['poke-ball'],100000);assert.equal(core.onlineInventoryProjection(claimed.save.journal.raw).bag.used,10);
  assert.equal((await command('claim',2)).status,'unavailable');
  const apply=(command,expectedRevision,actionId=randomUUID())=>changeTrainerLoadout(pool,{accountId:id,actionId,expectedRevision,command});
  const great={kind:'expedition-loot-store',claimAt:p.claimAt,itemId:'great-ball'};
  assert.equal((await apply(great,2)).status,'bag-full');
  assert.equal((await apply({kind:'equipment',slot:'hat',itemId:'gear-exp-0'},2)).status,'busy');
  assert.equal((await apply({kind:'discard-gear',itemId:'gear-exp-0'},2)).status,'applied');
  const same=randomUUID(),race=await Promise.all([apply(great,3,same),apply(great,3,same)]);assert.deepEqual(race.map(x=>x.status).sort(),['applied','duplicate']);
  assert.equal((await apply({...great,claimAt:p.claimAt+1},4)).status,'unavailable');
  assert.equal((await apply({kind:'expedition-loot-discard',claimAt:p.claimAt,itemId:'poke-ball'},4)).status,'applied');
  // Stop remains possible with unresolved Ultra Ball; no forced deletion.
  assert.equal((await command('stop',5)).status,'applied');
  const stopped=await read();assert.equal(stopped.raw.expedition,null);assert.equal(stopped.raw.pendingExpeditionLoot.quantities['ultra-ball'],1);
  assert.equal((await reserveEncounter(pool,{accountId:id,actionId:randomUUID(),regionId:1,expectedRevision:6})).status,'busy');
  assert.equal((await apply({kind:'discard-gear',itemId:'gear-exp-1'},6)).status,'applied');
  const latest=await read();assert.equal((await apply({kind:'expedition-loot-store',claimAt:latest.raw.pendingExpeditionLoot.claimAt,itemId:'ultra-ball'},7)).status,'applied');
  const end=await read();assert.equal(end.raw.pendingExpeditionLoot,undefined);assert.equal(end.raw.ballPocket.quantities['great-ball'],1);assert.equal(end.raw.ballPocket.quantities['ultra-ball'],1);assert.ok(end.raw.coins>=claimed.raw.coins);assert.equal(core.onlineInventoryProjection(end.save.journal.raw).bag.used,10);
 }finally{if(id)await pool.query('DELETE FROM game_accounts WHERE id=$1',[id]);await pool.end();}
});
