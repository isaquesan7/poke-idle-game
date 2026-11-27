import {describe,it,expect} from 'vitest';
import {battlePendingLabel} from './battlePending';
describe('TM15 — pending action display',()=>{
 it('renders only the three supported public states',()=>{
  expect(battlePendingLabel('solar-beam')?.title).toBe('Preparando Solar Beam');
  expect(battlePendingLabel('dig')?.title).toContain('Dig');
  expect(battlePendingLabel('recharge')?.detail).toContain('sem atacar');
  for(const value of [undefined,null,'tackle',{},true])expect(battlePendingLabel(value)).toBeNull();
 });
});
