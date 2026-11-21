import {describe,expect,it} from 'vitest';
import {d064SimulateRealRegionalJourney} from '../src/map/regionalRealJourneyLab.js';

const base={
  battles:90,seed:20261120,speciesIds:[1] as readonly number[],
  capturePolicy:'new-species' as const,trainingPolicy:'base' as const
};
describe('D-064AC — combate real longitudinal, inteiramente em RAM',()=>{
  it('é reproduzível, conserva Pokébolas e concede somente vitórias',()=>{
    const a=d064SimulateRealRegionalJourney(base);
    expect(a).not.toBeNull();
    expect(a).toEqual(d064SimulateRealRegionalJourney(base));
    if(!a)return;
    expect(a.wins+a.losses+a.draws).toBe(base.battles);
    expect(a.pokemon).toHaveLength(1);
    expect(a.trainer.level).toBeGreaterThanOrEqual(1);
    expect(a.highestRegion).toBeGreaterThanOrEqual(1);
    expect(a.captures).toBeGreaterThanOrEqual(a.rareCaptures);
    expect(a.caughtSpeciesCount).toBeGreaterThanOrEqual(1);
    for(const key of ['poke-ball','great-ball','ultra-ball'] as const){
      expect(a.ballsRemaining[key]).toBe(
        (key==='poke-ball'?12:0)+a.ballsEarned[key]-a.ballsSpent[key]
      );
      expect(a.ballsRemaining[key]).toBeGreaterThanOrEqual(0);
    }
  });
  it('separa política de captura das decisões e da progressão do combate',()=>{
    const options=['none','rare-only','every-win','new-species'] as const;
    const outcomes=options.map(capturePolicy=>
      d064SimulateRealRegionalJourney({...base,capturePolicy}));
    expect(outcomes.every(Boolean)).toBe(true);
    const [reference,...rest]=outcomes;
    if(!reference)throw Error('Sem cenário');
    for(const value of rest){
      if(!value)throw Error('Sem cenário');
      expect(value.wins).toBe(reference.wins);
      expect(value.losses).toBe(reference.losses);
      expect(value.draws).toBe(reference.draws);
      expect(value.trainer).toEqual(reference.trainer);
      expect(value.pokemon).toEqual(reference.pokemon);
      expect(value.unlockBattles).toEqual(reference.unlockBattles);
    }
    expect(reference.captures).toBe(0);
    expect(Object.values(reference.ballsSpent).every(v=>v===0)).toBe(true);
  });
  it('mantém XP e afinidade individuais quando três UIDs se alternam',()=>{
    const req={...base,battles:120,speciesIds:[1,4,7],
      trainingPolicy:'focused' as const,capturePolicy:'none' as const};
    const result=d064SimulateRealRegionalJourney(req);
    expect(result).not.toBeNull();
    if(!result)return;
    expect(result.pokemon.map(p=>p.speciesId)).toEqual([1,4,7]);
    expect(result.pokemon.every(p=>p.level>=5&&p.level<=100)).toBe(true);
    expect(result.pokemon.every(p=>p.affinity>=0&&p.affinity<=100)).toBe(true);
    expect(result.wins+result.losses+result.draws).toBe(req.battles);
    expect(result.captures).toBe(0);
  });
  it('não confunde aprimoramento hipotético com regra base',()=>{
    const focused=d064SimulateRealRegionalJourney({
      ...base,trainingPolicy:'focused',capturePolicy:'none'});
    const defaultProgress=d064SimulateRealRegionalJourney({
      ...base,trainingPolicy:'base',capturePolicy:'none'});
    expect(focused).not.toBeNull();
    expect(defaultProgress).not.toBeNull();
    if(!focused||!defaultProgress)return;
    expect(defaultProgress.pokemon[0]?.affinity).toBe(0);
    expect(focused.pokemon[0]?.affinity).toBe(focused.wins);
  });
  it('recusa configurações inválidas',()=>{
    for(const input of [
      {...base,battles:0},{...base,battles:2501},
      {...base,seed:-1},{...base,seed:2**32},
      {...base,speciesIds:[]},{...base,speciesIds:[1,1]},
      {...base,speciesIds:[1,4,7,10]},{...base,speciesIds:[152]},
      {...base,capturePolicy:'auto' as 'none'},
      {...base,trainingPolicy:'magic' as 'base'}
    ])expect(d064SimulateRealRegionalJourney(input)).toBeNull();
  });
});
