import {describe,it,expect} from 'vitest';
import {createOnlineArenaGear,createOnlineShopGear,inspectOnlineGear,inspectOnlineInventory} from '../src/inventory/onlineOwnership.js';
import {reforgeQuote,reforgeStats,reforgeRoll,reforgeSalvage} from '../src/inventory/reforgeRules.js';
import {applyReforgeInventory,reforgeInventoryProjection} from '../src/inventory/serverReforge.js';
import {ARENA_LEGENDARY_TEMPLATES} from '../src/shop/arenaGearCatalog.js';
import {arenaSetProjection,applyArenaSetStats} from '../src/stats/arenaSet.js';
import {regionalLootPolicy} from '../src/inventory/regionalLoot.js';
import {STATS,zeroStats} from '../src/stats/types.js';
const id=(i:number)=>'01234567-89ab-4cde-8fab-'+String(i).padStart(12,'0');
const gear=ARENA_LEGENDARY_TEMPLATES.map((t,i)=>createOnlineArenaGear(id(i+1),'arena-legendary-'+t.slot,['hp','attack','defense','speed'])!);
const common=createOnlineShopGear(id(20),'cap')!;
const inventory={version:1,extraBagSlots:10,gear:[...gear,common],reforgeFragments:10000};
describe('REF01 reinforcement and exclusive Arena set',()=>{
 it('checks rarity caps, costs, probability boundaries and immutable affixes',()=>{
  expect(reforgeQuote('legendary',5,true)).toMatchObject({target:6,cost:4800,success:10,stay:40,regress:50});
  expect(reforgeQuote('epic',5)).toBeNull();
  expect(reforgeQuote('legendary',6,true)).toBeNull();
  expect(reforgeRoll('legendary',5,999,true)).toEqual({outcome:'success',rank:6});
  expect(reforgeRoll('legendary',5,1000,true)).toEqual({outcome:'stay',rank:5});
  expect(reforgeRoll('legendary',5,4999,true)).toEqual({outcome:'stay',rank:5});
  expect(reforgeRoll('legendary',5,5000,true)).toEqual({outcome:'regress',rank:4});
  expect(reforgeRoll('legendary',5,10000,true)).toBeNull();
  expect(reforgeStats(gear[0]!.stats,6)).toEqual({hp:24,attack:24,defense:24,speed:24});
  expect(inspectOnlineGear({...common,enhancement:6})).toBeNull();
  expect(inspectOnlineGear({...gear[0],enhancement:6})).not.toBeNull();
  expect(inspectOnlineGear({...gear[0],enhancement:6,stats:{...gear[0]!.stats,hp:24}})).toBeNull();
  expect(inspectOnlineInventory({...inventory,reforgeFragments:-1})).toBeNull();
  expect(reforgeSalvage('legendary',6,true)).toBe(240);
 });
 it('rejects rank six for a genuine regional legendary and any forged Arena identity',()=>{
  const regional=inspectOnlineGear({id:'gear-regional-legendary',source:'drop',templateId:'cap',slot:'hat',rarity:'legendary',regionId:10,requiredLevel:regionalLootPolicy(10)!.requiredMin,stats:{hp:8,attack:8,defense:8,speed:8},enhancement:5})!;
  expect(regional).not.toBeNull();
  expect(reforgeQuote('legendary',5)).toBeNull();
  expect(reforgeRoll('legendary',5,0)).toBeNull();
  expect(reforgeSalvage('legendary',6)).toBeNull();
  expect(inspectOnlineGear({...regional,enhancement:6})).toBeNull();
  expect(inspectOnlineGear({...regional,source:'arena',enhancement:6})).toBeNull();
  expect(inspectOnlineGear({...regional,templateId:'arena-hat',enhancement:6})).toBeNull();
  const raw={...inventory,gear:[regional]};
  expect(reforgeInventoryProjection(raw,[])?.gear[0]).toMatchObject({rank:5,maxRank:5,next:null,nextStats:null});
  expect(applyReforgeInventory(raw,[],{kind:'upgrade',itemId:regional.id},0).status).toBe('max-rank');
  for(const item of gear){
   const candidate={...inventory,gear:[{...item,enhancement:5}]};
   expect(reforgeInventoryProjection(candidate,[])?.gear[0]).toMatchObject({maxRank:6,next:{target:6}});
   expect(applyReforgeInventory(candidate,[],{kind:'upgrade',itemId:item.id},0)).toMatchObject({status:'ok',rank:6});
  }
 });
 it('consumes full cost in all outcomes, never destroys an upgraded item, and protects dismantling',()=>{
  const first={...gear[0]!,enhancement:5};
  const before={...inventory,gear:[first,...gear.slice(1),common]};
  const command={kind:'upgrade',itemId:first.id};
  for(const [roll,rank,outcome] of [[0,6,'success'],[1000,5,'stay'],[9999,4,'regress']] as const){
   const result=applyReforgeInventory(before,[],command,roll);
   if(result.status!=='ok'||result.kind!=='upgrade')throw Error(result.status);
   expect(result).toMatchObject({rank,outcome,cost:4800,previousRank:5});
   expect(result.inventory.reforgeFragments).toBe(5200);
   expect(result.inventory.gear[0]).toMatchObject({enhancement:rank,stats:first.stats,id:first.id});
   expect(result.inventory.gear).toHaveLength(before.gear.length);
  }
  expect(applyReforgeInventory({...before,reforgeFragments:0},[],command,0).status).toBe('insufficient-fragments');
  expect(applyReforgeInventory(before,[],{...command,roll:0},0).status).toBe('invalid');
  expect(applyReforgeInventory(before,[first.id],{kind:'salvage',itemId:first.id}).status).toBe('protected');
  const protectedResult=applyReforgeInventory(before,[],{kind:'favorite',itemId:first.id,favorite:true});
  if(protectedResult.status!=='ok')throw Error(protectedResult.status);
  expect(applyReforgeInventory(protectedResult.inventory,[],{kind:'salvage',itemId:first.id}).status).toBe('protected');
  const salvage=applyReforgeInventory(before,[],{kind:'salvage',itemId:first.id});
  if(salvage.status!=='ok'||salvage.kind!=='salvage')throw Error(salvage.status);
  expect(salvage.gain).toBe(225);
  expect(salvage.inventory.gear.some(g=>g.id===first.id)).toBe(false);
  expect(before.gear[0]!.enhancement).toBe(5);
  expect(reforgeInventoryProjection(before,[])?.gear[0]?.rank).toBe(5);
 });
 it('counts distinct equipped exclusive pieces only and adds the tier only to the leader',()=>{
  const equipped=gear.map(g=>({itemId:g.id,slot:g.slot}));
  for(const [count,bonus] of [[0,0],[1,0],[2,0],[3,3],[4,3],[5,3],[6,6],[7,6],[8,6],[9,10]] as const){
   const set=arenaSetProjection(inventory,equipped.slice(0,count),100);
   expect(set).toMatchObject({count,bonus});
   expect(STATS.every(s=>applyArenaSetStats(zeroStats(),set!.bonus,true)[s]===bonus)).toBe(true);
   expect(applyArenaSetStats(zeroStats(),set!.bonus,false)).toEqual(zeroStats());
  }
  expect(arenaSetProjection(inventory,[equipped[0]!,equipped[0]!],100)).toBeNull();
  expect(arenaSetProjection(inventory,equipped,1)).toBeNull();
  expect(arenaSetProjection(inventory,[{itemId:common.id,slot:common.slot}],100)).toMatchObject({count:0,bonus:0});
 });
});
