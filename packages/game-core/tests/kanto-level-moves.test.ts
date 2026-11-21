import { describe,expect,it } from 'vitest';
import {
  KANTO_LEVELUP_SOURCE_COMMIT,KANTO_LEVELUP_VERSION_GROUP,
  KANTO_LEVELUP_DAMAGE_MOVES,kantoLevelMoves,KANTO_POKEDEX,KANTO_BATTLE_MOVES
} from '../src/index.js';
const names=(species:number,level:number)=>kantoLevelMoves(species,level).map(entry=>entry.move.name);

describe('aprendizado validado de golpes — PokéAPI FireRed/LeafGreen',()=>{
  it('fixa revisão PokeAPI, versão e somente habilidades de ataque elegíveis',()=>{
    expect(KANTO_LEVELUP_SOURCE_COMMIT)
      .toBe('ac2f1acb055026e3dff1e0aca743bb46256a810a');
    expect(KANTO_LEVELUP_VERSION_GROUP).toBe('firered-leafgreen');
    expect(Object.keys(KANTO_LEVELUP_DAMAGE_MOVES).length).toBeGreaterThanOrEqual(20);
    for(const [name,move] of Object.entries(KANTO_LEVELUP_DAMAGE_MOVES)){
      expect(move.name).toBe(name);
      expect(move.power).toBeGreaterThan(0);
      expect(move.power).toBeLessThanOrEqual(250);
      expect(move.accuracy).toBeGreaterThan(0);
      expect(move.accuracy).toBeLessThanOrEqual(100);
      expect(KANTO_BATTLE_MOVES[name]).toBeDefined();
    }
  });
  it('libera golpes apenas depois do nível real em FireRed/LeafGreen',()=>{
    expect(names(1,5)).toEqual(['tackle']);
    expect(names(1,10)).toEqual(['tackle','vine-whip']);
    expect(names(4,5)).toEqual(['scratch']);
    expect(names(4,7)).toContain('ember');
    expect(names(7,5)).toEqual(['tackle']);
    expect(names(7,7)).toContain('bubble');
    expect(names(7,13)).toContain('water-gun');
    expect(names(13,1)).toContain('poison-sting');
    expect(names(16,9)).toContain('gust');
    expect(names(16,13)).toContain('quick-attack');
    expect(names(25,11)).toContain('quick-attack');
    expect(names(74,10)).not.toContain('rock-throw');
    expect(names(74,11)).toContain('rock-throw');
  });
  it('não inventa golpe se espécie não possui movimento de dano elegível neste recorte',()=>{
    expect(names(129,5)).toEqual([]);
    expect(names(129,15)).toEqual(['tackle']);
    // D064AO: Swift é aprendido por Mewtwo no nível 33 (grupo FRLG 7).
    expect(names(150,32)).not.toContain('swift');
    expect(names(150,50)).toContain('swift');
    expect(names(0,5)).toEqual([]);
    expect(names(152,5)).toEqual([]);
    expect(names(1,0)).toEqual([]);
    expect(names(1,101)).toEqual([]);
    expect(names(1,NaN)).toEqual([]);
  });
  it('catálogo cobre os 151 IDs sem duplicatas ou learnsets impossíveis',()=>{
    let totalSpecies=0;
    for(const species of KANTO_POKEDEX){
      const rows=kantoLevelMoves(species.id,100);
      if(rows.length>0)totalSpecies++;
      expect(new Set(rows.map(row=>row.move.name)).size).toBe(rows.length);
      expect(rows.every(r=>r.learnedAt>=1&&r.learnedAt<=100)).toBe(true);
      for(const row of rows){
        expect(names(species.id,row.learnedAt)).toContain(row.move.name);
        if(row.learnedAt>1)expect(names(species.id,row.learnedAt-1)).not.toContain(row.move.name);
      }
    }
    // Antes do snapshot completo só 126 espécies tinham golpes neste recorte.
    expect(totalSpecies).toBe(135);
  });
});
