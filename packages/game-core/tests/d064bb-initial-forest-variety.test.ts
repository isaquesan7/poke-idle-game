/** D064BB: variedade da região inicial, sem ajustar IA, XP ou chances. */
import {describe,expect,it} from 'vitest';
import {KANTO_REGIONS,KANTO_BATTLE_SPECIES,kantoRegionCatalogInvariant,kantoRegionalEncounter}
  from '../src/index.js';

describe('D064BB — variedade do Bosque Inicial',()=>{
  it('preserva cada espécie Kanto uma única vez e os lendários nas regiões finais',()=>{
    expect(kantoRegionCatalogInvariant()).toBe(true);
    const all=KANTO_REGIONS.flatMap(region=>region.speciesIds);
    expect(all).toHaveLength(151);
    expect(new Set(all).size).toBe(151);
    expect(KANTO_REGIONS[8]!.rareSpeciesIds).toEqual([144,145,146]);
    expect(KANTO_REGIONS[9]!.rareSpeciesIds).toEqual([150,151]);
  });

  it('inclui água e mantém os encontros clássicos de planta, inseto e voador',()=>{
    const bosque=KANTO_REGIONS[0]!;
    const ids=bosque.speciesIds;
    expect(ids).toHaveLength(15);
    for(const id of [1,4,7,10,13,16,21,43,46,48,69,54,60]){
      expect(ids).toContain(id);
    }
    expect(ids).not.toContain(19);
    expect(ids).not.toContain(52);
    const water=ids.filter(id=>KANTO_BATTLE_SPECIES[id]?.types.includes('water'));
    expect(water).toEqual([54,60,7]);
    expect(KANTO_REGIONS[2]!.speciesIds).toContain(19);
    expect(KANTO_REGIONS[3]!.speciesIds).toContain(52);
  });

  it('mantém acesso uniforme e sorteio reproduzível, sem privilegiar inicial',()=>{
    const bosque=KANTO_REGIONS[0]!;
    const counts=new Map<number,number>();
    for(let seed=0;seed<1500;seed++){
      const a=kantoRegionalEncounter(1,seed,1);
      const b=kantoRegionalEncounter(1,seed,1);
      expect(a).toEqual(b);
      expect(a).not.toBeNull();
      expect(a!.level).toBeGreaterThanOrEqual(2);
      expect(a!.level).toBeLessThanOrEqual(10);
      counts.set(a!.speciesId,(counts.get(a!.speciesId)??0)+1);
    }
    expect(counts.size).toBe(15);
    for(const id of bosque.speciesIds)expect(counts.get(id)).toBe(100);
  });
});
