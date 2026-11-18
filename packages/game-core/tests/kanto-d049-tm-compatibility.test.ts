import {describe,expect,it} from 'vitest';
import {
  KANTO_TM_SOURCE_COMMIT,KANTO_TM_SOURCE_BLOBS,
  KANTO_TM09_COMPATIBILITY_SOURCE,KANTO_TM09_COMPATIBLE_SPECIES,
  kantoTm09SpeciesCompatible,kantoTmIsTeachEnabled,
  KANTO_BATTLE_MOVES,KANTO_MULTI_HIT_MOVES
} from '../src/index.js';

describe('D-049 — compatibilidade TM09 histórica, somente leitura',()=>{
  it('prende allowlist ao snapshot FRLG e ao método máquina',()=>{
    expect(KANTO_TM09_COMPATIBILITY_SOURCE).toMatchObject({
      commit:KANTO_TM_SOURCE_COMMIT,
      blobSha1:KANTO_TM_SOURCE_BLOBS.pokemonMoves,
      versionGroupId:7,moveId:331,learnMethodId:4,
      kantoMatchingRows:15,nonKantoMatchingRows:29,
      state:'verified-read-only'
    });
    expect(Object.isFrozen(KANTO_TM09_COMPATIBILITY_SOURCE)).toBe(true);
    expect(Object.isFrozen(KANTO_TM09_COMPATIBLE_SPECIES)).toBe(true);
    expect([...KANTO_TM09_COMPATIBLE_SPECIES]).toEqual(
      [1,2,3,43,44,45,46,47,69,70,71,102,103,114,151]
    );
  });

  it('confere exatamente as 151 espécies e rejeita IDs/formatos inválidos',()=>{
    const positive=new Set<number>(KANTO_TM09_COMPATIBLE_SPECIES);
    let count=0;
    for(let speciesId=1;speciesId<=151;speciesId++){
      const allowed=positive.has(speciesId);
      expect(kantoTm09SpeciesCompatible(speciesId)).toBe(allowed);
      if(allowed)count++;
      // Compatibilidade não equivale à licença para ensinar.
      expect(kantoTmIsTeachEnabled('tm09',speciesId)).toBe(false);
    }
    expect(count).toBe(15);
    for(const bad of [0,-1,152,1.5,NaN,Infinity,-Infinity]){
      expect(kantoTm09SpeciesCompatible(bad)).toBe(false);
      expect(kantoTmIsTeachEnabled('tm09',bad)).toBe(false);
    }
  });

  it('não insere Bullet Seed no catálogo de golpes nem multi-hit',()=>{
    expect(KANTO_BATTLE_MOVES['bullet-seed']).toBeUndefined();
    expect(KANTO_MULTI_HIT_MOVES['bullet-seed']).toBeUndefined();
  });
});
