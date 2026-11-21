import {describe,expect,it} from 'vitest';
import {d064SimulateRegionalScenario} from '../src/map/regionalScenarioLab.js';

const base={
  battles:5000,winRate:0.75,teamSize:1 as const,seed:20261120,
  captureStrategy:'every-win' as const
};
describe('D-064Z — cenários econômicos sem alteração do jogo',()=>{
  it('é determinístico, preserva orçamento de Poké Bolas e não cria Master Ball',()=>{
    const one=d064SimulateRegionalScenario(base);
    const replay=d064SimulateRegionalScenario(base);
    expect(one).not.toBeNull();
    expect(one).toEqual(replay);
    if(!one)return;
    expect(one.wins+one.losses).toBe(base.battles);
    expect(one.regionWins.reduce((a,b)=>a+b,0)).toBe(one.wins);
    expect(one.regionBattles.reduce((a,b)=>a+b,0)).toBe(base.battles);
    for(const key of ['poke-ball','great-ball','ultra-ball'] as const){
      expect(one.remainingBalls[key]).toBe(12*(key==='poke-ball'?1:0)
        +one.ballsEarned[key]-one.ballsSpent[key]);
      expect(one.remainingBalls[key]).toBeGreaterThanOrEqual(0);
    }
    expect(one.rareCaptures).toBeLessThanOrEqual(one.rareCaptureAttempts);
    expect(one.rareCaptureAttempts).toBeLessThanOrEqual(one.rareEncounters);
    expect(one.team).toHaveLength(1);
  });
  it('sem capturas não consome bolas e sem vitórias não gera XP/drop/moedas',()=>{
    const passive=d064SimulateRegionalScenario({...base,captureStrategy:'none'});
    expect(passive).not.toBeNull();
    if(passive){
      expect(Object.values(passive.ballsSpent).every(n=>n===0)).toBe(true);
      expect(passive.normalCaptures+passive.rareCaptures).toBe(0);
    }
    const defeated=d064SimulateRegionalScenario({...base,winRate:0});
    expect(defeated).not.toBeNull();
    if(defeated){
      expect(defeated.wins).toBe(0);
      expect(defeated.losses).toBe(base.battles);
      expect(defeated.trainer.level).toBe(1);
      expect(defeated.team[0]?.level).toBe(5);
      expect(defeated.coins).toBe(0);
      expect(defeated.highestRegion).toBe(1);
      expect(defeated.remainingBalls['poke-ball']).toBe(12);
    }
  });
  it('vitória 100% desbloqueia regiões tão cedo quanto a taxa menor no mesmo seed',()=>{
    const full=d064SimulateRegionalScenario({...base,winRate:1,captureStrategy:'none'});
    const partial=d064SimulateRegionalScenario({...base,winRate:0.5,captureStrategy:'none'});
    expect(full).not.toBeNull();
    expect(partial).not.toBeNull();
    if(full&&partial){
      expect(full.wins).toBe(base.battles);
      expect(full.trainer.level).toBeGreaterThanOrEqual(partial.trainer.level);
      expect(full.coins).toBeGreaterThanOrEqual(0);
    }
  });
  it('rodízio preserva XP por UID e pode atrasar evolução individual',()=>{
    const solo=d064SimulateRegionalScenario({...base,teamSize:1,captureStrategy:'none'});
    const trio=d064SimulateRegionalScenario({...base,teamSize:3,captureStrategy:'none'});
    expect(solo).not.toBeNull();
    expect(trio).not.toBeNull();
    if(solo&&trio){
      expect(trio.team).toHaveLength(3);
      expect(trio.team.every(p=>p.level<=solo.team[0]!.level)).toBe(true);
      expect(trio.trainer.level).toBeGreaterThanOrEqual(1);
      expect(trio.highestRegion).toBeGreaterThanOrEqual(1);
    }
  });
  it('sem consumo no modo rare-only, oportunidades raras são explicitamente contadas',()=>{
    const rare=d064SimulateRegionalScenario({...base,
      battles:10000,seed:123456,teamSize:2,captureStrategy:'rare-only'});
    expect(rare).not.toBeNull();
    if(rare){
      expect(rare.ballsSpent['poke-ball']).toBe(0);
      expect(rare.ballsSpent['great-ball']).toBe(0);
      expect(rare.rareCaptureAttempts+rare.missedCaptureOpportunities)
        .toBeLessThanOrEqual(rare.rareEncounters);
      expect(rare.normalCaptures).toBe(0);
    }
  });
  it('rejeita entradas inválidas sem efeitos colaterais',()=>{
    for(const request of [
      {...base,battles:0},{...base,battles:50001},
      {...base,winRate:1.2},{...base,winRate:NaN},
      {...base,teamSize:4 as 1},{...base,seed:-1},
      {...base,seed:2**32},{...base,captureStrategy:'bad' as 'none'}
    ]) expect(d064SimulateRegionalScenario(request)).toBeNull();
  });
});
