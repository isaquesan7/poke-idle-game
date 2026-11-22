import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,emptyExpeditionBallProgress,expeditionRewards,grantXp
} from '../src/index.js';
import {d064CaptureProjection} from '../src/capture/regionalCaptureProjection.js';
import type {ExpeditionBallProgress,LevelProgress} from '../src/index.js';

const MS_8H=8*60*60*1000;
type Checkpoint={claim:number;region:number;trainer:number;pokemon:number;
  coins:number;poke:number;great:number;ultra:number};
function economyOnlyClaims(count:number){
  let trainer:LevelProgress={level:1,xp:0};
  let pokemon:LevelProgress={level:2,xp:0};
  let ballProgress:ExpeditionBallProgress=emptyExpeditionBallProgress();
  const pocket={poke:12,great:0,ultra:0};
  const checkpoints:Checkpoint[]=[];
  let coins=0;
  for(let claim=1;claim<=count;claim++){
    const region=[...KANTO_REGIONS].reverse().find(r=>
      trainer.level>=r.trainerUnlockLevel&&pokemon.level>=r.levelMin);
    if(!region)throw Error('Região inválida na progressão');
    const rewards=expeditionRewards(MS_8H,{
      regionId:region.id,pokemon:[pokemon],ballProgress
    });
    coins+=rewards.coins;
    trainer=grantXp('trainer',trainer,rewards.trainerXp);
    pokemon=grantXp('pokemon',pokemon,rewards.pokemonXpPerMember);
    ballProgress={...rewards.ballProgress!};
    pocket.poke+=rewards.ballDrops!['poke-ball'];
    pocket.great+=rewards.ballDrops!['great-ball'];
    pocket.ultra+=rewards.ballDrops!['ultra-ball'];
    checkpoints.push({claim,region:region.id,trainer:trainer.level,
      pokemon:pokemon.level,coins,...pocket});
  }
  return {checkpoints,trainer,pokemon,coins,pocket,ballProgress};
}
describe('D064BN — economia cumulativa sem loja ou gastos',()=>{
  it('pina 40 e 60 resgates de 8h na curva D064BM (1 Pokémon, nenhum combate)',()=>{
    const result=economyOnlyClaims(60);
    expect(result.checkpoints[0]).toMatchObject({
      region:1,trainer:10,pokemon:21,coins:8039,poke:13,great:0,ultra:0
    });
    expect(result.checkpoints[39]).toMatchObject({
      region:9,trainer:83,pokemon:90,
      coins:1054319,poke:91,great:35,ultra:0
    });
    expect(result.checkpoints[41]).toMatchObject({
      region:9,ultra:1
    });
    expect(result.checkpoints[52]).toMatchObject({
      region:10,trainer:94,pokemon:98,coins:1475985,ultra:4
    });
    expect(result.checkpoints[54]).toMatchObject({
      region:10,pokemon:100,ultra:5
    });
    expect(result.checkpoints[58]).toMatchObject({
      region:10,trainer:100,pokemon:100
    });
    expect(result.checkpoints[59]).toEqual({
      claim:60,region:10,trainer:100,pokemon:100,
      coins:1798545,poke:131,great:55,ultra:7
    });
    expect(result.ballProgress['ultra-ball']).toBe(60480);
    // Este saldo não desconta tentativas de captura, loja, equipamento ou TM.
  },30000);

  it('não supõe preço oficial e demonstra sensibilidade do orçamento bruto',()=>{
    const {coins}=economyOnlyClaims(60);
    const hypothetical=[500,1000,2000,10000,20000,50000,100000];
    const possible=hypothetical.map(price=>Math.floor(coins/price));
    expect(possible).toEqual([3597,1798,899,179,89,35,17]);
    expect(possible.every(Number.isSafeInteger)).toBe(true);
  },30000);

  it('expedição R10 continua pagando moedas após ambos os caps, sem XP Pokémon',()=>{
    const reward=expeditionRewards(MS_8H,{
      regionId:10,pokemon:[{level:100,xp:0}],
      ballProgress:emptyExpeditionBallProgress()
    });
    expect(reward).toMatchObject({
      cycles:2880,coins:46080,trainerXp:37440,
      pokemonXpPerMember:0,affinityGainPerMember:0
    });
    expect(reward.ballDrops).toEqual({
      'poke-ball':2,'great-ball':1,'ultra-ball':0
    });
    expect(reward.ballProgress?.['ultra-ball']).toBe(2880);
    // Uma Ultra depende de TRÊS coletas elegíveis de 8h.
  });

  it('mede raridade composta por espécie e rejeita interpretação de taxa garantida',()=>{
    const articuno=d064CaptureProjection(144,9,'ultra-ball',100,0);
    const mewtwo=d064CaptureProjection(150,10,'ultra-ball',100,0);
    const mew=d064CaptureProjection(151,10,'ultra-ball',100,0);
    expect(articuno).not.toBeNull();
    expect(mewtwo).not.toBeNull();
    expect(mew).not.toBeNull();
    expect(articuno!.appearanceChance).toBeCloseTo(1/843,12);
    expect(mewtwo!.appearanceChance).toBeCloseTo(1/1682,12);
    expect(mewtwo!.captureChance).toBeCloseTo(6/255,12);
    expect(mew!.captureChance).toBeCloseTo(90/255,12);
    expect(articuno!.expectedBattlesPerCapture).toBeCloseTo(35827.5,5);
    expect(mewtwo!.expectedBattlesPerCapture).toBeCloseTo(71485,5);
    expect(mew!.expectedBattlesPerCapture).toBeCloseTo(1682*255/90,5);
    expect(d064CaptureProjection(150,10,'poke-ball',100,0)).toBeNull();
    expect(d064CaptureProjection(144,9,'great-ball',100,0)).toBeNull();
    // Valores incluem aparição × captura, mas ASSUMEM 100% de vitórias,
    // Ultra sempre disponível e tentativa seletiva a cada raro relevante.
  });
});
