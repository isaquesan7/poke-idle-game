import {describe,expect,it} from 'vitest';
import {planMachineTeaching} from '../src/progression/kantoMachineTeaching.js';
import type {MachineTeachingPolicy} from '../src/progression/kantoMachineTeaching.js';
// Synthetic fixture only; not the FRLG compatibility catalogue.
const policy:MachineTeachingPolicy={compatibleSpecies:id=>id==='tm24'?[25]:undefined,executableMove:name=>name==='thunderbolt'};
const student={uid:7,speciesId:25,knownMoveNames:['tackle']};
const input={stock:{tm24:2},student,busy:false,tmId:'tm24'};
describe('permanent TM learning candidate',()=>{
 it('consumes one item and appends a lesson without changing equipped moves or input',()=>{
  const result=planMachineTeaching(input,policy);
  expect(result).toEqual({status:'ok',uid:7,tmId:'tm24',moveName:'thunderbolt',stock:{tm24:1},lessons:[{tmId:'tm24',speciesId:25}]});
  expect(input.stock.tm24).toBe(2);expect(student.knownMoveNames).toEqual(['tackle']);
  if(result.status!=='ok')throw Error('expected success');
  expect(planMachineTeaching({...input,stock:result.stock,student:{...student,lessons:result.lessons}},policy).status).toBe('already-learned');
 });
 it('rejects incompatible, busy, empty, existing, and unimplemented moves without consuming',()=>{
  expect(planMachineTeaching({...input,student:{...student,speciesId:7}},policy).status).toBe('incompatible');
  expect(planMachineTeaching({...input,busy:true},policy).status).toBe('busy');
  expect(planMachineTeaching({...input,stock:{}},policy).status).toBe('no-stock');
  expect(planMachineTeaching({...input,student:{...student,knownMoveNames:['thunderbolt']}},policy).status).toBe('already-learned');
  expect(planMachineTeaching({...input,tmId:'tm09'},policy).status).toBe('unavailable');
  expect(planMachineTeaching({...input,stock:{tm24:-1}},policy).status).toBe('invalid');
 });
});
