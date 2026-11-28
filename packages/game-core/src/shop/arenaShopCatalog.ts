/** ARENA05 candidate prices, all purchases use Points of Arena only.
 * Fixed identity, with four player-selected distinct affixes on legendary gear.
 * Gear uses the existing regional rarity, affix and level constraints.
 */
import {KANTO_MACHINES} from '../catalog/kantoMachines.js';
import {KANTO_EVOLUTION_STONES} from '../catalog/kantoEvolution.js';
import {executableMachineMove} from '../combat/machineLessonCatalog.js';
import {machineRarity} from '../inventory/machineLoot.js';
import {regionalLootPolicy,LOOT_AFFIX_COUNT} from '../inventory/regionalLoot.js';
import type {LootRarity,ProceduralGearRoll} from '../inventory/regionalLoot.js';
import {ARENA_LEGENDARY_TEMPLATES} from './arenaGearCatalog.js';
import {LEGACY_ITEMS} from '../legacy/catalog.js';
import type {StatBonus} from '../stats/types.js';
import {STATS} from '../stats/types.js';
const TM_PRICE:Record<LootRarity,number>={common:30,uncommon:50,rare:75,epic:100,legendary:150};
const GEAR_TIERS=[{rarity:'rare',regionId:6,cost:100},{rarity:'epic',regionId:8,cost:180},{rarity:'legendary',regionId:10,cost:300}] as const;
export type ArenaOffer=
 | {id:string;kind:'tm';itemId:string;name:string;rarity:LootRarity;cost:number;weeklyLimit:number}
 | {id:string;kind:'stone';itemId:string;name:string;cost:number;weeklyLimit:number}
 | {id:string;kind:'gear';itemId:string;name:string;rarity:LootRarity;cost:number;weeklyLimit:number;gear:ProceduralGearRoll;attributeSelection:{count:4;options:readonly string[];bonus:number}|null};
const tms:ArenaOffer[]=KANTO_MACHINES.flatMap<ArenaOffer>(tm=>{
 const rarity=machineRarity(tm.id);
 if(!rarity||!executableMachineMove(tm.moveName))return [];
 return [{id:tm.id,kind:'tm',itemId:tm.id,name:tm.id.toUpperCase()+' · '+tm.moveName,rarity,cost:TM_PRICE[rarity],weeklyLimit:rarity==='epic'||rarity==='legendary'?1:3}];
});
const stones:ArenaOffer[]=KANTO_EVOLUTION_STONES.map(s=>({id:s.id,kind:'stone',itemId:s.id,name:s.name,cost:40,weeklyLimit:3}));
const gear:ArenaOffer[]=GEAR_TIERS.flatMap<ArenaOffer>(t=>(t.rarity==='legendary'?ARENA_LEGENDARY_TEMPLATES.map(m=>({...m,stats:{}})):LEGACY_ITEMS).map(model=>{
 const policy=regionalLootPolicy(t.regionId)!;
 const order=[...new Set([...Object.keys(model.stats),...STATS])].slice(0,LOOT_AFFIX_COUNT[t.rarity]);
 const value=t.rarity==='legendary'?policy.maxBonus:Math.min(policy.maxBonus,policy.minBonus+1);
 const roll:ProceduralGearRoll={templateId:model.id,slot:model.slot,rarity:t.rarity,regionId:t.regionId,requiredLevel:policy.requiredMin,stats:Object.fromEntries(order.map(k=>[k,value]))};
 return {id:'arena-'+t.rarity+'-'+(t.rarity==='legendary'?model.slot:model.id),kind:'gear',itemId:model.id,name:model.name,rarity:t.rarity,cost:t.cost,weeklyLimit:1,gear:roll,attributeSelection:t.rarity==='legendary'?{count:4,options:[...STATS],bonus:value}:null};
}));
export const ARENA_SHOP_VERSION=1;
export const ARENA_GEAR_WEEKLY_LIMIT=1;
export function arenaShopCatalog():readonly ArenaOffer[]{return [...tms,...stones,...gear].map(o=>o.kind==='gear'?{...o,gear:{...o.gear,stats:{...o.gear.stats}},attributeSelection:o.attributeSelection?{...o.attributeSelection,options:[...o.attributeSelection.options]}:null}:{...o});}
export function arenaShopOffer(id:unknown):ArenaOffer|null{return arenaShopCatalog().find(o=>o.id===id)??null;}

/** Only identities are selected by the player, never the bonus magnitude. */
export function arenaGearStats(offer:Extract<ArenaOffer,{kind:'gear'}>,attributes?:unknown):StatBonus|null{
 if(!offer.attributeSelection)return attributes===undefined?{...offer.gear.stats}:null;
 const {count,options,bonus}=offer.attributeSelection;
 if(!Array.isArray(attributes)||attributes.length!==count||new Set(attributes).size!==count||
  !attributes.every(a=>typeof a==='string'&&options.includes(a)))return null;
 return Object.fromEntries(attributes.map(a=>[a,bonus])) as StatBonus;
}

export function arenaGearOffer(templateId:string,rarity:LootRarity){return gear.find(o=>o.kind==='gear'&&o.itemId===templateId&&o.rarity===rarity)??null;}
