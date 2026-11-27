import {describe,it,expect} from 'vitest';
import {KANTO_MACHINES} from '../src/catalog/kantoMachines.js';
import {machineRarity,regionalMachinePool,regionalMachinePolicy,rollRegionalMachine,TM_DROP_TIERS} from '../src/inventory/machineLoot.js';
import {executableMachineMove} from '../src/combat/machineLessonCatalog.js';
import {KANTO_REGIONS,kantoRegionalSpeciesPool} from '../src/map/kantoRegions.js';
const input=(id:number)=>{
 const r=KANTO_REGIONS[id-1]!,wildLevel=r.levelMin;
 return {regionId:id,speciesId:kantoRegionalSpeciesPool(r,wildLevel)[0]!.speciesId,wildLevel,trainerLevel:r.trainerUnlockLevel,pokemonLevel:wildLevel,won:true};
};
describe('TM regional loot',()=>{
 it('classifies all 50 machines and gates pools by rarity and executable effects',()=>{
  expect(KANTO_MACHINES.every(m=>machineRarity(m.id)!==null)).toBe(true);
  expect(machineRarity('tm24')).toBe('rare');
  expect(regionalMachinePool(4,'rare')).toEqual([]);
  expect(regionalMachinePool(5,'rare').map(m=>m.id)).toContain('tm24');
  expect(regionalMachinePool(5,'rare').map(m=>m.id)).toContain('tm35');
  for(const r of KANTO_REGIONS)for(const t of TM_DROP_TIERS)expect(regionalMachinePool(r.id,t.rarity).every(m=>!!executableMachineMove(m.moveName))).toBe(true);
 });
 it('preserves farming independently of XP, rejects bad rolls and never drops on loss',()=>{
  const rolls=[0,99,100,159,160,194,195,209,210,214,215,9999];
  for(let id=1;id<=10;id++)for(const n of rolls){
   const a=input(id),rng=()=>{let i=0;return ()=>i++===0?n:0;};
   const result=rollRegionalMachine(a,rng());
   expect(result).not.toBeNull();
   expect(rollRegionalMachine({...a,pokemonLevel:100},rng())).toEqual(result);
   if(result?.tmId)expect(regionalMachinePolicy(id).some(t=>t.items.includes(result.tmId!))).toBe(true);
  }
  expect(rollRegionalMachine({...input(1),won:false},()=>{throw Error('no roll')})).toEqual({tmId:null});
  expect(rollRegionalMachine(input(1),()=>-1)).toBeNull();
  expect(rollRegionalMachine({...input(5),trainerLevel:1},()=>0)).toBeNull();
 });
});
