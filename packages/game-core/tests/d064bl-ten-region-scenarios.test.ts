import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,emptyExpeditionBallProgress,expeditionRewards,grantXp
} from '../src/index.js';
import type {LevelProgress,ExpeditionBallProgress} from '../src/index.js';

/**
 * D064BL — laboratório não-jogável. O catálogo, os níveis exigidos atuais
 * e as curvas de XP do core permanecem INTOCADOS. A régua reduzida abaixo
 * existe só para medir o risco de uma "correção fácil" de desbloqueios.
 */
const PUBLISHED=[1,6,12,20,30,42,55,69,82,93] as const;
const DIAGNOSTIC_GATES=[1,6,12,18,21,24,27,30,33,36] as const;
const MINUTE=60_000;
type Segment={claim:number;region:number;trainerLevel:number;pokemonLevel:number};
function simulate(claimMinutes:number,gates:readonly number[],maxClaims:number){
  if(gates.length!==KANTO_REGIONS.length)throw new Error('Regiões inconsistentes');
  let trainer:LevelProgress={level:1,xp:0};
  let pokemon:LevelProgress={level:2,xp:0};
  let balls:ExpeditionBallProgress=emptyExpeditionBallProgress();
  let cumulativeCoins=0;
  const entries:Segment[]=[];
  for(let i=1;i<=maxClaims;i++){
    const region=[...KANTO_REGIONS].reverse().find(r=>
      trainer.level>=gates[r.id-1]!&&pokemon.level>=r.levelMin
    );
    if(!region)throw Error('Sem primeira região acessível');
    const reward=expeditionRewards(claimMinutes*MINUTE,{
      regionId:region.id,pokemon:[pokemon],ballProgress:balls
    });
    cumulativeCoins+=reward.coins;
    trainer=grantXp('trainer',trainer,reward.trainerXp);
    pokemon=grantXp('pokemon',pokemon,reward.pokemonXpPerMember);
    balls={...reward.ballProgress!};
    entries.push({claim:i,region:region.id,
      trainerLevel:trainer.level,pokemonLevel:pokemon.level});
    if(region.id===10&&pokemon.level===100)break;
    if(reward.coins===0&&reward.trainerXp===0&&reward.pokemonXpPerMember===0)break;
  }
  return {trainer,pokemon,entries,cumulativeCoins,
    activeHours:entries.length*claimMinutes/60};
}
describe('D064BL — matriz de risco de desbloqueios nas dez regiões',()=>{
  it('preserva os gates de treinador publicados no catálogo (baseline)',()=>{
    expect(KANTO_REGIONS.map(r=>r.trainerUnlockLevel)).toEqual([...PUBLISHED]);
    const result=simulate(480,PUBLISHED,40);
    expect(result.entries.map(r=>r.region)).toEqual([1,2,3,3,3]);
    expect(result.trainer).toMatchObject({level:19,xp:1139});
    expect(result.pokemon).toMatchObject({level:41,xp:0});
  });
  it('gate reduzido abre R10 após 10 resgates de 8h, mas Pokémon alcança Nv100 cedo',()=>{
    const result=simulate(480,DIAGNOSTIC_GATES,20);
    expect(result.entries.map(r=>r.region)).toEqual([1,2,3,4,5,6,7,8,9,10]);
    expect(result).toMatchObject({activeHours:80,
      trainer:{level:44},pokemon:{level:100}});
    expect(result.cumulativeCoins).toBeGreaterThan(0);
  });
  it('resgates frequentes aceleram o avanço: Lv100 em ~32h com gates reduzidos',()=>{
    const result=simulate(5,DIAGNOSTIC_GATES,1000);
    expect(result.entries.length).toBe(386);
    expect(result).toMatchObject({trainer:{level:39},pokemon:{level:100}});
    expect(result.activeHours).toBeCloseTo(32.1666666667,6);
    expect(result.entries.some(e=>e.region===10)).toBe(true);
    // Sem extrapolar: não é tempo de parede nem taxa garantida de vitórias.
  });
  it('resgates de duas horas têm resultado intermediário, nunca apresentam ganhos acima do cap',()=>{
    const result=simulate(120,DIAGNOSTIC_GATES,100);
    expect(result.entries).toHaveLength(18);
    expect(result).toMatchObject({trainer:{level:40},pokemon:{level:100},
      activeHours:36});
    for(const row of result.entries){
      expect(row.trainerLevel).toBeLessThanOrEqual(100);
      expect(row.pokemonLevel).toBeLessThanOrEqual(100);
    }
  });
});
