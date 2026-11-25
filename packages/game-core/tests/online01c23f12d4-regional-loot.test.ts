import {describe,it,expect} from 'vitest';
import {KANTO_REGIONS,kantoRegionalSpeciesPool} from '../src/map/kantoRegions.js';
import {LEGACY_ITEMS} from '../src/legacy/catalog.js';
import {eligibleEvolutionStones,rollRegionalLoot,regionalLootPolicy,LOOT_AFFIX_COUNT} from '../src/inventory/regionalLoot.js';
const input=(id:number)=>{
 const r=KANTO_REGIONS[id-1]!,wildLevel=r.levelMin;
 return {regionId:id,speciesId:kantoRegionalSpeciesPool(r,wildLevel)[0]!.speciesId,wildLevel,trainerLevel:r.trainerUnlockLevel,pokemonLevel:wildLevel,won:true};
};
const low=()=>0,high=(max:number)=>max-1;
const sequence=(values:number[])=>{let i=0;return (max:number)=>Math.min(max-1,values[i++]??0);};
describe('23F12D4A: region procedural loot, pure candidate',()=>{
 it('has valid weights and monotonic region ranges; all nine slots equally selectable',()=>{
  for(let id=1;id<=10;id++){
   const p=regionalLootPolicy(id)!;expect(p.weights.reduce((a,b)=>a+b,0)).toBe(100);
   expect(p.requiredMin).toBe(KANTO_REGIONS[id-1]!.trainerUnlockLevel);
   expect(p.requiredMax).toBeLessThanOrEqual(100);
   if(id>1)expect(p.maxBonus).toBeGreaterThanOrEqual(regionalLootPolicy(id-1)!.maxBonus);
  }
  const slots=new Set<string>();
  for(let i=0;i<9;i++)slots.add(rollRegionalLoot(input(1),sequence([0,i]),high)!.gear!.slot);
  expect(slots.size).toBe(9);
  expect(LEGACY_ITEMS.length).toBeLessThanOrEqual(18);
 });
 it('gates 1/2/3/4 distinct stats by region and picks the same model at different powers',()=>{
  for(const [id,count] of [[1,1],[6,2],[8,3],[10,4]] as const){
   const gear=rollRegionalLoot(input(id),sequence([0,0,0,99,99,0,99,0,99,0,99,0,99]),high)!.gear!;
   expect(gear.templateId).toBe('cap');expect(Object.keys(gear.stats)).toHaveLength(count);
   expect(Object.keys(gear.stats)).toHaveLength(LOOT_AFFIX_COUNT[gear.rarity]);
   expect(Object.values(gear.stats).every(n=>n>=regionalLootPolicy(id)!.minBonus&&n<=regionalLootPolicy(id)!.maxBonus)).toBe(true);
  }
 });
 it('8% eligible drop, 0.16% legendary in R10, full rates regardless of overlevel, no drops after loss',()=>{
  const s=input(10);
  expect(rollRegionalLoot(s,sequence([799]),high)!.gear).not.toBeNull();
  expect(rollRegionalLoot(s,sequence([800]),high)!.gear).toBeNull();
  expect(rollRegionalLoot(s,sequence([0,0,0,98]),high)!.gear!.rarity).toBe('legendary');
  expect(rollRegionalLoot(s,sequence([0,0,0,97]),high)!.gear!.rarity).toBe('epic');
  const early=input(1),never=()=>{throw Error('must not draw');};
  expect(rollRegionalLoot({...early,won:false},never,never)).toEqual({gear:null,stone:null});
  expect(rollRegionalLoot({...early,pokemonLevel:80},sequence([799]),high)).toEqual(rollRegionalLoot(early,sequence([799]),high));
  expect(rollRegionalLoot({...early,pokemonLevel:80},sequence([800]),high)!.gear).toBeNull();
  const electric={...input(5),speciesId:25,wildLevel:45,pokemonLevel:80};
  const farm=rollRegionalLoot(electric,low,low)!;
  expect(farm.stone).toBe('thunder-stone');expect(farm.gear!.regionId).toBe(5);
  expect(farm).toEqual(rollRegionalLoot({...electric,pokemonLevel:45},low,low));
  expect(rollRegionalLoot(early,()=>-1,high)).toBeNull();
 });
 it('maps actual catalog types and selects at most one stone independently',()=>{
  expect(eligibleEvolutionStones(4)).toEqual(['fire-stone']);
  for(const id of [25,26,100,101])expect(eligibleEvolutionStones(id)).toEqual(['thunder-stone']);
  expect(eligibleEvolutionStones(147)).toEqual(['water-stone']);
  expect(eligibleEvolutionStones(1)).toEqual(['leaf-stone']);
  expect(eligibleEvolutionStones(10)).toEqual([]);
  const s={...input(1),speciesId:4};
  expect(rollRegionalLoot(s,high,low)).toEqual({gear:null,stone:'fire-stone'});
  expect(rollRegionalLoot(s,high,sequence([100]))!.stone).toBeNull();
  expect(rollRegionalLoot({...s,speciesId:150},low,low)).toBeNull();
 });
});
