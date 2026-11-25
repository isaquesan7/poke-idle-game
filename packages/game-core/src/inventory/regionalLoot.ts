/** 23F12D4A — candidate procedural loot policy, no grants or persistence.
 * RNG must come from private encounter HMAC, in separate gear and stone domains.
 * Numbers are initial balancing proposals; change before enabling real grants.
 */
import {LEGACY_ITEMS} from '../legacy/catalog.js';
import {kantoRegion,kantoRegionalSpeciesPool} from '../map/kantoRegions.js';
import {kantoSpecies} from '../catalog/kantoSpecies.js';
import {battleProgressFactor} from '../rewards/regionProgression.js';
import {STATS} from '../stats/types.js';
import type {Stat,StatBonus} from '../stats/types.js';
import type {KantoEvolutionStone} from '../catalog/kantoEvolution.js';
import type {EquipmentSlot} from '../stats/trainer.js';

export const LOOT_RARITIES=['common','uncommon','rare','epic','legendary'] as const;
export type LootRarity=typeof LOOT_RARITIES[number];
export const LOOT_AFFIX_COUNT:Readonly<Record<LootRarity,number>>={common:1,uncommon:1,rare:2,epic:3,legendary:4};
type Weights=readonly [number,number,number,number,number];
interface Tier {readonly weights:Weights;readonly minBonus:number;readonly maxBonus:number;readonly gearBps:number}
const TIERS:readonly Tier[]=[
 {weights:[85,15,0,0,0],minBonus:1,maxBonus:2,gearBps:800},
 {weights:[75,25,0,0,0],minBonus:1,maxBonus:3,gearBps:800},
 {weights:[65,35,0,0,0],minBonus:2,maxBonus:3,gearBps:800},
 {weights:[60,35,5,0,0],minBonus:2,maxBonus:4,gearBps:800},
 {weights:[55,35,10,0,0],minBonus:3,maxBonus:5,gearBps:800},
 {weights:[50,30,20,0,0],minBonus:4,maxBonus:6,gearBps:800},
 {weights:[45,30,25,0,0],minBonus:4,maxBonus:7,gearBps:800},
 {weights:[40,30,25,5,0],minBonus:5,maxBonus:8,gearBps:800},
 {weights:[35,30,25,10,0],minBonus:6,maxBonus:9,gearBps:800},
 {weights:[30,28,25,15,2],minBonus:7,maxBonus:10,gearBps:800}
];
export const STONE_DROP_BPS=100;
const STONE_BY_TYPE:Readonly<Partial<Record<string,KantoEvolutionStone>>>={fire:'fire-stone',water:'water-stone',dragon:'water-stone',electric:'thunder-stone',grass:'leaf-stone',fairy:'moon-stone',psychic:'moon-stone'};
const slots:readonly EquipmentSlot[]=['hat','jacket','gloves','pants','shoes','necklace','ring1','ring2','earrings'];
type Integer=(exclusiveMax:number)=>number;
const take=(rng:Integer,max:number)=>{
 const n=rng(max);if(!Number.isSafeInteger(n)||n<0||n>=max)throw new RangeError('Invalid private loot roll');return n;
};
export interface RegionalLootInput {
 readonly regionId:number;readonly speciesId:number;readonly wildLevel:number;
 readonly trainerLevel:number;readonly pokemonLevel:number;readonly won:boolean;
 readonly capped:boolean;
}
export interface ProceduralGearRoll {
 readonly templateId:string;readonly slot:EquipmentSlot;readonly rarity:LootRarity;
 readonly requiredLevel:number;readonly regionId:number;readonly stats:StatBonus;
}
export function regionalLootPolicy(regionId:number){
 const region=kantoRegion(regionId),tier=TIERS[regionId-1];
 if(!region||!tier)return null;
 return {...tier,weights:[...tier.weights],requiredMin:region.trainerUnlockLevel,
  requiredMax:Math.min(region.levelMax,region.trainerUnlockLevel+8)};
}
export function eligibleEvolutionStones(speciesId:number):readonly KantoEvolutionStone[]{
 const p=kantoSpecies(speciesId);if(!p)return [];
 return [...new Set(p.types.flatMap(t=>STONE_BY_TYPE[t]?[STONE_BY_TYPE[t]!]:[]))];
}
export function rollRegionalLoot(input:RegionalLootInput,gearRandom:Integer,stoneRandom:Integer){
 const {regionId,speciesId,wildLevel,trainerLevel,pokemonLevel,won,capped}=input;
 const region=kantoRegion(regionId),tier=TIERS[regionId-1],policy=regionalLootPolicy(regionId);
 if(!region||!tier||!policy||typeof won!=='boolean'||typeof capped!=='boolean'||
  !Number.isSafeInteger(trainerLevel)||trainerLevel<region.trainerUnlockLevel||trainerLevel>100||
  !Number.isSafeInteger(pokemonLevel)||pokemonLevel<1||pokemonLevel>100||
  !kantoRegionalSpeciesPool(region,wildLevel).some(p=>p.speciesId===speciesId)||
  typeof gearRandom!=='function'||typeof stoneRandom!=='function')return null;
 const factor=battleProgressFactor(pokemonLevel,wildLevel);
 if(!won||capped||factor===0)return {gear:null,stone:null};
 try{
  let gear:ProceduralGearRoll|null=null,stone:KantoEvolutionStone|null=null;
  if(take(gearRandom,10000)<Math.round(tier.gearBps*factor)){
   // Uniform slot, then uniform template within slot: two hats do not make hats more likely.
   const slot=slots[take(gearRandom,slots.length)]!;
   const models=LEGACY_ITEMS.filter(i=>i.slot===slot);
   const model=models[take(gearRandom,models.length)]!;
   let pick=take(gearRandom,100),rarity:LootRarity='common';
   for(let i=0;i<LOOT_RARITIES.length;i++){pick-=tier.weights[i]!;if(pick<0){rarity=LOOT_RARITIES[i]!;break;}}
   const requiredLevel=policy.requiredMin+take(gearRandom,policy.requiredMax-policy.requiredMin+1);
   const stats:Partial<Record<Stat,number>>={},remaining=[...STATS];
   for(let i=0;i<LOOT_AFFIX_COUNT[rarity];i++){
    const stat=remaining.splice(take(gearRandom,remaining.length),1)[0]!;
    // Uncommon and higher cannot roll the lowest value where the interval permits.
    const min=Math.min(tier.maxBonus,tier.minBonus+(rarity==='common'?0:1));
    stats[stat]=min+take(gearRandom,tier.maxBonus-min+1);
   }
   gear={templateId:model.id,slot,rarity,requiredLevel,regionId,stats};
  }
  const stones=eligibleEvolutionStones(speciesId);
  // A dual type never doubles the chance; one matching stone, deduplicated.
  if(stones.length&&take(stoneRandom,10000)<Math.round(STONE_DROP_BPS*factor))
   stone=stones[take(stoneRandom,stones.length)]!;
  return {gear,stone};
 }catch{return null;}
}
