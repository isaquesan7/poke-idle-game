import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,battleProgressFactor,expeditionRewards,
  grantXp,xpThreshold
} from '../src/index.js';

/**
 * D064BM — ajustar somente custo de nível do Pokémon após o Lv20, não
 * alterar recompensas, curva de treinador, raridade das bolas nem anti-farm.
 */
describe('D064BM — curva de nível Pokémon tardio',()=>{
  it('preserva integralmente níveis 1–20 e início da região 1',()=>{
    for(let level=1;level<=20;level++){
      expect(xpThreshold('pokemon',level)).toBe(65+22*level);
    }
    const oldFirstClaim=expeditionRewards(8*60*60*1000,{
      regionId:1,pokemon:[{level:2,xp:0}]
    });
    expect(oldFirstClaim).toMatchObject({
      cycles:2880,coins:8039,trainerXp:4164,
      pokemonXpPerMember:5833,affinityGainPerMember:0
    });
    expect(grantXp('pokemon',{level:2,xp:0},oldFirstClaim.pokemonXpPerMember))
      .toMatchObject({level:21,xp:0});
  });
  it('escala quadraticamente apenas depois do nível 20 e preserva XP seguro',()=>{
    const formula=(L:number)=>65+L*22+7*Math.max(0,L-20)**2;
    for(let level=1;level<=100;level++){
      expect(xpThreshold('pokemon',level)).toBe(formula(level));
      if(level>1)expect(xpThreshold('pokemon',level))
        .toBeGreaterThan(xpThreshold('pokemon',level-1));
    }
    expect(xpThreshold('pokemon',21)).toBe(534);
    expect(xpThreshold('pokemon',30)).toBe(1425);
    expect(xpThreshold('pokemon',50)).toBe(7465);
    expect(xpThreshold('pokemon',90)).toBe(36345);
    expect(xpThreshold('trainer',55)).toBe(12653);
  });
  it('não reduz nível nem corrói XP dos saves antigos só por mudar a fórmula',()=>{
    for(const level of [1,20,21,30,41,70,90,99]){
      const oldXp=65+22*level-1;
      const after=grantXp('pokemon',{level,xp:oldXp},0);
      expect(after).toMatchObject({level,xp:oldXp,gainedLevels:0});
    }
    expect(grantXp('pokemon',{level:100,xp:0},1000000))
      .toMatchObject({level:100,xp:0,gainedLevels:0});
  });
  it('regra de anti-farm permanece intacta em todas as regiões',()=>{
    for(const region of KANTO_REGIONS){
      if(region.levelMax+2<=100)
        expect(battleProgressFactor(region.levelMax+2,region.levelMax)).toBe(1);
      if(region.levelMax+11<=100)
        expect(battleProgressFactor(region.levelMax+11,region.levelMax)).toBe(.1);
      if(region.levelMax+12<=100)
        expect(battleProgressFactor(region.levelMax+12,region.levelMax)).toBe(0);
    }
  });
});
