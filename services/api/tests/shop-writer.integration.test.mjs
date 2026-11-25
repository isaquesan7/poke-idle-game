import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {firstSave} from '../src/initialAdventure.mjs';
import {purchaseShopBall,purchaseShopGear} from '../src/shopWriter.mjs';
import {reserveEncounter} from '../src/encounterReservation.mjs';
import {applyExpeditionCommand} from '../src/expeditionWriter.mjs';
test('23F9A: canonical shop price, unlock, inventory and atomic checkout',async()=>{
 const db=new URL(process.env.DATABASE_URL);
 assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'55432');assert.equal(db.pathname,'/kanto_ci');assert.equal(db.username,'kanto_ci');
 const pool=new pg.Pool({connectionString:db.href});
 let id;
 try{
  id=(await pool.query("INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id",['shop-'+randomUUID()+'@example.test','x'.repeat(48)])).rows[0].id;
  const save=firstSave('Shop CI',4,1740000000000);
  await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[id,JSON.stringify(save)]);
  const buy=(ballId,quantity,expectedRevision,extra={})=>purchaseShopBall(pool,{accountId:id,actionId:randomUUID(),ballId,quantity,expectedRevision,...extra});
  const read=async()=>{const r=(await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',[id])).rows[0];return {revision:Number(r.revision),save:r.state,raw:JSON.parse(r.state.journal.raw)};};
  assert.equal((await buy('poke-ball',1,0)).status,'unavailable');
  assert.equal((await buy('master-ball',1,0)).status,'invalid');
  assert.equal((await buy('poke-ball',1,0,{unitPrice:0})).status,'invalid');
  const fixture=await read();fixture.raw.coins=100000;fixture.raw.roster[0].level=2;fixture.save.journal.raw=JSON.stringify(fixture.raw);
  await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[id,JSON.stringify(fixture.save)]);
  assert.equal((await buy('great-ball',1,0)).status,'unavailable');
  assert.equal((await buy('ultra-ball',1,0)).status,'unavailable');
  const actionId=randomUUID();
  const both=await Promise.all([buy('poke-ball',2,0,{actionId}),buy('poke-ball',2,0,{actionId})]);
  assert.deepEqual(both.map(r=>r.status).sort(),['duplicate','purchased']);
  assert.equal(both.find(r=>r.status==='purchased').purchase.cost,1200);
  const after=await read();assert.equal(after.raw.coins,98800);assert.equal(after.raw.ballPocket.quantities['poke-ball'],14);
  assert.deepEqual(after.raw.roster,fixture.raw.roster);assert.equal(after.revision,1);
  assert.equal((await buy('poke-ball',1,0)).status,'stale');
  after.raw.trainer.level=55;after.raw.ballPocket.quantities['poke-ball']=100000;after.save.journal.raw=JSON.stringify(after.raw);
  await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',[id,JSON.stringify(after.save)]);
  assert.equal((await buy('poke-ball',1,1)).status,'unavailable');
  assert.equal((await buy('great-ball',26,1)).status,'unavailable');
  assert.equal((await buy('ultra-ball',11,1)).status,'unavailable');
  assert.equal((await buy('great-ball',1,1)).purchase.cost,2400);
  assert.equal((await buy('ultra-ball',1,2)).purchase.cost,16000);
  assert.equal((await applyExpeditionCommand(pool,{accountId:id,actionId:randomUUID(),kind:'start',regionId:1,expectedRevision:3})).status,'applied');
  assert.equal((await buy('great-ball',1,4)).status,'busy');
  assert.equal((await applyExpeditionCommand(pool,{accountId:id,actionId:randomUUID(),kind:'stop',expectedRevision:4})).status,'applied');
  assert.equal((await reserveEncounter(pool,{accountId:id,actionId:randomUUID(),regionId:1,expectedRevision:5})).status,'reserved');
  assert.equal((await buy('great-ball',1,6)).status,'busy');
  const end=await read();assert.equal(end.raw.coins,80400);assert.equal(end.raw.ballPocket.quantities['great-ball'],1);assert.equal(end.raw.ballPocket.quantities['ultra-ball'],1);
 }finally{if(id)await pool.query('DELETE FROM game_accounts WHERE id=$1',[id]);await pool.end();}
});


test('D4D: basic gear checkout is fixed, atomic and capacity-aware; expander disabled',async()=>{
 const db=new URL(process.env.DATABASE_URL);assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'55432');assert.equal(db.pathname,'/kanto_ci');assert.equal(db.username,'kanto_ci');
 const pool=new pg.Pool({connectionString:db.href});let id;
 try{
  const {loadCombatAdapter}=await import('../src/battlePreview.mjs');const core=await loadCombatAdapter();
  const {changeTrainerLoadout}=await import('../src/trainerLoadoutWriter.mjs');
  id=(await pool.query("INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id",['gear-shop-'+randomUUID()+'@example.test','x'.repeat(48)])).rows[0].id;
  const save=firstSave('Gear Shop CI',4,1740000000000),raw=JSON.parse(save.journal.raw);
  raw.coins=24000;save.journal.raw=JSON.stringify(raw);
  await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[id,JSON.stringify(save)]);
  const read=async()=>{const row=(await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',[id])).rows[0];return {revision:Number(row.revision),raw:JSON.parse(row.state.journal.raw)};};
  const buy=(templateId,expectedRevision,extra={})=>purchaseShopGear(pool,{accountId:id,actionId:randomUUID(),expectedRevision,templateId,...extra});
  const offer=core.onlineShopProjection(save.journal.raw);assert.equal(offer.gearItems.length,14);assert.equal(new Set(offer.gearItems.map(i=>i.slot)).size,9);
  assert.ok(offer.gearItems.every(i=>i.rarity==='common'&&i.unitPrice===1200&&Object.values(i.stats).join(',')==='1'));
  assert.deepEqual(offer.bagExpander,{id:'bag-expander',name:'Expansor de mochila',slots:5,available:false,price:null,currency:null,withinLimit:true});
  assert.equal((await buy('bag-expander',0)).status,'invalid');assert.equal((await buy('cap',0,{unitPrice:0})).status,'invalid');
  const actionId=randomUUID();const race=await Promise.all([buy('cap',0,{actionId}),buy('cap',0,{actionId})]);assert.deepEqual(race.map(x=>x.status).sort(),['duplicate','purchased']);
  const first=race.find(x=>x.status==='purchased').purchase;assert.equal(first.cost,1200);assert.equal(first.gear.source,'shop');assert.deepEqual(first.gear.stats,{hp:1});
  const second=(await buy('cap',1)).purchase;assert.notEqual(first.instanceId,second.instanceId);
  const equip=await changeTrainerLoadout(pool,{accountId:id,actionId:randomUUID(),expectedRevision:2,command:{kind:'equipment',slot:'hat',itemId:first.instanceId}});assert.equal(equip.status,'applied');assert.equal(equip.totals.hp,2);
  for(let rev=3;rev<11;rev++)assert.equal((await buy('visor',rev)).status,'purchased');
  const full=await read();assert.equal(full.revision,11);assert.equal(full.raw.coins,12000);assert.equal(full.raw.inventory.gear.length,10);assert.equal(core.onlineInventoryProjection(JSON.stringify(full.raw)).bag.available,0);
  assert.equal((await buy('coat',11)).status,'unavailable');assert.deepEqual(await read(),full);
  assert.equal((await reserveEncounter(pool,{accountId:id,actionId:randomUUID(),expectedRevision:11,regionId:1})).status,'reserved');
  assert.equal((await buy('coat',12)).status,'busy');
 }finally{if(id)await pool.query('DELETE FROM game_accounts WHERE id=$1',[id]);await pool.end();}
});
