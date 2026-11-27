import {describe,it,expect} from 'vitest';
import {regionalMegaStoneRate,regionalMegaStonePool,rollRegionalMegaStone} from '../src/inventory/megaStoneLoot.js';
import {KANTO_REGIONS,kantoRegionalSpeciesPool} from '../src/map/kantoRegions.js';
import {inspectPendingRegionalLoot} from '../src/inventory/serverRegionalLoot.js';
const input=(id:number)=>{
 const r=KANTO_REGIONS[id-1]!,wildLevel=r.levelMin;
 return {regionId:id,speciesId:kantoRegionalSpeciesPool(r,wildLevel)[0]!.speciesId,wildLevel,trainerLevel:r.trainerUnlockLevel,pokemonLevel:100,won:true};
};
describe('MEGA03 — endgame loot policy',()=>{
 it('only certified wins in R9/10, uniform choice, independent of XP cap',()=>{
  const never=()=>{throw Error('no roll')};
  for(let id=1;id<9;id++){expect(regionalMegaStoneRate(id)).toBe(0);expect(rollRegionalMegaStone(input(id),never)).toEqual({megaStoneId:null});}
  for(const [id,rate] of [[9,40],[10,100]] as const){
   const s=input(id),pool=regionalMegaStonePool(id);
   expect(pool).toEqual(['venusaurite','charizardite-x','charizardite-y','blastoisinite']);
   expect(rollRegionalMegaStone(s,()=>rate)).toEqual({megaStoneId:null});
   expect(rollRegionalMegaStone({...s,won:false},never)).toEqual({megaStoneId:null});
   for(let i=0;i<pool.length;i++){
    const rng=()=>{let n=0;return ()=>n++===0?rate-1:i;};
    expect(rollRegionalMegaStone(s,rng())).toEqual({megaStoneId:pool[i]});
    expect(rollRegionalMegaStone({...s,pokemonLevel:81},rng())).toEqual({megaStoneId:pool[i]});
   }
   expect(rollRegionalMegaStone(s,()=>-1)).toBeNull();
  }
 });
 it('validates pending items, rejects counterfeit stone',()=>{
  const id='12345678-1234-1234-1234-123456789abc',item={kind:'mega-stone',itemId:'venusaurite',quantity:1};
  expect(inspectPendingRegionalLoot({encounterId:id,items:[item]})).toEqual({encounterId:id,items:[item]});
  expect(inspectPendingRegionalLoot({encounterId:id,items:[{...item,itemId:'mewtwonite-x'}]})).toBeNull();
 });
});
