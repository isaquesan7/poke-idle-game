import { describe, expect, it } from 'vitest';
import {
  KANTO_POKEDEX, KANTO_CATALOG_SOURCE_COMMIT, kantoSpecies, kantoDexStatus,
  KANTO_WILD_POOL, KANTO_BATTLE_SPECIES, pokemonOwnStats,
  zeroStats, simulateKantoBattle
} from '../src/index.js';

describe('Pokédex 151 — catálogo estático PokéAPI versionado',()=>{
  it('contém EXATAMENTE IDs nacionais 1–151 e 6 atributos válidos, sem formas duplicadas',()=>{
    expect(KANTO_POKEDEX).toHaveLength(151);
    expect(KANTO_CATALOG_SOURCE_COMMIT)
      .toBe('ac2f1acb055026e3dff1e0aca743bb46256a810a');
    expect(KANTO_POKEDEX.map(species=>species.id))
      .toEqual(Array.from({length:151},(_,i)=>i+1));
    const seenNames=new Set<string>();
    for(const species of KANTO_POKEDEX){
      expect(species.name.trim().length).toBeGreaterThan(1);
      expect(seenNames.has(species.name)).toBe(false);
      seenNames.add(species.name);
      expect(species.types.length).toBeGreaterThanOrEqual(1);
      expect(species.types.length).toBeLessThanOrEqual(2);
      expect(new Set(species.types).size).toBe(species.types.length);
      expect(Number.isInteger(species.captureRate)).toBe(true);
      expect(species.captureRate).toBeGreaterThanOrEqual(0);
      expect(species.captureRate).toBeLessThanOrEqual(255);
      for(const stat of ['hp','attack','defense','specialAttack','specialDefense','speed'] as const){
        expect(Number.isSafeInteger(species.base[stat])).toBe(true);
        expect(species.base[stat]).toBeGreaterThan(0);
      }
      expect(KANTO_BATTLE_SPECIES[species.id]?.name).toBe(species.name);
      expect(KANTO_BATTLE_SPECIES[species.id]?.base).toEqual(species.base);
    }
    expect(kantoSpecies(0)).toBeNull();
    expect(kantoSpecies(152)).toBeNull();
    expect(kantoSpecies(1.5)).toBeNull();
    expect(kantoSpecies(NaN)).toBeNull();
  });

  it('inclui valores de referência oficiais e liga evolução, lendários e míticos',()=>{
    expect(kantoSpecies(1)?.base).toEqual({
      hp:45,attack:49,defense:49,specialAttack:65,specialDefense:65,speed:45
    });
    expect(kantoSpecies(6)?.types).toEqual(['fire','flying']);
    expect(kantoSpecies(29)?.name).toBe('Nidoran♀');
    expect(kantoSpecies(83)?.name).toBe('Farfetch’d');
    expect(kantoSpecies(122)?.name).toBe('Mr. Mime');
    expect(kantoSpecies(133)?.name).toBe('Eevee');
    expect(kantoSpecies(149)?.base.attack).toBe(134);
    expect(kantoSpecies(150)?.legendary).toBe(true);
    expect(kantoSpecies(151)?.mythical).toBe(true);
    expect(kantoSpecies(2)?.evolvesFrom).toBe(1);
    // O CSV moderno pode referenciar pré-evolução de outra geração.
    expect(kantoSpecies(122)?.evolvesFrom).toBe(439);
  });

  it('captura prevalece sobre visto; UID duplicado não duplica espécie capturada',()=>{
    const seen=new Set([1,10,25]);
    const caught=new Set([1,16]);
    expect(kantoDexStatus(1,seen,caught)).toBe('caught');
    expect(kantoDexStatus(16,seen,caught)).toBe('caught');
    expect(kantoDexStatus(10,seen,caught)).toBe('seen');
    expect(kantoDexStatus(25,seen,caught)).toBe('seen');
    expect(kantoDexStatus(150,seen,caught)).toBe('unknown');
    expect(kantoDexStatus(152,seen,caught)).toBe('unknown');
  });

  it('54 encontros ampliados: sem duplicata, lendário ou mítico; originais preservados',()=>{
    expect(KANTO_WILD_POOL).toHaveLength(54);
    expect(new Set(KANTO_WILD_POOL).size).toBe(KANTO_WILD_POOL.length);
    expect(KANTO_WILD_POOL.slice(0,8)).toEqual([10,16,19,25,37,43,60,74]);
    for(const id of KANTO_WILD_POOL){
      const species=kantoSpecies(id);
      expect(species).not.toBeNull();
      expect(species!.legendary).toBe(false);
      expect(species!.mythical).toBe(false);
      expect(KANTO_BATTLE_SPECIES[id]?.move.power).toBeGreaterThan(0);
      expect(KANTO_BATTLE_SPECIES[id]?.types).toEqual(species?.types);
    }
  });

  it('todas as 151 espécies possuem combatente válido, sem inventar atributos zerados',()=>{
    for(const species of KANTO_POKEDEX){
      const battle=KANTO_BATTLE_SPECIES[species.id]!;
      const own=pokemonOwnStats(species.base,10,zeroStats());
      expect(own.hp).toBeGreaterThan(0);
      const actor={speciesId:species.id,name:species.name,
        level:10,types:species.types,stats:own,move:battle.move,rank:0};
      const enemy=KANTO_BATTLE_SPECIES[10]!;
      const target={speciesId:enemy.id,name:enemy.name,level:10,
        types:enemy.types,stats:pokemonOwnStats(enemy.base,10,zeroStats()),
        move:enemy.move,rank:0};
      const result=simulateKantoBattle(actor,target,species.id);
      expect(result.turns).toBeGreaterThan(0);
      expect(result.turns).toBeLessThanOrEqual(30);
      expect(result.wildSpeciesId).toBe(10);
    }
  });

  it('mantém golpes antigos dos 11 combatentes para não alterar save/arena alfa anterior',()=>{
    const expected:Record<number,string>={
      1:'vine-whip',4:'ember',7:'water-gun',
      10:'tackle',16:'gust',19:'quick-attack',25:'thunder-shock',
      37:'ember',43:'absorb',60:'bubble',74:'rock-throw'
    };
    for(const [id,move] of Object.entries(expected)){
      expect(KANTO_BATTLE_SPECIES[Number(id)]?.move.name).toBe(move);
    }
  });
});
