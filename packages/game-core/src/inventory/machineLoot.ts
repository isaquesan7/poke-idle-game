/** Initial balancing: one independent TM roll per certified regional win.
 * Rarity is a game policy, not PokéAPI metadata. No XP eligibility requirement.
 * Only already executable moves can drop. Rates are per rarity, not per TM. */
import {KANTO_MACHINES,kantoMachine} from '../catalog/kantoMachines.js';
import type {KantoMachineId} from '../catalog/kantoMachines.js';
import {executableMachineMove} from '../combat/machineLessonCatalog.js';
import {kantoRegion,kantoRegionalSpeciesPool} from '../map/kantoRegions.js';
import type {RegionalLootInput,LootRarity} from './regionalLoot.js';
const GROUPS:Readonly<Record<LootRarity,readonly number[]>>={"common":[3,5,10,12,21,27,28,32,34,39,43,46],"uncommon":[2,7,8,9,16,17,18,19,20,23,31,33,37,40,41,42,45,47],"rare":[6,11,13,14,22,24,25,30,35,36,44],"epic":[1,4,26,29,38,48,49],"legendary":[15,50]};
export const TM_DROP_TIERS=Object.freeze([
 {rarity:'common',minRegion:1,bps:100},
 {rarity:'uncommon',minRegion:3,bps:60},
 {rarity:'rare',minRegion:5,bps:35},
 {rarity:'epic',minRegion:8,bps:15},
 {rarity:'legendary',minRegion:9,bps:5}
] as const);
export function machineRarity(id:unknown):LootRarity|null{
 const tm=kantoMachine(id);if(!tm)return null;
 return TM_DROP_TIERS.find(t=>GROUPS[t.rarity].includes(tm.number))?.rarity??null;
}
export function regionalMachinePool(regionId:number,rarity:LootRarity){
 const tier=TM_DROP_TIERS.find(t=>t.rarity===rarity);
 if(!kantoRegion(regionId)||!tier||regionId<tier.minRegion)return [];
 return KANTO_MACHINES.filter(tm=>machineRarity(tm.id)===rarity&&!!executableMachineMove(tm.moveName));
}
export function regionalMachinePolicy(regionId:number){
 return TM_DROP_TIERS.filter(t=>regionId>=t.minRegion&&!!kantoRegion(regionId)).map(t=>({...t,items:regionalMachinePool(regionId,t.rarity).map(m=>m.id)}));
}
export function rollRegionalMachine(input:RegionalLootInput,rng:(max:number)=>number):{tmId:KantoMachineId|null}|null{
 const region=kantoRegion(input.regionId);
 if(!region||typeof input.won!=='boolean'||!Number.isSafeInteger(input.trainerLevel)||input.trainerLevel<region.trainerUnlockLevel||input.trainerLevel>100||!Number.isSafeInteger(input.pokemonLevel)||input.pokemonLevel<1||input.pokemonLevel>100||!kantoRegionalSpeciesPool(region,input.wildLevel).some(p=>p.speciesId===input.speciesId)||typeof rng!=='function')return null;
 if(!input.won)return {tmId:null};
 try{
  let roll=rng(10000);
  if(!Number.isSafeInteger(roll)||roll<0||roll>=10000)return null;
  for(const tier of regionalMachinePolicy(input.regionId)){
   if(roll<tier.bps){
    if(!tier.items.length)return {tmId:null};
    const index=rng(tier.items.length);
    if(!Number.isSafeInteger(index)||index<0||index>=tier.items.length)return null;
    return {tmId:tier.items[index]!};
   }
   roll-=tier.bps;
  }
  return {tmId:null};
 }catch{return null;}
}
