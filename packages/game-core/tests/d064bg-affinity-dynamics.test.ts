import {describe,expect,it} from 'vitest';
import {
  affinityAfterInactivity,affinityIdlePenaltyDays,
  AFFINITY_IDLE_DAY_MS,AFFINITY_LOSS_ON_DEFEAT,AFFINITY_LOSS_ON_DRAW
} from '../src/index.js';
const D=AFFINITY_IDLE_DAY_MS;
describe('D064BG — dinâmica da afinidade',()=>{
  it('concede 48 horas de carência, depois perde 1 ponto diário',()=>{
    expect(affinityIdlePenaltyDays(1000,1000)).toBe(0);
    expect(affinityIdlePenaltyDays(1000,1000+2*D-1)).toBe(0);
    expect(affinityIdlePenaltyDays(1000,1000+2*D)).toBe(1);
    expect(affinityIdlePenaltyDays(1000,1000+3*D)).toBe(2);
    expect(affinityAfterInactivity(70,1000,1000+3*D)).toBe(68);
    expect(affinityAfterInactivity(1,1000,1000+400*D)).toBe(0);
    expect(affinityIdlePenaltyDays(1000,0)).toBe(0);
  });
  it('derrotas/empates têm penalidades explícitas, sem números negativos',()=>{
    expect(AFFINITY_LOSS_ON_DEFEAT).toBe(3);
    expect(AFFINITY_LOSS_ON_DRAW).toBe(1);
    expect(Math.max(0,1-AFFINITY_LOSS_ON_DEFEAT)).toBe(0);
  });
  it('rejeita horas ou afinidade não seguras',()=>{
    expect(()=>affinityIdlePenaltyDays(-1,100)).toThrow();
    expect(()=>affinityAfterInactivity(101,0,100)).toThrow();
    expect(()=>affinityAfterInactivity(NaN,0,100)).toThrow();
  });
});
