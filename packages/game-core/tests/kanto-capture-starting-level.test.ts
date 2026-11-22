import {describe,expect,it} from 'vitest';
import {kantoCaptureStartingLevel,KANTO_EVOLUTION_RULES} from '../src/index.js';

describe('D064BF — nível inicial de capturas por espécie',()=>{
  it('inicia toda forma básica ou sem pré-evolução no nível 1',()=>{
    for(const id of [1,4,7,77,133,144,145,146,150,151]){
      expect(kantoCaptureStartingLevel(id)).toBe(1);
    }
  });
  it('respeita o requisito da espécie evoluída, sem usar o nível selvagem',()=>{
    expect(kantoCaptureStartingLevel(78)).toBe(40); // Ponyta → Rapidash
    expect(kantoCaptureStartingLevel(6)).toBe(36); // Charmander → Charmeleon → Charizard
    expect(kantoCaptureStartingLevel(149)).toBe(55); // Dratini → Dragonair → Dragonite
    expect(kantoCaptureStartingLevel(148)).toBe(30);
    expect(kantoCaptureStartingLevel(20)).toBe(20);
    expect(kantoCaptureStartingLevel(3)).toBe(32);
  });
  it('pedra e troca não inventam nível, mas preservam piso de fases anteriores',()=>{
    expect(kantoCaptureStartingLevel(26)).toBe(1); // Pikachu → Raichu por pedra
    expect(kantoCaptureStartingLevel(65)).toBe(16); // Kadabra → Alakazam por troca
    expect(kantoCaptureStartingLevel(45)).toBe(21); // Gloom → Vileplume por pedra
    expect(kantoCaptureStartingLevel(136)).toBe(1); // Eevee → Flareon por pedra
  });
  it('cobre 151 espécies, é determinístico e rejeita ID inválido',()=>{
    expect(KANTO_EVOLUTION_RULES.length).toBeGreaterThan(60);
    for(let id=1;id<=151;id++){
      const n=kantoCaptureStartingLevel(id);
      expect(Number.isSafeInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(100);
      expect(kantoCaptureStartingLevel(id)).toBe(n);
    }
    for(const id of [0,-1,152,1.5,NaN])expect(()=>kantoCaptureStartingLevel(id)).toThrow();
  });
});
