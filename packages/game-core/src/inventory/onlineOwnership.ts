/** D4B: online-only individual gear. Local /play inventory is a different contract. */
import {LEGACY_ITEMS} from '../legacy/catalog.js';
import {regionalLootPolicy,LOOT_RARITIES,LOOT_AFFIX_COUNT} from './regionalLoot.js';
import type {ProceduralGearRoll,LootRarity} from './regionalLoot.js';
import {STATS} from '../stats/types.js';
import type {StatBonus} from '../stats/types.js';
import {BASE_BAG_SLOTS} from './ownership.js';
export interface OnlineGearInstance extends ProceduralGearRoll {
 readonly id:string;
 readonly source:'drop';
}
export interface OnlineInventory {
 readonly version:1;
 readonly gear:readonly OnlineGearInstance[];
 readonly extraBagSlots:number;
}
const rec=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
export function inspectOnlineGear(v:unknown):OnlineGearInstance|null{
 if(!rec(v)||Object.keys(v).sort().join(',')!=='id,rarity,regionId,requiredLevel,slot,source,stats,templateId'||
  typeof v.id!=='string'||!/^gear-[a-z0-9-]{1,64}$/.test(v.id)||v.source!=='drop'||!int(v.regionId,1,10)||
  typeof v.templateId!=='string'||typeof v.rarity!=='string'||!LOOT_RARITIES.includes(v.rarity as LootRarity)||!rec(v.stats))return null;
 const model=LEGACY_ITEMS.find(i=>i.id===v.templateId&&i.slot===v.slot),policy=regionalLootPolicy(v.regionId),rarity=v.rarity as LootRarity;
 if(!model||!policy||!policy.weights[LOOT_RARITIES.indexOf(rarity)]||!int(v.requiredLevel,policy.requiredMin,policy.requiredMax))return null;
 const min=Math.min(policy.maxBonus,policy.minBonus+(rarity==='common'?0:1));
 const entries=Object.entries(v.stats);
 if(entries.length!==LOOT_AFFIX_COUNT[rarity]||entries.some(([k,n])=>!(STATS as readonly string[]).includes(k)||!int(n,min,policy.maxBonus)))return null;
 return {id:v.id,source:'drop',templateId:model.id,slot:model.slot,rarity,regionId:v.regionId,requiredLevel:v.requiredLevel,stats:Object.fromEntries(entries) as StatBonus};
}
export function inspectOnlineInventory(v:unknown):OnlineInventory|null{
 if(!rec(v)||Object.keys(v).sort().join(',')!=='extraBagSlots,gear,version'||v.version!==1||!int(v.extraBagSlots,0,1000)||!Array.isArray(v.gear)||v.gear.length>BASE_BAG_SLOTS+v.extraBagSlots+9)return null;
 const gear:OnlineGearInstance[]=[],ids=new Set<string>();
 for(const raw of v.gear){const item=inspectOnlineGear(raw);if(!item||ids.has(item.id))return null;ids.add(item.id);gear.push(item);}
 return {version:1,extraBagSlots:v.extraBagSlots,gear};
}
export function onlineGearForSlot(inventory:OnlineInventory,itemId:string,slot:string,trainerLevel:number){
 return inventory.gear.find(i=>i.id===itemId&&i.slot===slot&&i.requiredLevel<=trainerLevel)??null;
}
/** Server constructs ID from encounter identity, never from the browser. */
export function createOnlineDropGear(encounterId:string,roll:ProceduralGearRoll){
 if(typeof encounterId!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(encounterId))return null;
 return inspectOnlineGear({...roll,id:'gear-'+encounterId.toLowerCase(),source:'drop'});
}
