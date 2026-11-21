/**
 * D-064AB — testes e métricas de múltiplas seeds, sem persistência.
 * Logging fica no workspace web (tipos DOM), não no core.
 */
import {describe,expect,it} from 'vitest';
import {d064SimulateRegionalScenario,d064SampleRealRegionalBattles} from '@kanto/game-core';

describe('D-064AB — distribuição de cenários e motor de batalha real',()=>{
  it('confere políticas pareadas em 8 seeds, 2 tamanhos de time e 2 estratégias',()=>{
    const seeds=[17,117,1117,20261120,54321,87654,0,0xffffffff];
    const rows: Array<{
      teamSize:number;seed:number;region10At:number|null;
      wins:number;rareEncounters:number;missedEvery:number;
      rareAttemptsEvery:number;rareAttemptsReserved:number;
      ultraReserved:number;rareCapturesReserved:number
    }>=[];
    for(const seed of seeds){
      for(const teamSize of [1,3] as const){
        const base={battles:6000,seed,teamSize,winRate:0.75};
        const every=d064SimulateRegionalScenario({...base,captureStrategy:'every-win'});
        const rare=d064SimulateRegionalScenario({...base,captureStrategy:'rare-only'});
        expect(every).not.toBeNull();
        expect(rare).not.toBeNull();
        if(!every||!rare)throw Error('Cenário inválido');
        expect(every.regionBattles).toEqual(rare.regionBattles);
        expect(every.regionWins).toEqual(rare.regionWins);
        expect(every.unlockBattles).toEqual(rare.unlockBattles);
        expect(every.rareEncounters).toBe(rare.rareEncounters);
        expect(every.trainer).toEqual(rare.trainer);
        expect(every.team).toEqual(rare.team);
        expect(every.rareCaptureAttempts).toBeLessThanOrEqual(rare.rareCaptureAttempts);
        expect(every.rareCaptures).toBeLessThanOrEqual(rare.rareCaptures);
        rows.push({
          teamSize,seed,region10At:rare.unlockBattles[9]??null,
          wins:rare.wins,rareEncounters:rare.rareEncounters,
          missedEvery:every.missedCaptureOpportunities,
          rareAttemptsEvery:every.rareCaptureAttempts,
          rareAttemptsReserved:rare.rareCaptureAttempts,
          ultraReserved:rare.remainingBalls['ultra-ball'],
          rareCapturesReserved:rare.rareCaptures
        });
      }
    }
    expect(rows).toHaveLength(16);
    for(const teamSize of [1,3]){
      const group=rows.filter(r=>r.teamSize===teamSize);
      const reached=group.filter(r=>r.region10At!==null);
      const mean=(numbers:readonly number[])=>
        numbers.reduce((a,b)=>a+b,0)/numbers.length;
      console.info('D064AB_MULTI_SEED',JSON.stringify({
        teamSize,seeds:group.length,battlesPerSeed:6000,
        region10Reached:reached.length,
        region10MeanBattles:reached.length
          ?mean(reached.map(x=>x.region10At!)):null,
        region10MinBattles:reached.length
          ?Math.min(...reached.map(x=>x.region10At!)):null,
        region10MaxBattles:reached.length
          ?Math.max(...reached.map(x=>x.region10At!)):null,
        meanWins:mean(group.map(x=>x.wins)),
        meanRareEncounters:mean(group.map(x=>x.rareEncounters)),
        meanMissedCaptureOpportunitiesEveryWin:mean(group.map(x=>x.missedEvery)),
        meanRareAttemptsEveryWin:mean(group.map(x=>x.rareAttemptsEvery)),
        meanRareAttemptsReserved:mean(group.map(x=>x.rareAttemptsReserved)),
        meanUltraStockReserved:mean(group.map(x=>x.ultraReserved)),
        meanRareCapturesReserved:mean(group.map(x=>x.rareCapturesReserved))
      }));
    }
  });

  it('amostra desfechos do motor real por matchup, área e nível',()=>{
    // Regiões iniciais, intermediárias e avançadas; cada batalha começa
    // novamente com HP e SP cheios e líder padrão sem pontos manuais.
    const regions=[1,4,7,10] as const;
    const leaders=[1,4,7] as const;
    const lowerLevels=[5,35,65,95] as const;
    const summary=[];
    for(let i=0;i<regions.length;i++){
      for(const speciesId of leaders){
        const outcome=d064SampleRealRegionalBattles({
          regionId:regions[i]!,leaderSpeciesId:speciesId,
          leaderLevel:lowerLevels[i]!,samples:32,seed:20261120
        });
        expect(outcome).not.toBeNull();
        if(!outcome)throw Error('Motor não retornou amostras');
        expect(outcome.wins+outcome.losses+outcome.draws).toBe(32);
        expect(outcome.observedWinRate).toBeGreaterThanOrEqual(0);
        expect(outcome.observedWinRate).toBeLessThanOrEqual(1);
        expect(d064SampleRealRegionalBattles({
          regionId:regions[i]!,leaderSpeciesId:speciesId,
          leaderLevel:lowerLevels[i]!,samples:32,seed:20261120
        })).toEqual(outcome);
        summary.push({
          regionId:regions[i],leaderSpeciesId:speciesId,
          level:lowerLevels[i],wins:outcome.wins,
          losses:outcome.losses,draws:outcome.draws,
          observedWinRate:outcome.observedWinRate,
          avgTurns:outcome.avgTurns
        });
      }
    }
    console.info('D064AB_REAL_BATTLE',JSON.stringify(summary));
  });

  it('rejeita parâmetros inválidos sem gravar ou lançar exceção',()=>{
    const valid={
      regionId:1,leaderSpeciesId:1,leaderLevel:5,samples:16,seed:17
    };
    expect(d064SampleRealRegionalBattles(valid)).not.toBeNull();
    for(const candidate of [
      {...valid,regionId:0},{...valid,regionId:11},
      {...valid,leaderSpeciesId:152},{...valid,leaderLevel:101},
      {...valid,samples:0},{...valid,samples:257},
      {...valid,seed:-1},{...valid,seed:2**32}
    ])expect(d064SampleRealRegionalBattles(candidate)).toBeNull();
  });
});
