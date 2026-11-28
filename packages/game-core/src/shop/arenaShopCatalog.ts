/** ARENA05 candidate prices, all purchases use Points of Arena only.
 * Fixed offers deliberately avoid random identity or attributes at checkout.
 * Gear uses the existing regional rarity, affix and level constraints.
 */
import {KANTO_MACHINES} from '../catalog/kantoMachines.js';
import {KANTO_EVOLUTION_STONES} from '../catalog/kantoEvolution.js';
import {executableMachineMove} from '../combat/machineLessonCatalog.js';
import {machineRarity} from '../inventory/machineLoot.js';
import {regionalLootPolicy,LOOT_AFFIX_COUNT} from '../inventory/regionalLoot.js';
import type {LootRarity,ProceduralGearRoll} from '../inventory/regionalLoot.js';
import {LEGACY_ITEMS} from '../legacy/catalog.js';
import {STATS} from '../stats/types.js';
const TM_PRICE:Record<LootRarity,number>={common:15,uncommon:25,rare:40,epic:60,legendary:90};
const GEAR_TIERS=[{rarity:'rare',regionId:6,cost:55},{rarity:'epic',regionId:8,cost:100},{rarity:'legendary',regionId:10,cost:160}] as const;
export type ArenaOffer=
 | {id:string;kind:'tm';itemId:string;name:string;rarity:LootRarity;cost:number;weeklyLimit:number}
 | {id:string;kind:'stone';itemId:string;name:string;cost:number;weeklyLimit:number}
 | {id:string;kind:'gear';itemId:string;name:string;rarity:LootRarity;cost:number;weeklyLimit:number;gear:ProceduralGearRoll};
const tms:ArenaOffer[]=KANTO_MACHINES.flatMap(tm=>{
 const rarity=machineRarity(tm.id);
 if(!rarity||!executableMachineMove(tm.moveName))return [];
 return [{id:tm.id,kind:'tm',itemId:tm.id,name:tm.id.toUpperCase()+' · '+tm.moveName,rarity,cost:TM_PRICE[rarity],weeklyLimit:rarity==='epic'||rarity==='legendary'?1:3}];
});
const stones:ArenaOffer[]=KANTO_EVOLUTION_STONES.map(s=>({id:s.id,kind:'stone',itemId:s.id,name:s.name,cost:20,weeklyLimit:3}));
const gear:ArenaOffer[]=GEAR_TIERS.flatMap(t=>LEGACY_ITEMS.map(model=>{
 const policy=regionalLootPolicy(t.regionId)!;
 const order=[...new Set([...Object.keys(model.stats),...STATS])].slice(0,LOOT_AFFIX_COUNT[t.rarity]);
 const value=Math.min(policy.maxBonus,policy.minBonus+1);
 const roll:ProceduralGearRoll={templateId:model.id,slot:model.slot,rarity:t.rarity,regionId:t.regionId,requiredLevel:policy.requiredMin,stats:Object.fromEntries(order.map(k=>[k,value]))};
 return {id:'arena-'+t.rarity+'-'+model.id,kind:'gear',itemId:model.id,name:model.name,rarity:t.rarity,cost:t.cost,weeklyLimit:1,gear:roll};
}));
export const ARENA_SHOP_VERSION=1;
export const ARENA_GEAR_WEEKLY_LIMIT=1;
export function arenaShopCatalog():readonly ArenaOffer[]{return structuredClone([...tms,...stones,...gear]);}
export function arenaShopOffer(id:unknown):ArenaOffer|null{return arenaShopCatalog().find(o=>o.id===id)??null;}
