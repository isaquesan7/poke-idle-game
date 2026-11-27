/** D4C1: pure item placement after canonical battle payout, called ONLY by
 * the private certified-turn settlement. All changes are committed together
 * with the existing save/encounter/receipt transaction by the API.
 */
import {KANTO_MEGA_FORMS,inspectMegaStoneStock} from '../catalog/kantoMegaForms.js';
import type {KantoMegaStoneId} from '../catalog/kantoMegaForms.js';
import {regionalMegaStonePool} from './megaStoneLoot.js';
import {kantoMachine,inspectMachineStock} from '../catalog/kantoMachines.js';
import type {KantoMachineId} from '../catalog/kantoMachines.js';
import {machineRarity,regionalMachinePool} from './machineLoot.js';
import {onlineInventoryProjection} from './serverInventory.js';
import {inspectOnlineGear,createOnlineDropGear} from './onlineOwnership.js';
import type {OnlineGearInstance} from './onlineOwnership.js';
import {eligibleEvolutionStones} from './regionalLoot.js';
import type {ProceduralGearRoll} from './regionalLoot.js';
import {KANTO_EVOLUTION_STONES} from '../catalog/kantoEvolution.js';
import {KANTO_BALLS} from '../capture/kantoBalls.js';
import type {KantoBallId} from '../capture/kantoBalls.js';
import type {KantoEvolutionStone} from '../catalog/kantoEvolution.js';

export type RegionalLootItem=
 | {readonly kind:'ball';readonly itemId:KantoBallId;readonly quantity:1}
 | {readonly kind:'stone';readonly itemId:KantoEvolutionStone;readonly quantity:1}
 | {readonly kind:'tm';readonly itemId:KantoMachineId;readonly quantity:1}
 | {readonly kind:'mega-stone';readonly itemId:KantoMegaStoneId;readonly quantity:1}
 | {readonly kind:'gear';readonly gear:OnlineGearInstance};
export interface PendingRegionalLoot{
 readonly encounterId:string;readonly items:readonly RegionalLootItem[];
}
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const rec=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const key=(item:RegionalLootItem)=>item.kind==='gear'?item.gear.id:item.itemId;
export function inspectPendingRegionalLoot(value:unknown):PendingRegionalLoot|null{
 if(!rec(value)||Object.keys(value).sort().join(',')!=='encounterId,items'||typeof value.encounterId!=='string'||!UUID.test(value.encounterId)||!Array.isArray(value.items)||value.items.length<1||value.items.length>5)return null;
 const items:RegionalLootItem[]=[],kinds=new Set<string>();
 for(const item of value.items){
  if(!rec(item)||typeof item.kind!=='string'||kinds.has(item.kind))return null;
  if(item.kind==='gear'){
   if(Object.keys(item).sort().join(',')!=='gear,kind')return null;
   const gear=inspectOnlineGear(item.gear);if(!gear||gear.id!=='gear-'+value.encounterId.toLowerCase())return null;
   items.push({kind:'gear',gear});
  }else if(item.kind==='ball'||item.kind==='stone'||item.kind==='tm'||item.kind==='mega-stone'){
   if(Object.keys(item).sort().join(',')!=='itemId,kind,quantity'||typeof item.itemId!=='string'||item.quantity!==1)return null;
   if(item.kind==='ball'){
    if(!Object.hasOwn(KANTO_BALLS,item.itemId))return null;
    items.push({kind:'ball',itemId:item.itemId as KantoBallId,quantity:1});
   }else if(item.kind==='mega-stone'){
    const form=KANTO_MEGA_FORMS.find(f=>f.stoneId===item.itemId);if(!form)return null;
    items.push({kind:'mega-stone',itemId:form.stoneId,quantity:1});
   }else if(item.kind==='tm'){
    const tm=kantoMachine(item.itemId);if(!tm)return null;
    items.push({kind:'tm',itemId:tm.id,quantity:1});
   }else{
    if(!KANTO_EVOLUTION_STONES.some(s=>s.id===item.itemId))return null;
    items.push({kind:'stone',itemId:item.itemId as KantoEvolutionStone,quantity:1});
   }
  }else return null;
  kinds.add(item.kind);
 }
 return {encounterId:value.encounterId,items};
}
/** One item at a time, in fixed ball → stone → gear order.
 * Existing consumable stacks accept another unit without using a slot.
 * No item is silently deleted and the existing save is not mutated on failure.
 */
function tryStore(state:any,item:RegionalLootItem):boolean|null{
 const view=onlineInventoryProjection(JSON.stringify(state));if(!view)return null;
 if(item.kind==='gear'){
  if(state.inventory.gear.some((g:OnlineGearInstance)=>g.id===item.gear.id))return null;
  if(!view.bag.available)return false;
  state.inventory.gear.push(item.gear);return true;
 }
 if(item.kind==='mega-stone'){
  const stock=inspectMegaStoneStock(state.megaStoneStock);if(!stock)return null;
  const old=stock[item.itemId]??0;if(old>=100000)return false;
  state.megaStoneStock={...stock,[item.itemId]:old+1};return true;
 }
 if(item.kind==='tm'){
  const stock=inspectMachineStock(state.machineStock);if(!stock)return null;
  const old=stock[item.itemId]??0;if(old>=100000)return false;
  state.machineStock={...stock,[item.itemId]:old+1};return true;
 }
 const pocket=item.kind==='ball'?state.ballPocket.quantities:state.evolutionStones;
 const old=pocket[item.itemId]??0;
 if(!Number.isSafeInteger(old)||old<0)return null;
 if(old>=100000||(!old&&!view.bag.available))return false;
 pocket[item.itemId]=old+1;return true;
}
export function placeCertifiedRegionalLoot(beforeRaw:string,paidRaw:string,input:{
 encounterId:string;regionId:number;speciesId:number;outcome:string;
 gear:ProceduralGearRoll|null;stone:KantoEvolutionStone|null;ballId:KantoBallId|null;tmId?:KantoMachineId|null;megaStoneId?:KantoMegaStoneId|null;
}){
 try{
  if(!UUID.test(input.encounterId)||!['win','loss','draw'].includes(input.outcome))return null;
  const before=JSON.parse(beforeRaw),state=JSON.parse(paidRaw);
  if(before.pendingRegionalLoot!=null||state.pendingRegionalLoot!=null||!onlineInventoryProjection(beforeRaw)||!onlineInventoryProjection(paidRaw))return null;
  if(input.outcome!=='win'&&(input.gear||input.stone||input.ballId||input.tmId||input.megaStoneId))return null;
  const items:RegionalLootItem[]=[];
  // The base payout already credited a ball. Reverse only this validated
  // increment, then re-place it using the shared capacity rule.
  if(input.ballId){
   if(!Object.hasOwn(KANTO_BALLS,input.ballId))return null;
   const old=before.ballPocket.quantities[input.ballId]??0,after=state.ballPocket.quantities[input.ballId]??0;
   if(after!==Math.min(100000,old+1))return null;
   state.ballPocket.quantities[input.ballId]=old;
   items.push({kind:'ball',itemId:input.ballId,quantity:1});
  }
  if(input.stone){
   if(!eligibleEvolutionStones(input.speciesId).includes(input.stone))return null;
   items.push({kind:'stone',itemId:input.stone,quantity:1});
  }
  if(input.tmId){
   const rarity=machineRarity(input.tmId);
   if(!rarity||!regionalMachinePool(input.regionId,rarity).some(m=>m.id===input.tmId))return null;
   items.push({kind:'tm',itemId:input.tmId,quantity:1});
  }
  if(input.megaStoneId){
   if(!regionalMegaStonePool(input.regionId).includes(input.megaStoneId))return null;
   items.push({kind:'mega-stone',itemId:input.megaStoneId,quantity:1});
  }
  if(input.gear){
   if(input.gear.regionId!==input.regionId)return null;
   const gear=createOnlineDropGear(input.encounterId,input.gear);if(!gear)return null;
   items.push({kind:'gear',gear});
  }
  const stored:RegionalLootItem[]=[],pending:RegionalLootItem[]=[];
  for(const item of items){
   const result=tryStore(state,item);if(result===null)return null;
   (result?stored:pending).push(item);
  }
  if(pending.length)state.pendingRegionalLoot={encounterId:input.encounterId,items:pending};
  const raw=JSON.stringify(state);
  if(!onlineInventoryProjection(raw))return null;
  return {raw,stored,pending,ballQuantity:stored.some(i=>i.kind==='ball')?1:0};
 }catch{return null;}
}
/** Resolve an already recorded pending item, no caller supplied stats/counts. */
export function resolvePendingRegionalLoot(raw:string,command:unknown){
 if(!rec(command)||Object.keys(command).sort().join(',')!=='encounterId,itemId,kind'||typeof command.itemId!=='string'||!['loot-store','loot-discard'].includes(String(command.kind)))return {status:'invalid'} as const;
 try{
  const state=JSON.parse(raw),pending=inspectPendingRegionalLoot(state.pendingRegionalLoot);
  if(!pending||pending.encounterId!==command.encounterId)return {status:'unavailable'} as const;
  const item=pending.items.find(i=>key(i)===command.itemId);if(!item)return {status:'unavailable'} as const;
  if(command.kind==='loot-store'){
   const stored=tryStore(state,item);
   if(stored===null)return {status:'invalid-save'} as const;
   if(!stored)return {status:'bag-full'} as const;
  }
  const remaining=pending.items.filter(i=>key(i)!==command.itemId);
  if(remaining.length)state.pendingRegionalLoot={encounterId:pending.encounterId,items:remaining};
  else delete state.pendingRegionalLoot;
  const next=JSON.stringify(state),projection=onlineInventoryProjection(next);
  return projection?{status:'ok',raw:next,totals:projection.totals} as const:{status:'invalid-save'} as const;
 }catch{return {status:'invalid-save'} as const;}
}

/** Explicitly discard only an owned, unequipped instance. Never auto-delete. */
export function discardOnlineGear(raw:string,command:unknown){
 if(!rec(command)||Object.keys(command).sort().join(',')!=='itemId,kind'||command.kind!=='discard-gear'||typeof command.itemId!=='string')return {status:'invalid'} as const;
 const projection=onlineInventoryProjection(raw);if(!projection)return {status:'invalid-save'} as const;
 const current=JSON.parse(raw);
 // During an expedition only free a bag slot for an existing overflow; never alter equipped gear or team.
 if(projection.busy&&!(current.expedition&&current.pendingExpeditionLoot&&current.pendingBattle==null&&current.gymSession==null&&current.lastBattle?.captureStatus!=='available'))return {status:'busy'} as const;
 const item=projection.equipment.find(i=>i.id===command.itemId&&!i.equipped);if(!item)return {status:'unavailable'} as const;
 const state=JSON.parse(raw);state.inventory.gear=state.inventory.gear.filter((i:OnlineGearInstance)=>i.id!==item.id);
 const next=JSON.stringify(state),view=onlineInventoryProjection(next);
 return view?{status:'ok',raw:next,totals:view.totals} as const:{status:'invalid-save'} as const;
}
