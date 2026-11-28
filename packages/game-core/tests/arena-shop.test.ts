import {describe,it,expect} from 'vitest';
import {ARENA_LEGENDARY_TEMPLATES} from '../src/shop/arenaGearCatalog.js';
import {LEGACY_ITEMS} from '../src/legacy/catalog.js';
import {onlineInventoryProjection,applyOnlineTrainerLoadout} from '../src/inventory/serverInventory.js';
import {arenaShopCatalog} from '../src/shop/arenaShopCatalog.js';
import {onlineArenaShopProjection,applyOnlineArenaPurchase} from '../src/shop/serverArenaShop.js';
import {inspectOnlineGear,createOnlineArenaGear,createOnlineDropGear,createOnlineShopGear} from '../src/inventory/onlineOwnership.js';
import {executableMachineMove} from '../src/combat/machineLessonCatalog.js';
import {kantoMachine} from '../src/catalog/kantoMachines.js';
import {ARENA_WEEK_MS} from '../src/progression/weeklyArena.js';
import {zeroStats} from '../src/stats/types.js';
const now=Date.UTC(2026,10,23,3),id='01234567-89ab-4cde-8fab-0123456789ab';
const fixture=(balance=600)=>({version:1,mode:'normal',trainer:{level:100,xp:0,manual:zeroStats(),equipped:{},title:'aprendiz'},inventory:{version:1,gear:[] as unknown[],extraBagSlots:0},seen:[4],badges:[],coins:100,wins:0,losses:0,roster:[1,2,3].map(uid=>({uid,pokemonId:4,level:5,xp:0,affinity:0,manual:zeroStats(),moveName:'scratch'})),team:[1,2,3],nextUid:4,expedition:null,evolutionStones:{},ballPocket:{version:1,quantities:{'poke-ball':12}},weeklyArena:{version:1,balance,progress:{weekStartMs:now,paidThrough:0,run:null}},research:{points:{},favorites:[],totalSent:0,history:[]}});
function ok<T extends {status:string}>(v:T):Extract<T,{status:'ok'}>{if(v.status!=='ok')throw Error(v.status);return v as Extract<T,{status:'ok'}>;}
describe('ARENA05 private catalog and checkout',()=>{
 it('lists only executable TMs and canonical gear, with no duplicate IDs or forbidden items',()=>{
  const catalog=arenaShopCatalog();expect(new Set(catalog.map(o=>o.id)).size).toBe(catalog.length);
  expect(catalog.filter(o=>o.kind==='stone')).toHaveLength(5);
  for(const offer of catalog){
   expect(offer.cost).toBeGreaterThan(0);
   if(offer.kind==='tm')expect(executableMachineMove(kantoMachine(offer.itemId)!.moveName)).not.toBeNull();
   if(offer.kind==='gear'){
    const attrs=offer.attributeSelection?['attack','defense','specialAttack','speed']:undefined;
    const item=createOnlineArenaGear(id,offer.id,attrs);
    expect(item).toMatchObject({templateId:offer.gear.templateId,rarity:offer.rarity,source:'arena'});
    expect(inspectOnlineGear({...item,stats:{hp:999}})).toBeNull();
   }
  }
 });
 it('reserves nine exclusive identities for Arena purchases only',()=>{
  const offers=arenaShopCatalog().filter(o=>o.kind==='gear'&&o.rarity==='legendary');
  expect(offers).toHaveLength(9);
  expect(new Set(ARENA_LEGENDARY_TEMPLATES.map(t=>t.slot)).size).toBe(9);
  for(const offer of offers){
   if(offer.kind!=='gear')throw Error('not gear');
   expect(LEGACY_ITEMS.some(m=>m.id===offer.itemId)).toBe(false);
   const instance=createOnlineArenaGear(id,offer.id,['hp','attack','defense','speed'])!;
   expect(instance).not.toBeNull();
   expect(createOnlineDropGear(id,{...offer.gear,stats:instance.stats})).toBeNull();
   expect(createOnlineShopGear(id,offer.itemId)).toBeNull();
   expect(inspectOnlineGear({...instance,id:'gear-'+id,source:'drop'})).toBeNull();
   expect(inspectOnlineGear({...instance,templateId:'cap'})).toBeNull();
  }
 });
 it('spends points only, preserves gold, limits premium purchases across templates and renews stock',()=>{
  const before=fixture(),raw=JSON.stringify(before);
  const stone=ok(applyOnlineArenaPurchase(raw,now,'fire-stone',id));
  expect(stone.balance).toBe(560);expect(JSON.parse(stone.raw).evolutionStones['fire-stone']).toBe(1);
  const tm=ok(applyOnlineArenaPurchase(stone.raw,now,'tm26',id));
  expect(tm.balance).toBe(460);expect(JSON.parse(tm.raw).machineStock.tm26).toBe(1);
  expect(applyOnlineArenaPurchase(tm.raw,now,'tm26',id).status).toBe('weekly-limit');
  const gear=ok(applyOnlineArenaPurchase(tm.raw,now,'arena-legendary-hat',id,['attack','defense','specialDefense','speed']));
  expect(gear.balance).toBe(160);
  expect(JSON.parse(gear.raw).inventory.gear[0].stats).toEqual({attack:10,defense:10,specialDefense:10,speed:10});
  expect(applyOnlineArenaPurchase(tm.raw,now,'arena-legendary-hat',id).status).toBe('invalid');
  expect(applyOnlineArenaPurchase(tm.raw,now,'arena-legendary-hat',id,['hp','hp','speed','attack']).status).toBe('invalid');
  expect(applyOnlineArenaPurchase(tm.raw,now,'arena-legendary-hat',id,['hp','speed','attack','luck']).status).toBe('invalid');
  expect(applyOnlineArenaPurchase(tm.raw,now,'fire-stone',id,['hp','speed','attack','defense']).status).toBe('invalid');
  expect(JSON.parse(gear.raw).coins).toBe(before.coins);
  expect(JSON.parse(gear.raw).inventory.gear[0].source).toBe('arena');
  expect(onlineInventoryProjection(gear.raw)?.equipment[0]).toMatchObject({name:'Boné da Arena',templateId:'arena-hat'});
  expect(applyOnlineTrainerLoadout(gear.raw,{kind:'equipment',slot:'hat',itemId:JSON.parse(gear.raw).inventory.gear[0].id}).status).toBe('ok');
  expect(applyOnlineArenaPurchase(gear.raw,now,'arena-rare-coat',id).status).toBe('weekly-limit');
  const next=onlineArenaShopProjection(gear.raw,now+ARENA_WEEK_MS);
  expect(next).toMatchObject({balance:160,gearRemaining:1});
  expect(next?.offers.find(o=>o.id==='tm26')?.remaining).toBe(1);
 });
 it('refuses insufficient points, invalid item, full bag and invalid gear level without changing balance',()=>{
  expect(applyOnlineArenaPurchase(JSON.stringify(fixture(0)),now,'fire-stone',id).status).toBe('insufficient-points');
  expect(applyOnlineArenaPurchase(JSON.stringify(fixture()),now,'master-ball',id).status).toBe('invalid');
  const low=fixture();low.trainer.level=1;
  expect(applyOnlineArenaPurchase(JSON.stringify(low),now,'arena-legendary-hat',id).status).toBe('level');
  const full=fixture();full.inventory.gear=Array.from({length:9},(_,i)=>createOnlineArenaGear('01234567-89ab-4cde-8fab-0123456789a'+i,'arena-rare-cap'));
  expect(applyOnlineArenaPurchase(JSON.stringify(full),now,'fire-stone',id).status).toBe('bag-full');
  expect(applyOnlineArenaPurchase(JSON.stringify(full),now,'tm26',id).status).toBe('ok');
 });
});
