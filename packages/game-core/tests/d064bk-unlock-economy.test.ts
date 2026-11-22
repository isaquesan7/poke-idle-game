import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,emptyExpeditionBallProgress,expeditionRewards,
  grantXp,MAX_EXPEDITION_CYCLES,EXPEDITION_CYCLE_MS
} from '../src/index.js';
import type {ExpeditionBallProgress,LevelProgress} from '../src/index.js';

const EIGHT_HOURS=MAX_EXPEDITION_CYCLES*EXPEDITION_CYCLE_MS;

function accessibleRegion(trainerLevel:number,pokemonLevel:number){
  // Contrato atual de PlayApp: requisito de treinador E nível mínimo do parceiro.
  return KANTO_REGIONS.filter(region=>
    trainerLevel>=region.trainerUnlockLevel&&pokemonLevel>=region.levelMin
  ).at(-1);
}
function expeditionOnlyClaims(count:number,startingPokemonLevel=2){
  let trainer:LevelProgress={level:1,xp:0};
  let pokemon:LevelProgress={level:startingPokemonLevel,xp:0};
  let progress:ExpeditionBallProgress=emptyExpeditionBallProgress();
  let coins=0;
  let drops:ExpeditionBallProgress=emptyExpeditionBallProgress();
  const rows:{
    claim:number;regionId:number;trainerLevel:number;pokemonLevel:number;
    coins:number;trainerXp:number;pokemonXp:number;
    pokeballs:number;greatballs:number;ultraballs:number;
  }[]=[];
  for(let claim=1;claim<=count;claim++){
    const region=accessibleRegion(trainer.level,pokemon.level);
    if(!region)break;
    const reward=expeditionRewards(EIGHT_HOURS,{
      regionId:region.id,pokemon:[pokemon],ballProgress:progress
    });
    expect(reward.affinityGainPerMember).toBe(0);
    expect(reward.cycles).toBe(MAX_EXPEDITION_CYCLES);
    coins+=reward.coins;
    trainer=grantXp('trainer',trainer,reward.trainerXp);
    pokemon=grantXp('pokemon',pokemon,reward.pokemonXpPerMember);
    progress={...reward.ballProgress!};
    const balls=reward.ballDrops!;
    drops={
      'poke-ball':drops['poke-ball']+balls['poke-ball'],
      'great-ball':drops['great-ball']+balls['great-ball'],
      'ultra-ball':drops['ultra-ball']+balls['ultra-ball']
    };
    rows.push({claim,regionId:region.id,trainerLevel:trainer.level,
      pokemonLevel:pokemon.level,coins:reward.coins,trainerXp:reward.trainerXp,
      pokemonXp:reward.pokemonXpPerMember,pokeballs:balls['poke-ball'],
      greatballs:balls['great-ball'],ultraballs:balls['ultra-ball']});
  }
  return {trainer,pokemon,progress,coins,drops,rows};
}
describe('D064BM — caminho regional sem softlock e orçamento conservador',()=>{
  it('inicial Lv1 ainda precisa chegar ao Lv2 antes de desbloquear a expedição',()=>{
    expect(accessibleRegion(1,1)).toBeUndefined();
    expect(accessibleRegion(1,2)?.id).toBe(1);
    expect(accessibleRegion(19,41)?.id).toBe(3);
    expect(accessibleRegion(20,41)?.id).toBe(4);
    for(const region of KANTO_REGIONS){
      expect(accessibleRegion(region.trainerUnlockLevel,region.levelMin)?.id)
        .toBe(region.id);
    }
  });
  it('expedição não acumula Pokébolas se fator positivo arredonda todos os ganhos para zero',()=>{
    // R3 tem teto Lv30: com Nv41 sobra fator 10%, mas todos os
    // rendimentos inteiros (9,6,7 por ciclo) arredondam para zero.
    const before={'poke-ball':1439,'great-ball':2879,'ultra-ball':8639};
    const reward=expeditionRewards(EIGHT_HOURS,{
      regionId:3,pokemon:[{level:41,xp:0}],ballProgress:before
    });
    expect(reward.coins).toBe(0);
    expect(reward.trainerXp).toBe(0);
    expect(reward.pokemonXpPerMember).toBe(0);
    expect(reward.ballProgress).toEqual(before);
    expect(reward.ballDrops).toEqual(emptyExpeditionBallProgress());
  });
  it('D064BM: 40 resgates de 8h não prendem treinador e líder nas primeiras regiões',()=>{
    const result=expeditionOnlyClaims(40);
    expect(result.rows).toHaveLength(40);
    expect(result.rows.slice(0,4).map(r=>r.regionId)).toEqual([1,2,3,4]);
    expect(result.rows.slice(0,4).map(r=>r.coins)).toEqual([8039,10628,19634,28585]);
    expect(result.rows[2]).toMatchObject({trainerLevel:22,pokemonLevel:37});
    expect(result.rows[3]).toMatchObject({trainerLevel:28,pokemonLevel:43});
    expect(result.rows.every(row=>row.coins>0&&row.trainerXp>0&&row.pokemonXp>0))
      .toBe(true);
    expect(result.rows.some(row=>row.regionId===9)).toBe(true);
    expect(result.trainer.level).toBe(83);
    expect(result.pokemon.level).toBe(90);
    expect(result.coins).toBe(1054319);
    expect(result.drops).toEqual({
      'poke-ball':79,'great-ball':35,'ultra-ball':0
    });
    expect(result.progress).toEqual({
      'poke-ball':114691,'great-ball':100800,'ultra-ball':2880
    });
    // A expedição continua respeitando raridade: ainda nenhuma Ultra Ball
    // após um único resgate de 8h na R9.
  });
  it('simula poder de compra hipotético em vez de adicionar preços/loja ao jogo',()=>{
    const {coins}=expeditionOnlyClaims(4);
    const prices=[250,500,1000,2000] as const; // cenários, não preços aprovados
    const affordable=prices.map(price=>Math.floor(coins/price));
    expect(affordable.every(quantity=>Number.isSafeInteger(quantity)&&quantity>=0))
      .toBe(true);
    expect(affordable).toEqual([...affordable].sort((a,b)=>b-a));
    expect(affordable[0]!).toBeGreaterThan(affordable[3]!);
    for(const r of KANTO_REGIONS){
      const theoreticalMaxCoins=MAX_EXPEDITION_CYCLES*(r.id+6);
      expect(theoreticalMaxCoins).toBeGreaterThan(0);
      expect(theoreticalMaxCoins).toBeLessThanOrEqual(46080);
    }
  });
});
