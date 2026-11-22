import {describe,expect,it} from 'vitest';
import {battleTrainerXp,grantXp,xpThreshold} from '../src/index.js';

describe('D-064AJ — progressão longa do treinador',()=>{
  it('custa dezenas de vitórias para avançar no trecho da Costa Oceânica',()=>{
    expect(battleTrainerXp(65)).toBe(245);
    expect(xpThreshold('trainer',55)).toBe(12653);
    const fifty=grantXp('trainer',{level:55,xp:0},50*battleTrainerXp(65));
    expect(fifty.level).toBe(55);
    const hundred=grantXp('trainer',{level:55,xp:0},100*battleTrainerXp(65));
    expect(hundred.level).toBe(56);
    expect(hundred.gainedLevels).toBe(1);
  });
  it('cresce quadraticamente e preserva o teto do treinador',()=>{
    expect(xpThreshold('trainer',82)).toBeGreaterThan(xpThreshold('trainer',55));
    expect(xpThreshold('trainer',95)).toBeGreaterThan(xpThreshold('trainer',82));
    expect(grantXp('trainer',{level:100,xp:0},battleTrainerXp(100)).level).toBe(100);
  });
  it('D064BM: preserva Pokémon Lv1–20 e introduz curva tardia sem alterar treinador',()=>{
    for(let level=1;level<=20;level++)
      expect(xpThreshold('pokemon',level)).toBe(65+level*22);
    expect(xpThreshold('pokemon',21)).toBe(65+21*22+7);
    expect(xpThreshold('pokemon',55)).toBe(65+55*22+7*35*35);
    expect(xpThreshold('pokemon',100)).toBe(65+100*22+7*80*80);
    expect(xpThreshold('trainer',55)).toBe(12653);
    expect(()=>battleTrainerXp(-1)).toThrow();
    expect(()=>battleTrainerXp(101)).toThrow();
    expect(()=>battleTrainerXp(64.5)).toThrow();
  });
});
