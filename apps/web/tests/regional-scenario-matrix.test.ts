/**
 * D-064AA — matriz reproduzível de análise, não um benchmark de gameplay.
 *
 * Os logs D064AA_MATRIX são gerados pelo próprio core no CI para auditar
 * diferenças entre times e estratégias; nenhum número vira configuração.
 */
import {describe,expect,it} from 'vitest';
import {d064SimulateRegionalScenario} from '@kanto/game-core';

describe('D-064AA — comparação quantitativa sem save',()=>{
  const cases=([
    ...[0.5,0.75,1].flatMap(winRate=>
      ([1,3] as const).flatMap(teamSize=>
        (['every-win','rare-only'] as const).map(captureStrategy=>({
          battles:10000,winRate,teamSize,seed:20261120,captureStrategy
        }))
      )
    )
  ]);
  it('separa sorteios do combate e da captura para comparações pareadas',()=>{
    const basis={battles:10000,winRate:0.75,teamSize:3 as const,seed:20261120};
    const all=d064SimulateRegionalScenario({...basis,captureStrategy:'every-win'});
    const rare=d064SimulateRegionalScenario({...basis,captureStrategy:'rare-only'});
    expect(all).not.toBeNull();
    expect(rare).not.toBeNull();
    if(!all||!rare)return;
    expect(all.wins).toBe(rare.wins);
    expect(all.losses).toBe(rare.losses);
    expect(all.regionBattles).toEqual(rare.regionBattles);
    expect(all.regionWins).toEqual(rare.regionWins);
    expect(all.unlockBattles).toEqual(rare.unlockBattles);
    expect(all.rareEncounters).toBe(rare.rareEncounters);
    expect(all.trainer).toEqual(rare.trainer);
    expect(all.team).toEqual(rare.team);
  });
  it.each(cases)('matriz $winRate $teamSize $captureStrategy',input=>{
    const result=d064SimulateRegionalScenario(input);
    expect(result).not.toBeNull();
    if(!result)return;
    const again=d064SimulateRegionalScenario(input);
    expect(result).toEqual(again);
    expect(result.wins+result.losses).toBe(input.battles);
    expect(result.team).toHaveLength(input.teamSize);
    const totalSpent=Object.values(result.ballsSpent).reduce((a,b)=>a+b,0);
    const totalEarned=Object.values(result.ballsEarned).reduce((a,b)=>a+b,0);
    const totalStock=Object.values(result.remainingBalls).reduce((a,b)=>a+b,0);
    expect(totalStock).toBe(12+totalEarned-totalSpent);
    expect(result.rareCaptures).toBeLessThanOrEqual(result.rareCaptureAttempts);
    console.info('D064AA_MATRIX',JSON.stringify({
      winRate:input.winRate,teamSize:input.teamSize,strategy:input.captureStrategy,
      wins:result.wins,trainerLevel:result.trainer.level,
      pokemonLevels:result.team.map(p=>p.level),
      region8At:result.unlockBattles[7],region9At:result.unlockBattles[8],
      region10At:result.unlockBattles[9],
      rareEncounters:result.rareEncounters,
      rareAttempts:result.rareCaptureAttempts,
      rareCaptures:result.rareCaptures,
      missed:result.missedCaptureOpportunities,
      earned:result.ballsEarned,spent:result.ballsSpent,stock:result.remainingBalls
    }));
  });
});
