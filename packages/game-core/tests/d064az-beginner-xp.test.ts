/** D064AZ — aprendizado limitado após derrota/empate no nível 1. */
import {describe,it,expect} from 'vitest';
import {beginnerBattleXp,xpThreshold,grantXp} from '../src/index.js';

describe('D064AZ — proteção de XP para iniciais nível 1',()=>{
  it('quatro derrotas/empates permitem sair do nível 1; depois não dão XP',()=>{
    expect(xpThreshold('pokemon',1)).toBe(87);
    let progress={level:1,xp:0};
    for(const outcome of ['loss','draw','loss','loss'] as const){
      const xp=beginnerBattleXp(progress.level,outcome);
      expect(xp).toBe(22);
      progress=grantXp('pokemon',progress,xp);
    }
    expect(progress).toEqual({level:2,xp:1});
    expect(beginnerBattleXp(progress.level,'loss')).toBe(0);
    expect(beginnerBattleXp(1,'win')).toBe(0);
    expect(beginnerBattleXp(20,'draw')).toBe(0);
    expect(beginnerBattleXp(100,'loss')).toBe(0);
  });
  it('validação explícita de níveis fora do domínio',()=>{
    for(const bad of [0,-1,101,1.5,Number.NaN,Number.POSITIVE_INFINITY]){
      expect(()=>beginnerBattleXp(bad,'loss')).toThrow(RangeError);
    }
  });
});
