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

describe('D064BM — recuperar avanço sem enfraquecer a régua regional',()=>{
  it('inicial Nv1 continua precisando de quatro derrotas/empates para começar a expedição Nv2',()=>{
    let pokemon:LevelProgress={level:1,xp:0};
    expect(regionFor(1,pokemon.level)).toBeUndefined();
    for(let battle=0;battle<4;battle++)
      pokemon=grantXp('pokemon',pokemon,beginnerBattleXp(pokemon.level,'loss'));
    expect(pokemon).toMatchObject({level:2,xp:1});
    expect(regionFor(1,pokemon.level)?.id).toBe(1);
  });

  it('os mesmos quatro resgates de 8h alcançam R4 com gates do treinador INALTERADOS',()=>{
    let trainer:LevelProgress={level:1,xp:0};
    let pokemon:LevelProgress={level:2,xp:0};
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
    expect(regionIds).toEqual([1,2,3,4]);
    expect(trainer.level).toBeGreaterThanOrEqual(20);
    expect(pokemon.level).toBeGreaterThanOrEqual(31);
    expect(regionFor(trainer.level,pokemon.level)!.id).toBeGreaterThanOrEqual(4);
    // D064BL é baseline HISTÓRICO, não exigir o velho bloqueio Lv19/Lv41.
  });

  it('estado legado Lv19 + único Pokémon Lv41 consegue liberar R4 antes de atingir +12',()=>{
    let trainer:LevelProgress={level:19,xp:1139};
    let pokemon:LevelProgress={level:41,xp:0};
    for(let win=0;win<67;win++){
      const next=winAgainst(trainer,pokemon,30);
      expect(next.factor).toBe(.1);
      expect(next.trainerGain).toBe(14);
      expect(next.pokemonGain).toBe(20);
      trainer=next.trainer;
      pokemon=next.pokemon;
      if(win===65)expect(trainer.level).toBe(19);
    }
    expect(trainer).toMatchObject({level:20,xp:8});
    expect(pokemon).toMatchObject({level:41,xp:1340});
    expect(regionFor(trainer.level,pokemon.level)?.id).toBe(4);
    // Sem XP grátis: 67 vitórias são um cenário IDEAL, não garantido pela IA.
  });

  it('uma reserva Nv30 também permite recuperação com combates dentro da faixa',()=>{
    let trainer:LevelProgress={level:19,xp:1139};
    let reserve:LevelProgress={level:30,xp:0};
    for(let win=0;win<8;win++){
      const next=winAgainst(trainer,reserve,30);
      expect(next.factor).toBe(1);
      trainer=next.trainer;
      reserve=next.pokemon;
    }
    expect(trainer.level).toBeGreaterThanOrEqual(20);
    expect(reserve.level).toBeGreaterThanOrEqual(31);
    expect(regionFor(trainer.level,reserve.level)?.id).toBe(4);
  });

  it('mantém zero XP de vitória quando diferença chega a +12',()=>{
    for(const level of [42,60,90,100]){
      const result=winAgainst({level:19,xp:0},{level,xp:0},30);
      expect(result.trainerGain).toBe(0);
      expect(result.pokemonGain).toBe(0);
      expect(result.factor).toBe(0);
    }
  });
});
