import {describe,expect,it} from 'vitest';
import {KANTO_MACHINES,kantoMachine,inspectMachineStock} from '../src/catalog/kantoMachines.js';
import {kantoTmIsTeachEnabled} from '../src/catalog/kantoTmPreview.js';
describe('FRLG machine catalogue',()=>{
 it('contains precisely 50 TMs, no HMs, with pinned identifiers',()=>{
  expect(KANTO_MACHINES.map(x=>x.number)).toEqual(Array.from({length:50},(_,i)=>i+1));
  expect(new Set(KANTO_MACHINES.map(x=>x.moveId)).size).toBe(50);
  expect(kantoMachine('tm09')).toMatchObject({itemId:313,moveId:331,moveName:'bullet-seed'});
  expect(kantoMachine('tm24')?.moveName).toBe('thunderbolt');
  expect(kantoMachine('tm26')?.moveName).toBe('earthquake');
  expect(kantoMachine('tm35')?.moveName).toBe('flamethrower');
  expect(kantoMachine('hm01')).toBeNull();expect(kantoMachine('tm51')).toBeNull();
 });
 it('normalizes validated stock without grants, rejects forged IDs and quantities',()=>{
  expect(inspectMachineStock(undefined)).toEqual({});
  expect(inspectMachineStock({tm09:2,tm50:0})).toEqual({tm09:2});
  for(const x of [null,[],{tm00:1},{tm09:-1},{tm09:1.2},{tm09:'2'},{tm09:Infinity},{tm09:Number.MAX_SAFE_INTEGER+1}])expect(inspectMachineStock(x)).toBeNull();
  expect(KANTO_MACHINES.every(tm=>!kantoTmIsTeachEnabled(tm.id,1))).toBe(true);
 });
});
