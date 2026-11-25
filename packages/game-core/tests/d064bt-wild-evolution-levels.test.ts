import {describe,it,expect} from 'vitest';
import {KANTO_REGIONS,kantoRegion,kantoRegionForSpecies,kantoRegionCatalogInvariant,kantoRegionalEncounter,kantoRegionalSpeciesPool,kantoRegionalLevel} from '../src/map/kantoRegions.js';
import {kantoCaptureStartingLevel} from '../src/catalog/kantoEvolution.js';
import {serverRegionalRoll,serverRegionalOpponent} from '../src/combat/serverRegionalPolicy.js';
describe('D064BT — all 151 wild species respect evolution floors',()=>{
 it('keeps each species once; relocates only wholly incompatible regions',()=>{
  expect(kantoRegionCatalogInvariant()).toBe(true);
  for(const [id,region] of [[24,3],[28,3],[44,3],[47,3],[49,4],[51,3],[53,3],[55,4]]){
   expect(kantoRegionForSpecies(id!)?.id).toBe(region);
  }
  expect(kantoRegionForSpecies(57)?.id).toBe(3);
 });
 it('validates every region level, eligible species and every weighted server pick',()=>{
  const seen=new Set<number>();
  for(const r of KANTO_REGIONS){
   for(let level=r.levelMin;level<=r.levelMax;level++){
    const pool=kantoRegionalSpeciesPool(r,level);
    expect(pool.length).toBeGreaterThan(0);
    const fixed=kantoRegionalSpeciesPool(r,r.levelMin).length===r.speciesIds.length;
    const total=pool.reduce((sum,e)=>sum+e.weight,0);
    const counts=new Map<number,number>();
    for(let pick=0;pick<total;pick++){
     let call=0;
     const encounter=serverRegionalRoll(r.id,100,level,()=>((call++===0)===fixed)?pick:2)!;
     expect(encounter.level).toBe(level);
     expect(encounter.level).toBeGreaterThanOrEqual(kantoCaptureStartingLevel(encounter.speciesId));
     counts.set(encounter.speciesId,(counts.get(encounter.speciesId)??0)+1);
     seen.add(encounter.speciesId);
    }
    for(const entry of pool)expect(counts.get(entry.speciesId)).toBe(entry.weight);
    for(const id of r.speciesIds)expect(serverRegionalOpponent(r.id,100,id,level)).toBe(level>=kantoCaptureStartingLevel(id));
   }
  }
  expect(seen.size).toBe(151);
 },30000);
 it('local encounter preserves original level roll and never promotes the enemy',()=>{
  for(const r of KANTO_REGIONS)for(let leader=1;leader<=100;leader++)for(let i=0;i<32;i++){
   const seed=(Math.imul(2654435761,i+1)+Math.imul(2246822519,leader))>>>0;
   const encounter=kantoRegionalEncounter(r.id,seed,leader)!;
   expect(encounter.level).toBe(kantoRegionalLevel(r,leader,(seed>>>16)%5));
   expect(serverRegionalOpponent(r.id,100,encounter.speciesId,encounter.level)).toBe(true);
  }
 },30000);
 it('regression: Primeape 23 impossible, floor 28; inherited stone/trade floors',()=>{
  const r=kantoRegion(3)!;
  for(let n=21;n<28;n++)expect(kantoRegionalSpeciesPool(r,n).some(e=>e.speciesId===57)).toBe(false);
  for(let n=28;n<=30;n++)expect(kantoRegionalSpeciesPool(r,n).some(e=>e.speciesId===57)).toBe(true);
  expect(serverRegionalOpponent(3,12,57,23)).toBe(false);
  expect(serverRegionalOpponent(3,12,57,28)).toBe(true);
  expect(kantoCaptureStartingLevel(57)).toBe(28);
  expect(kantoCaptureStartingLevel(45)).toBe(21);
  expect(kantoCaptureStartingLevel(65)).toBe(16);
  expect(kantoCaptureStartingLevel(26)).toBe(1);
 });
});
