/** Private deterministic point checkout; caller must hold the save lock
 * and use database time. No public command can specify cost, item stats or UID.
 */
import {arenaShopCatalog,arenaShopOffer,ARENA_GEAR_WEEKLY_LIMIT,ARENA_SHOP_VERSION} from './arenaShopCatalog.js';
import {onlineArenaProgress} from '../progression/serverArenaProgress.js';
import {arenaWeek} from '../progression/weeklyArena.js';
import {onlineInventoryProjection} from '../inventory/serverInventory.js';
import {createOnlineArenaGear} from '../inventory/onlineOwnership.js';
import {inspectMachineStock,kantoMachine} from '../catalog/kantoMachines.js';
const rec=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const natural=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
function checked(raw:string,nowMs:number){
 const arena=onlineArenaProgress(raw,nowMs),inventory=onlineInventoryProjection(raw);
 if(!arena||!inventory)return null;
 const state=JSON.parse(raw),stock=inspectMachineStock(state.machineStock);
 if(!stock)return null;
 const saved=state.arenaShop;
 let counts:Record<string,number>={};
 if(saved!==undefined){
  if(!rec(saved)||Object.keys(saved).sort().join(',')!=='counts,version,weekStartMs'||saved.version!==1||
   !natural(saved.weekStartMs)||arenaWeek(saved.weekStartMs)?.startMs!==saved.weekStartMs||saved.weekStartMs>arena.startMs||!rec(saved.counts))return null;
  let gear=0;
  for(const [id,n] of Object.entries(saved.counts)){
   const offer=arenaShopOffer(id);if(!offer||!natural(n)||n>offer.weeklyLimit)return null;
   if(offer.kind==='gear')gear+=n;
  }
  if(gear>ARENA_GEAR_WEEKLY_LIMIT)return null;
  if(saved.weekStartMs===arena.startMs)counts={...saved.counts} as Record<string,number>;
 }
 const gearBought=Object.entries(counts).reduce((n,[id,count])=>n+(arenaShopOffer(id)?.kind==='gear'?count:0),0);
 const busy=arena.busy||!!arena.run;
 const offers=arenaShopCatalog().map(o=>{
  const tm=o.kind==='tm'?kantoMachine(o.itemId):null;
  const owned=o.kind==='tm'?(tm?stock[tm.id]??0:0):o.kind==='stone'?(state.evolutionStones[o.itemId]??0):inventory.equipment.filter(g=>g.templateId===o.itemId&&g.rarity===o.rarity).length;
  const remaining=Math.min(o.weeklyLimit-(counts[o.id]??0),o.kind==='gear'?ARENA_GEAR_WEEKLY_LIMIT-gearBought:o.weeklyLimit);
  const bagOk=o.kind==='tm'||(o.kind==='stone'&&owned>0)||inventory.bag.available>0;
  const levelOk=o.kind!=='gear'||state.trainer.level>=o.gear.requiredLevel;
  const stackOk=o.kind==='gear'||owned<100000;
  const reason=busy?'busy':remaining<=0?'weekly-limit':!levelOk?'level':!bagOk?'bag-full':!stackOk?'stack-full':arena.balance<o.cost?'insufficient-points':null;
  return {...o,owned,remaining,canBuy:reason===null,reason};
 });
 return {state,arena,stock,counts,gearBought,busy,offers};
}
export function onlineArenaShopProjection(raw:string,nowMs:number){
 const c=checked(raw,nowMs);return c?{version:ARENA_SHOP_VERSION,balance:c.arena.balance,weekStartMs:c.arena.startMs,busy:c.busy,
  gearRemaining:ARENA_GEAR_WEEKLY_LIMIT-c.gearBought,offers:c.offers}:null;
}
export function applyOnlineArenaPurchase(raw:string,nowMs:number,offerId:string,serverId:string){
 const c=checked(raw,nowMs);if(!c)return {status:'invalid-save'} as const;
 const o=c.offers.find(o=>o.id===offerId);if(!o)return {status:'invalid'} as const;
 if(!o.canBuy)return {status:o.reason??'unavailable'} as const;
 const state=c.state;let instanceId:string|null=null;
 if(o.kind==='gear'){
  const item=createOnlineArenaGear(serverId,o.id);
  if(!item||state.inventory.gear.some((g:{id:string})=>g.id===item.id))return {status:'invalid'} as const;
  state.inventory.gear.push(item);instanceId=item.id;
 }else if(o.kind==='tm'){
  const tm=kantoMachine(o.itemId);if(!tm)return {status:'invalid'} as const;
  state.machineStock={...c.stock,[tm.id]:(c.stock[tm.id]??0)+1};
 }else state.evolutionStones[o.itemId]=(state.evolutionStones[o.itemId]??0)+1;
 state.weeklyArena.balance=c.arena.balance-o.cost;
 state.arenaShop={version:1,weekStartMs:c.arena.startMs,counts:{...c.counts,[o.id]:(c.counts[o.id]??0)+1}};
 const next=JSON.stringify(state);
 if(!onlineArenaShopProjection(next,nowMs))return {status:'invalid-save'} as const;
 return {status:'ok',raw:next,balance:state.weeklyArena.balance,purchase:{offerId:o.id,itemId:o.itemId,kind:o.kind,quantity:1,cost:o.cost,instanceId}} as const;
}
