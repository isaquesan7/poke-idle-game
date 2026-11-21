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
