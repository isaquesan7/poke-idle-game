import {describe,it,expect} from 'vitest';
import {
  KANTO_REGIONS,KANTO_POKEDEX,KANTO_BALLS,
  kantoRegion,kantoRegionForSpecies,kantoRegionCatalogInvariant,
  kantoRegionalEncounter,canUseKantoBall
} from '../src/index.js';

describe('D-064 — mapa regional de Kanto, catálogo de 151',()=>{
  it('cobre todas as 151 espécies exatamente uma vez',()=>{
    expect(kantoRegionCatalogInvariant()).toBe(true);
    const ids=KANTO_REGIONS.flatMap(r=>r.speciesIds);
    expect(ids).toHaveLength(151);
    expect(new Set(ids).size).toBe(151);
    for(const species of KANTO_POKEDEX){
      const region=kantoRegionForSpecies(species.id);
      expect(region?.speciesIds).toContain(species.id);
      if(species.legendary||species.mythical)
        expect([9,10]).toContain(region?.id);
    }
  });
  it('restringe as aves a região 9 e Mewtwo/Mew a região 10',()=>{
    expect(kantoRegion(9)?.rareSpeciesIds).toEqual([144,145,146]);
    expect(kantoRegion(10)?.rareSpeciesIds).toEqual([150,151]);
    for(const id of [144,145,146])expect(kantoRegionForSpecies(id)?.id).toBe(9);
    for(const id of [150,151])expect(kantoRegionForSpecies(id)?.id).toBe(10);
    expect(kantoRegion(9)?.speciesIds.length).toBeGreaterThan(5);
    expect(kantoRegion(10)?.speciesIds.length).toBeGreaterThan(5);
  });
  it('sorteia somente espécies da região e níveis dentro da faixa',()=>{
    for(const region of KANTO_REGIONS){
      const encountered=new Set<number>();
      for(let seed=0;seed<11000;seed++){
        const result=kantoRegionalEncounter(region.id,seed,Math.min(100,region.levelMin+2));
        expect(result).not.toBeNull();
        expect(region.speciesIds).toContain(result!.speciesId);
        expect(result!.level).toBeGreaterThanOrEqual(region.levelMin);
        expect(result!.level).toBeLessThanOrEqual(region.levelMax);
        encountered.add(result!.speciesId);
      }
      expect(encountered.size).toBeGreaterThan(1);
      expect(kantoRegionalEncounter(region.id,12234,region.levelMin))
        .toEqual(kantoRegionalEncounter(region.id,12234,region.levelMin));
    }
    expect(kantoRegionalEncounter(11,123,10)).toBeNull();
    expect(kantoRegionalEncounter(1,-1,5)).toBeNull();
  });
});

describe('D-064 — política das Poké Bolas',()=>{
  it('mantém multiplicadores tradicionais e Master Ball manual desativada',()=>{
    expect(KANTO_BALLS['poke-ball'].catchModifier).toBe(1);
    expect(KANTO_BALLS['great-ball'].catchModifier).toBe(1.5);
    expect(KANTO_BALLS['ultra-ball'].catchModifier).toBe(2);
    expect(KANTO_BALLS['master-ball'].automaticUse).toBe(false);
    expect(KANTO_BALLS['master-ball'].conventionalShop).toBe(false);
  });
  it('exige item no estoque e Ultra Ball para lendários e míticos',()=>{
    for(const id of [144,145,146,150,151]){
      expect(canUseKantoBall('poke-ball',id,5).ok).toBe(false);
      expect(canUseKantoBall('great-ball',id,5).ok).toBe(false);
      const result=canUseKantoBall('ultra-ball',id,1);
      expect(result.ok).toBe(true);
      if(result.ok)expect(result.baseCatchRate).toBeGreaterThan(0);
    }
    expect(canUseKantoBall('poke-ball',10,1).ok).toBe(true);
    expect(canUseKantoBall('great-ball',10,1).ok).toBe(true);
    expect(canUseKantoBall('ultra-ball',10,1).ok).toBe(true);
    expect(canUseKantoBall('master-ball',150,1).ok).toBe(false);
    expect(canUseKantoBall('ultra-ball',150,0).ok).toBe(false);
    expect(canUseKantoBall('fake-ball',10,1).ok).toBe(false);
  });
});
