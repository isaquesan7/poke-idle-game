import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {firstSave} from '../src/initialAdventure.mjs';
import {changeTrainerLoadout,changeOnlineReforge} from '../src/trainerLoadoutWriter.mjs';
import {loadCombatAdapter} from '../src/battlePreview.mjs';
import {buildPersistedBattleSnapshot} from '../src/battlePreparation.mjs';
import {reserveEncounter} from '../src/encounterReservation.mjs';
test('23F12D1: inventory ownership, capacity, titles, atomic equipment and busy lock',async()=>{
 const db=new URL(process.env.DATABASE_URL);
 assert.equal(db.protocol,'postgresql:');assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'55432');assert.equal(db.pathname,'/kanto_ci');assert.equal(db.username,'kanto_ci');assert.equal(db.search,'');
 const pool=new pg.Pool({connectionString:db.href});let id;
 try{
  id=(await pool.query("INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id",['loadout-'+randomUUID()+'@example.test','x'.repeat(48)])).rows[0].id;
  const save=firstSave('Loadout CI',4,1740000000000),core=await loadCombatAdapter();
  const initial=core.onlineInventoryProjection(save.journal.raw);
  assert.equal(initial.bag.capacity,10);assert.equal(initial.bag.used,1);assert.deepEqual(initial.equipment,[]);
  const raw=JSON.parse(save.journal.raw);
  // Only this disposable fixture owns equipment and stones; no production grant.
  raw.inventory={version:1,gear:[{"id":"gear-cap","source":"drop","templateId":"cap","slot":"hat","rarity":"common","regionId":1,"requiredLevel":1,"stats":{"hp":2}},{"id":"gear-cap-2","source":"drop","templateId":"cap","slot":"hat","rarity":"common","regionId":1,"requiredLevel":1,"stats":{"attack":1}},{"id":"gear-visor","source":"drop","templateId":"visor","slot":"hat","rarity":"common","regionId":1,"requiredLevel":1,"stats":{"speed":2}},{"id":"gear-coat","source":"drop","templateId":"coat","slot":"jacket","rarity":"common","regionId":1,"requiredLevel":1,"stats":{"defense":2}}],extraBagSlots:2};
  raw.evolutionStones={'fire-stone':3};raw.wins=4;
  save.journal.raw=JSON.stringify(raw);
  await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[id,JSON.stringify(save)]);
  const read=async()=>{const row=(await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',[id])).rows[0];return {revision:Number(row.revision),raw:JSON.parse(row.state.journal.raw),projection:core.onlineInventoryProjection(row.state.journal.raw)};};
  const apply=(command,expectedRevision,actionId=randomUUID())=>changeTrainerLoadout(pool,{accountId:id,actionId,expectedRevision,command});
  const equip=(slot,itemId)=>({kind:'equipment',slot,itemId});
  // Two copies of the same template are separate items, not a quantity stack.
  const candidate=structuredClone(raw);
  const project=()=>core.onlineInventoryProjection(JSON.stringify(candidate));
  const mutate=command=>core.applyOnlineTrainerLoadout(JSON.stringify(candidate),command);
  const same=project().equipment.filter(i=>i.templateId==='cap');
  assert.equal(same.length,2);assert.notEqual(same[0].id,same[1].id);
  assert.notDeepEqual(same[0].stats,same[1].stats);
  // Full bag: equipping an item frees space, swap preserves capacity,
  // unequip is refused when no space remains.
  candidate.inventory.gear.push(...Array.from({length:7},(_,i)=>({...candidate.inventory.gear[0],id:'gear-extra-'+i})));
  candidate.trainer.equipped={hat:'gear-cap'};
  assert.equal(project().bag.used,12);assert.equal(project().bag.available,0);
  assert.equal(mutate(equip('hat',null)).status,'bag-full');
  const swap=mutate(equip('hat','gear-cap-2'));assert.equal(swap.status,'ok');
  assert.equal(core.onlineInventoryProjection(swap.raw).bag.used,12);
  assert.equal(core.onlineInventoryProjection(swap.raw).totals.attack,project().totals.attack+1);
  const future={...candidate.inventory.gear[0],id:'gear-future',regionId:6,requiredLevel:50,rarity:'rare',stats:{hp:6,specialAttack:5}};
  candidate.inventory.gear[1]=future;
  assert.equal(project().equipment.find(i=>i.id==='gear-future').canEquip,false);
  assert.equal(mutate(equip('hat','gear-future')).status,'unavailable');
  candidate.trainer.level=50;
  assert.equal(mutate(equip('hat','gear-future')).status,'ok');
  const invalid=structuredClone(candidate);invalid.inventory.gear.push(invalid.inventory.gear[0]);
  assert.equal(core.onlineInventoryProjection(JSON.stringify(invalid)),null);
  const forgedGear=structuredClone(candidate);forgedGear.inventory.gear[0].stats.hp=999;
  assert.equal(core.onlineInventoryProjection(JSON.stringify(forgedGear)),null);
  const before=await read();assert.equal(before.projection.bag.capacity,12);assert.equal(before.projection.bag.used,6);assert.equal(before.projection.bag.available,6);
  assert.equal((await apply(equip('hat','gloves'),0)).status,'unavailable');
  assert.equal((await apply(equip('jacket','gear-cap'),0)).status,'unavailable');
  assert.equal((await apply({kind:'title',titleId:'mestre'},0)).status,'unavailable');
  assert.equal((await apply({kind:'title',titleId:'gym-leader'},0)).status,'invalid');
  assert.equal((await apply({...equip('hat','gear-cap'),stats:{hp:99}},0)).status,'invalid');
  assert.deepEqual((await read()).raw,before.raw);
  const actionId=randomUUID(),race=await Promise.all([apply(equip('hat','gear-cap'),0,actionId),apply(equip('hat','gear-cap'),0,actionId)]);
  assert.deepEqual(race.map(r=>r.status).sort(),['applied','duplicate']);
  const equipped=await read();assert.equal(equipped.projection.totals.hp,before.projection.totals.hp+2);
  assert.equal(equipped.projection.equipment.find(i=>i.id==='gear-cap').quantity,1);
  assert.equal(equipped.projection.equipment.find(i=>i.id==='gear-cap').equipped,true);
  assert.equal((await apply(equip('hat','gear-visor'),0)).status,'stale');
  assert.equal((await apply(equip('hat','gear-visor'),1)).status,'applied');
  const swapped=await read();assert.equal(swapped.projection.totals.hp,before.projection.totals.hp);assert.equal(swapped.projection.totals.speed,before.projection.totals.speed+2);
  assert.equal((await apply(equip('hat',null),2)).status,'applied');
  assert.equal((await apply({kind:'title',titleId:'veterano'},3)).status,'applied');
  const final=await read();assert.equal(final.projection.totals.attack,before.projection.totals.attack+2);
  // Build a genuine server-persistable regional input from the changed save.
  const saved=(await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[id])).rows[0].state;
  const frozen=await buildPersistedBattleSnapshot(saved,{regionId:1,speciesId:10,level:2});
  assert.ok(frozen);assert.equal(frozen.trainer.title,'veterano');
  assert.deepEqual(frozen.trainer.inventory,raw.inventory);
  assert.ok(core.canonicalFrozenCombatants(frozen));
  const forged=structuredClone(saved);const invalidRaw=JSON.parse(forged.journal.raw);invalidRaw.trainer.equipped={hat:'gloves'};forged.journal.raw=JSON.stringify(invalidRaw);
  assert.equal(await buildPersistedBattleSnapshot(forged,{regionId:1,speciesId:10,level:2}),null);
  assert.deepEqual(final.raw.inventory,raw.inventory);assert.deepEqual(final.raw.ballPocket,raw.ballPocket);assert.deepEqual(final.raw.evolutionStones,raw.evolutionStones);
  assert.deepEqual(final.projection.totals,core.canonicalOnlineGymTrainerBonuses(final.raw).totals);
  assert.equal((await reserveEncounter(pool,{accountId:id,actionId:randomUUID(),regionId:1,expectedRevision:4})).status,'reserved');
  assert.equal((await apply(equip('hat','gear-cap'),5)).status,'busy');
  const bad=structuredClone(raw);delete bad.inventory;assert.equal(core.onlineInventoryProjection(JSON.stringify(bad)),null);
  bad.inventory={version:1,gear:[{"id":"gear-cap","source":"drop","templateId":"cap","slot":"hat","rarity":"common","regionId":1,"requiredLevel":1,"stats":{"hp":2}}],extraBagSlots:0};bad.trainer.equipped={hat:'gear-visor'};
  assert.equal(core.onlineInventoryProjection(JSON.stringify(bad)),null);
  const receipts=await pool.query("SELECT count(*)::int AS n FROM game_action_receipts WHERE account_id=$1 AND kind IN ('trainer-title','trainer-equipment')",[id]);assert.equal(receipts.rows[0].n,4);
 }finally{if(id)await pool.query('DELETE FROM game_accounts WHERE id=$1',[id]);await pool.end();}
});


test('D4C1: full bag retains certified drops; resolve once under the save lock',async()=>{
 const db=new URL(process.env.DATABASE_URL);assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'55432');assert.equal(db.pathname,'/kanto_ci');assert.equal(db.username,'kanto_ci');
 const pool=new pg.Pool({connectionString:db.href});let id;
 try{
  id=(await pool.query("INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id",['loot-'+randomUUID()+'@example.test','x'.repeat(48)])).rows[0].id;
  const save=firstSave('Loot CI',4,1740000000000),core=await loadCombatAdapter();
  const encounterId=randomUUID(),gear={templateId:'cap',slot:'hat',rarity:'common',requiredLevel:1,regionId:1,stats:{hp:2}};
  const raw=JSON.parse(save.journal.raw);
  raw.inventory.gear=Array.from({length:9},(_,i)=>({...gear,source:'drop',id:'gear-owned-'+i}));
  raw.trainer.level=40;raw.roster[0].level=80;
  const before=JSON.stringify(raw),paid=structuredClone(raw);paid.ballPocket.quantities['poke-ball']++;
  const input={encounterId,regionId:1,speciesId:4,outcome:'win',gear,stone:'fire-stone',ballId:'poke-ball'};
  const placed=core.placeCertifiedRegionalLoot(before,JSON.stringify(paid),input);
  assert.ok(placed);assert.equal(placed.ballQuantity,1);assert.equal(placed.stored.length,1);assert.equal(placed.pending.length,2);
  const state=JSON.parse(placed.raw);assert.equal(state.coins,0);assert.equal(state.roster[0].level,80);assert.equal(state.ballPocket.quantities['poke-ball'],13);assert.equal(state.inventory.gear.length,9);
  assert.equal(core.onlineInventoryProjection(placed.raw).bag.used,10);
  assert.equal(core.placeCertifiedRegionalLoot(placed.raw,placed.raw,input),null);
  assert.equal(core.placeCertifiedRegionalLoot(before,JSON.stringify(paid),{...input,stone:'thunder-stone'}),null);
  assert.equal(core.placeCertifiedRegionalLoot(before,JSON.stringify(paid),{...input,outcome:'loss'}),null);
  save.journal.raw=placed.raw;
  await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[id,JSON.stringify(save)]);
  const apply=(command,expectedRevision,actionId=randomUUID())=>changeTrainerLoadout(pool,{accountId:id,actionId,expectedRevision,command});
  const pendingGear=placed.pending.find(i=>i.kind==='gear').gear;
  const store={kind:'loot-store',encounterId,itemId:pendingGear.id};
  assert.equal((await reserveEncounter(pool,{accountId:id,actionId:randomUUID(),regionId:1,expectedRevision:0})).status,'busy');
  assert.equal((await apply(store,0)).status,'bag-full');
  assert.equal((await apply({...store,encounterId:randomUUID()},0)).status,'unavailable');
  assert.equal((await apply({kind:'discard-gear',itemId:'gear-owned-0'},0)).status,'applied');
  const actionId=randomUUID();const race=await Promise.all([apply(store,1,actionId),apply(store,1,actionId)]);
  assert.deepEqual(race.map(i=>i.status).sort(),['applied','duplicate']);
  assert.equal((await apply(store,2)).status,'unavailable');
  assert.equal((await apply({kind:'loot-discard',encounterId,itemId:'fire-stone'},2)).status,'applied');
  const after=JSON.parse((await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[id])).rows[0].state.journal.raw);
  assert.equal(after.pendingRegionalLoot,undefined);assert.equal(after.inventory.gear.filter(i=>i.id===pendingGear.id).length,1);
  assert.equal(after.ballPocket.quantities['poke-ball'],13);assert.deepEqual(after.evolutionStones,{});assert.equal(after.coins,0);
  assert.equal((await reserveEncounter(pool,{accountId:id,actionId:randomUUID(),regionId:1,expectedRevision:3})).status,'reserved');
 }finally{if(id)await pool.query('DELETE FROM game_accounts WHERE id=$1',[id]);await pool.end();}
});

test('REF02: private reforge save lock, material balance, favorite and one receipt',async()=>{
 const db=new URL(process.env.DATABASE_URL);assert.equal(db.hostname,'127.0.0.1');assert.equal(db.port,'55432');assert.equal(db.pathname,'/kanto_ci');assert.equal(db.username,'kanto_ci');
 const pool=new pg.Pool({connectionString:db.href});let id;
 try{
  id=(await pool.query("INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id",['reforge-'+randomUUID()+'@example.test','x'.repeat(48)])).rows[0].id;
  const save=firstSave('Reforge CI',4,1740000000000),core=await loadCombatAdapter();
  const raw=JSON.parse(save.journal.raw),gear={source:'drop',templateId:'cap',slot:'hat',rarity:'common',regionId:1,requiredLevel:1,stats:{hp:2}};
  raw.inventory.gear=[{...gear,id:'gear-reforge-1'},{...gear,id:'gear-reforge-2'},{...gear,id:'gear-reforge-3'}];raw.inventory.reforgeFragments=10;
  raw.trainer.equipped={hat:'gear-reforge-1'};
  save.journal.raw=JSON.stringify(raw);
  await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[id,JSON.stringify(save)]);
  const cmd=(kind,itemId,extra={})=>({kind,itemId,...extra});
  const apply=(command,expectedRevision,actionId=randomUUID())=>changeOnlineReforge(pool,{accountId:id,actionId,expectedRevision,command});
  const legacy=(command,expectedRevision)=>changeTrainerLoadout(pool,{accountId:id,actionId:randomUUID(),expectedRevision,command});
  const read=async()=>{const row=(await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',[id])).rows[0];return {revision:Number(row.revision),state:JSON.parse(row.state.journal.raw),view:core.onlineReforgeProjection(row.state.journal.raw)};};
  assert.equal((await apply(cmd('salvage','gear-reforge-1'),0)).status,'protected');
  assert.equal((await apply(cmd('upgrade','gear-reforge-1',{roll:0}),0)).status,'invalid');
  assert.equal((await apply(cmd('upgrade','gear-foreign'),0)).status,'unavailable');
  assert.equal((await legacy(cmd('upgrade','gear-reforge-1'),0)).status,'invalid');
  const actionId=randomUUID(),upgrade=cmd('upgrade','gear-reforge-1');
  const race=await Promise.all([apply(upgrade,0,actionId),apply(upgrade,0,actionId)]);
  assert.deepEqual(race.map(x=>x.status).sort(),['applied','duplicate']);
  assert.equal(race.find(x=>x.status==='applied').reforge.rank,1);
  assert.equal((await read()).view.fragments,0);
  assert.equal((await apply(upgrade,1)).status,'insufficient-fragments');
  assert.equal((await apply(cmd('favorite','gear-reforge-2',{favorite:true}),1)).status,'applied');
  assert.equal((await apply(cmd('salvage','gear-reforge-2'),2)).status,'protected');
  assert.equal((await legacy(cmd('discard-gear','gear-reforge-2'),2)).status,'protected');
  assert.equal((await apply(cmd('salvage','gear-reforge-3'),2)).status,'applied');
  const after=await read();assert.equal(after.revision,3);assert.equal(after.view.fragments,5);
  assert.equal(after.view.gear.length,2);assert.equal(after.view.gear.find(g=>g.id==='gear-reforge-1').rank,1);
  assert.deepEqual(after.state.inventory.gear[0].stats,gear.stats);assert.deepEqual(after.state.trainer,raw.trainer);
  assert.equal(after.state.coins,raw.coins);assert.deepEqual(after.state.ballPocket,raw.ballPocket);
  const receipts=await pool.query('SELECT count(*)::int AS n FROM game_action_receipts WHERE account_id=$1',[id]);assert.equal(receipts.rows[0].n,3);
  assert.equal((await reserveEncounter(pool,{accountId:id,actionId:randomUUID(),regionId:1,expectedRevision:3})).status,'reserved');
  assert.equal((await apply(cmd('favorite','gear-reforge-2',{favorite:false}),4)).status,'busy');
 }finally{if(id)await pool.query('DELETE FROM game_accounts WHERE id=$1',[id]);await pool.end();}
});
