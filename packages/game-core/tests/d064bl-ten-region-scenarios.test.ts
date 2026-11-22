import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,emptyExpeditionBallProgress,expeditionRewards,grantXp
} from '../src/index.js';
import type {LevelProgress,ExpeditionBallProgress} from '../src/index.js';

/**
 * D064BM — regressão do caminho real R1..R10.
 * O laboratório D064BL anterior com curva Pokemon linear e gate reduzido
 * está ARQUIVADO no relatório, não deve reaparecer na build jogável.
 * Estas são apenas expedições completas: não presumem IA, vitórias ou RNG.
 */
const PUBLISHED=[1,6,12,20,30,42,55,69,82,93] as const;
const MINUTE=60_000;
type Segment={claim:number;region:number;trainerLevel:number;pokemonLevel:number};
function simulate(claimMinutes:number,maxClaims:number){
  let trainer:LevelProgress={level:1,xp:0};
  let pokemon:LevelProgress={level:2,xp:0};
  let balls:ExpeditionBallProgress=emptyExpeditionBallProgress();
  let cumulativeCoins=0;
  const entries:Segment[]=[];
  for(let claim=1;claim<=maxClaims;claim++){
    const region=[...KANTO_REGIONS].reverse().find(r=>
      trainer.level>=r.trainerUnlockLevel&&pokemon.level>=r.levelMin
    );
    if(!region)throw Error('Sem primeira região acessível');
    const reward=expeditionRewards(claimMinutes*MINUTE,{
      regionId:region.id,pokemon:[pokemon],ballProgress:balls
    });
    cumulativeCoins+=reward.coins;
    trainer=grantXp('trainer',trainer,reward.trainerXp);
    pokemon=grantXp('pokemon',pokemon,reward.pokemonXpPerMember);
    balls={...reward.ballProgress!};
    entries.push({claim,region:region.id,
      trainerLevel:trainer.level,pokemonLevel:pokemon.level});
    if(region.id===10&&pokemon.level===100&&trainer.level===100)break;
    if(reward.coins===0&&reward.trainerXp===0&&reward.pokemonXpPerMember===0)
      throw Error('Softlock económico em R'+region.id+' no resgate '+claim);
  }
  return {trainer,pokemon,entries,cumulativeCoins,
    activeHours:entries.length*claimMinutes/60};
}
describe('D064BM — progressão acessível nas 10 regiões sem alterar o gate do treinador',()=>{
  it('preserva todos os 10 requisitos originais do treinador',()=>{
    expect(KANTO_REGIONS.map(r=>r.trainerUnlockLevel)).toEqual([...PUBLISHED]);
  });
  it('resgates de 8h alcançam R10 e ambos os caps em ~20 dias de ciclos acumulados',()=>{
    const result=simulate(480,65);
    expect(result.entries[0]).toMatchObject({region:1,trainerLevel:10,pokemonLevel:21});
    expect(result.entries.find(x=>x.region===10)).toMatchObject({
      claim:53,trainerLevel:94,pokemonLevel:98
    });
    expect(result.entries.find(x=>x.pokemonLevel===100)?.claim).toBe(55);
    expect(result.entries.find(x=>x.trainerLevel===100)?.claim).toBe(59);
    expect(result).toMatchObject({trainer:{level:100,xp:0},
      pokemon:{level:100,xp:0},activeHours:472});
  },30000);
  it('resgates de 2h mantêm acesso a R10 sem softlock e treinador mais lento',()=>{
    const result=simulate(120,240);
    expect(result.entries.find(x=>x.region===10)?.claim).toBe(193);
    expect(result.entries.find(x=>x.pokemonLevel===100)?.claim).toBe(202);
    expect(result.entries.find(x=>x.trainerLevel===100)?.claim).toBe(219);
    expect(result).toMatchObject({trainer:{level:100,xp:0},
      pokemon:{level:100,xp:0},activeHours:438});
  },30000);
  it('coletas de 5min ainda exigem centenas de horas e atingem Lv100 Pokémon antes',()=>{
    const result=simulate(5,5400);
    expect(result.entries.find(x=>x.region===10)?.claim).toBe(4551);
    expect(result.entries.find(x=>x.pokemonLevel===100)?.claim).toBe(4790);
    expect(result.entries.find(x=>x.trainerLevel===100)?.claim).toBe(5192);
    expect(result).toMatchObject({trainer:{level:100,xp:0},
      pokemon:{level:100,xp:0}});
    expect(result.activeHours).toBeCloseTo(432.66666667,6);
  },30000);
});
