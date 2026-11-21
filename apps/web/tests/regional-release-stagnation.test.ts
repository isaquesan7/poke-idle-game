/**
 * D-064AD — diagnóstico reproduzível de estagnação.
 * Dados exclusivamente em RAM; NÃO autoriza XP, captura ou writer de produção.
 */
import {describe,expect,it} from 'vitest';
import {d064SimulateRealRegionalJourney} from '@kanto/game-core';

describe('D-064AD — gates de softlock e preparação de beta',()=>{
  const seeds=[0,17,20261120,4294967295];
  const cases=seeds.flatMap(seed=>
    (['base','focused'] as const).flatMap(trainingPolicy=>
      ([[1],[1,4,7]] as const).map(speciesIds=>({
        battles:240,seed,speciesIds:[...speciesIds],
        trainingPolicy,capturePolicy:'none' as const
      }))
    )
  );
  it.each(cases)(
    'medir softlock seed=$seed treino=$trainingPolicy espécie=$speciesIds',
    input=>{
      const result=d064SimulateRealRegionalJourney(input);
      expect(result).not.toBeNull();
      if(!result)throw Error('Simulação real bloqueada');
      expect(result).toEqual(d064SimulateRealRegionalJourney(input));
      expect(result.wins+result.losses+result.draws).toBe(input.battles);
      expect(result.winsByRegion.reduce((a,b)=>a+b,0)).toBe(result.wins);
      expect(result.longestNoWinStreak).toBeGreaterThanOrEqual(0);
      expect(result.longestNoWinStreak).toBeLessThanOrEqual(input.battles);
      expect(result.lastWinBattle).toBeGreaterThanOrEqual(0);
      expect(result.lastWinBattle).toBeLessThanOrEqual(input.battles);
      if(result.wins===0)expect(result.lastWinBattle).toBe(0);
      else expect(result.lastWinBattle).toBeGreaterThan(0);
      expect(result.pokemon).toHaveLength(input.speciesIds.length);
      for(const key of ['poke-ball','great-ball','ultra-ball'] as const)
        expect(result.ballsRemaining[key]).toBe(
          (key==='poke-ball'?12:0)
          +result.ballsEarned[key]-result.ballsSpent[key]
        );
      console.info('D064AD_SOFTLOCK',JSON.stringify({
        seed:input.seed,team:input.speciesIds,
        training:input.trainingPolicy,battles:result.battles,
        wins:result.wins,losses:result.losses,draws:result.draws,
        trainerLevel:result.trainer.level,
        pokemonLevels:result.pokemon.map(p=>p.level),
        region:result.highestRegion,regionWins:result.winsByRegion,
        longestNoWinStreak:result.longestNoWinStreak,
        lastWinBattle:result.lastWinBattle,
        stalledAtEnd:result.battles-result.lastWinBattle>=60
      }));
    }
  );
  it('não permite que capturas modifiquem a série de vitórias',()=>{
    const start={
      battles:180,seed:20261120,speciesIds:[1,4,7],
      trainingPolicy:'focused' as const
    };
    const none=d064SimulateRealRegionalJourney({
      ...start,capturePolicy:'none'
    });
    const collect=d064SimulateRealRegionalJourney({
      ...start,capturePolicy:'new-species'
    });
    expect(none).not.toBeNull();
    expect(collect).not.toBeNull();
    if(!none||!collect)return;
    expect(collect.wins).toBe(none.wins);
    expect(collect.losses).toBe(none.losses);
    expect(collect.draws).toBe(none.draws);
    expect(collect.winsByRegion).toEqual(none.winsByRegion);
    expect(collect.unlockBattles).toEqual(none.unlockBattles);
    expect(collect.lastWinBattle).toBe(none.lastWinBattle);
  });
});
