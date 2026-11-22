import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,beginnerBattleXp,battleProgressFactor,battleTrainerXp,
  emptyExpeditionBallProgress,expeditionRewards,grantXp,scaledRegionalReward
} from '../src/index.js';
import type {LevelProgress} from '../src/index.js';

const EIGHT_HOURS=8*60*60*1000;
const regionFor=(trainer:number,pokemon:number)=>[...KANTO_REGIONS].reverse().find(r=>
  trainer>=r.trainerUnlockLevel&&pokemon>=r.levelMin
);
const winAgainst=(trainer:LevelProgress,pokemon:LevelProgress,wildLevel:number)=>{
  // Cenário hipotético de 100% vitórias. Concede EXATAMENTE o XP
  // do writer regional, sem executar IA, RNG ou validar chance de vencer.
  const factor=battleProgressFactor(pokemon.level,wildLevel);
  const trainerGain=scaledRegionalReward(battleTrainerXp(wildLevel),factor);
  const pokemonGain=scaledRegionalReward(20+6*wildLevel,factor);
  return {trainer:grantXp('trainer',trainer,trainerGain),
    pokemon:grantXp('pokemon',pokemon,pokemonGain),factor,trainerGain,pokemonGain};
};

describe('D064BL — lacuna da progressão mista e caminhos de recuperação',()=>{
  it('inicial Nv1 precisa de quatro derrotas/empates para começar a expedição Nv2',()=>{
    let pokemon:LevelProgress={level:1,xp:0};
    expect(regionFor(1,pokemon.level)).toBeUndefined();
    for(let battle=0;battle<4;battle++){
      pokemon=grantXp('pokemon',pokemon,beginnerBattleXp(pokemon.level,'loss'));
    }
    expect(pokemon).toEqual({level:2,xp:1});
    expect(regionFor(1,pokemon.level)?.id).toBe(1);
  });

  it('confronta 4 resgates de 8h com desbloqueios reais: estagna em R3, treinador Nv19',()=>{
    let trainer:LevelProgress={level:1,xp:0};
    let pokemon:LevelProgress={level:2,xp:0}; // início ideal após alcançar Lv2
    const regionIds:number[]=[];
    for(let claim=0;claim<4;claim++){
      const region=regionFor(trainer.level,pokemon.level);
      expect(region).toBeDefined();
      regionIds.push(region!.id);
      const result=expeditionRewards(EIGHT_HOURS,{
        regionId:region!.id,pokemon:[pokemon],ballProgress:emptyExpeditionBallProgress()
      });
      trainer=grantXp('trainer',trainer,result.trainerXp);
      pokemon=grantXp('pokemon',pokemon,result.pokemonXpPerMember);
    }
    expect(regionIds).toEqual([1,2,3,3]);
    expect(trainer).toEqual({level:19,xp:1139});
    expect(pokemon).toEqual({level:41,xp:0});
    expect(regionFor(trainer.level,pokemon.level)?.id).toBe(3);
  });

  it('até com 100% de vitórias contra selvagem Nv30, parceiro único Nv41 esgota XP antes de R4',()=>{
    let trainer:LevelProgress={level:19,xp:1139};
    let pokemon:LevelProgress={level:41,xp:0};
    let wins=0;
    for(;wins<200;wins++){
      const next=winAgainst(trainer,pokemon,30); // nível máximo da região 3
      if(next.factor===0)break;
      trainer=next.trainer;
      pokemon=next.pokemon;
    }
    expect(wins).toBe(49);
    expect(trainer).toEqual({level:19,xp:1825});
    expect(pokemon).toEqual({level:42,xp:13});
    expect(winAgainst(trainer,pokemon,30)).toMatchObject({
      factor:0,trainerGain:0,pokemonGain:0
    });
    expect(regionFor(trainer.level,pokemon.level)?.id).toBe(3);
    // Não prova perda definitiva: outros UIDs podem entrar no time.
    // Prova, porém, que XP regional desse único Pokémon não basta.
  });

  it('reserva já treinada Nv30 pode abrir R4 com 7 vitórias ideais; não presume vitória automática',()=>{
    let trainer:LevelProgress={level:19,xp:1139};
    let reserve:LevelProgress={level:30,xp:0};
    for(let win=0;win<7;win++){
      const next=winAgainst(trainer,reserve,30);
      expect(next.factor).toBe(1);
      trainer=next.trainer;
      reserve=next.pokemon;
    }
    expect(trainer.level).toBe(20);
    expect(reserve.level).toBeGreaterThanOrEqual(31);
    expect(regionFor(trainer.level,reserve.level)?.id).toBe(4);
  });

  it('redutores de sobre-nível não geram XP para treinador por vitórias repetidas sem faixa',()=>{
    for(const level of [42,60,90,100]){
      const result=winAgainst({level:19,xp:0},{level,xp:0},30);
      expect(result.trainerGain).toBe(0);
      expect(result.pokemonGain).toBe(0);
    }
  });
});
