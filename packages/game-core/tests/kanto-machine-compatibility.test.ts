import {describe,expect,it} from 'vitest';
import {KANTO_MACHINES} from '../src/catalog/kantoMachines.js';
import {compatibleMachineSpecies,compatibleSpeciesMachines} from '../src/catalog/kantoMachineCompatibility.js';
import {validatedMachineLessons,executableMachineMove} from '../src/combat/serverMachineLessons.js';
describe('pinned FRLG compatibility and permanent lessons',()=>{
 it('all 50 positive lists are sorted, complete and contain only Kanto IDs',()=>{
  expect(KANTO_MACHINES.map(tm=>compatibleMachineSpecies(tm.id).length)).toEqual([53,6,55,16,27,145,40,11,15,145,111,32,60,60,78,24,145,105,32,25,145,33,63,50,48,41,145,68,34,38,52,145,20,45,46,39,29,46,40,47,31,145,145,145,134,90,18,21,22,14]);
  for(const tm of KANTO_MACHINES){const ids=compatibleMachineSpecies(tm.id);expect(ids).toEqual([...new Set(ids)].sort((a,b)=>a-b));expect(ids.every(id=>id>=1&&id<=151)).toBe(true);}
  expect(compatibleMachineSpecies('tm24')).toContain(25);
  expect(compatibleMachineSpecies('tm24')).not.toContain(7);
  expect(compatibleSpeciesMachines(25).map(tm=>tm.id)).toContain('tm24');
  expect(compatibleSpeciesMachines(152)).toEqual([]);
  expect(compatibleMachineSpecies('hm01')).toEqual([]);
 });
 it('validates teaching species and rejects forged or duplicate lessons',()=>{
  expect(executableMachineMove('thunderbolt')).not.toBeNull();
  expect(validatedMachineLessons(25,10,undefined,[{tmId:'tm24',speciesId:25}])?.has('thunderbolt')).toBe(true);
  expect(validatedMachineLessons(7,10,undefined,[{tmId:'tm24',speciesId:7}])).toBeNull();
  expect(validatedMachineLessons(26,10,undefined,[{tmId:'tm24',speciesId:25}])).toBeNull();
  expect(validatedMachineLessons(26,10,[{from:25,to:26,level:10,moves:['thunder-shock']}],[{tmId:'tm24',speciesId:25}])?.has('thunderbolt')).toBe(true);
  expect(validatedMachineLessons(25,10,undefined,[{tmId:'tm24',speciesId:25},{tmId:'tm24',speciesId:25}])).toBeNull();
  expect(validatedMachineLessons(1,10,undefined,[{tmId:'tm09',speciesId:1}])).toBeNull();
 });
});
