import {describe,it,expect} from 'vitest';
import {
  KANTO_REGIONS,KANTO_POKEDEX,KANTO_BALLS,
  kantoRegion,kantoRegionForSpecies,kantoRegionCatalogInvariant,
  kantoRegionalEncounter,canUseKantoBall,
  canStartRegionalExpedition,cappedRegionalPokemonXp,xpThreshold,
  inspectKantoBallPocket,spendKantoBallForAttempt
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
    expect(KANTO_BALLS['master-ball'].guaranteedCapture).toBe(true);
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


describe('D-064 — Expedição por região e nível do Pokémon',()=>{
  it('Treinador Nv. 11 / Pokémon Nv. 5 só realiza região inicial',()=>{
    expect(canStartRegionalExpedition(11,5,1)).toBe(true);
    expect(canStartRegionalExpedition(11,5,2)).toBe(false);
    expect(canStartRegionalExpedition(11,10,2)).toBe(true);
    expect(canStartRegionalExpedition(9,10,2)).toBe(false);
    expect(canStartRegionalExpedition(11,10,3)).toBe(false);
  });
  it('corta XP do Pokémon exatamente ao alcançar Nv. 10 sem apagar XP prévio',()=>{
    const before={level:9,xp:xpThreshold('pokemon',9)-7};
    const reward=cappedRegionalPokemonXp(before,600,1);
    expect(reward).toEqual({level:10,xp:0,xpAccepted:7,xpDiscarded:593,capped:true});
    expect(cappedRegionalPokemonXp({level:10,xp:12},700,1))
      .toEqual({level:10,xp:12,xpAccepted:0,xpDiscarded:700,capped:true});
    const normal=cappedRegionalPokemonXp({level:5,xp:20},10,1);
    expect(normal).toMatchObject({level:5,xp:30,xpAccepted:10,xpDiscarded:0,capped:false});
  });
  it('nível acima do teto pode explorar área anterior só por moedas, sem XP',()=>{
    expect(canStartRegionalExpedition(90,25,1)).toBe(true);
    expect(cappedRegionalPokemonXp({level:25,xp:100},300,1))
      .toMatchObject({level:25,xp:100,xpAccepted:0,xpDiscarded:300,capped:true});
    expect(cappedRegionalPokemonXp({level:10,xp:0},10,11)).toBeNull();
  });
});


describe('D-064 — mochila de Poké Bolas e consumo por tentativa',()=>{
  it('não inventa estoque para saves antigos ou registros inválidos',()=>{
    expect(inspectKantoBallPocket(undefined).status).toBe('legacy-untracked');
    expect(inspectKantoBallPocket({version:1,quantities:{'fake-ball':1}}).status).toBe('invalid');
    expect(inspectKantoBallPocket({version:1,quantities:{'poke-ball':-5}}).status).toBe('invalid');
    expect(inspectKantoBallPocket({version:1,quantities:{'great-ball':3}}).status).toBe('valid');
  });
  it('debita somente uma unidade e bloqueia inventário insuficiente',()=>{
    const starting={version:1 as const,quantities:{'poke-ball':2,'ultra-ball':1}};
    const first=spendKantoBallForAttempt(starting,'poke-ball',16);
    expect(first.status).toBe('ok');
    if(first.status==='ok'){
      expect(first.pocket.quantities['poke-ball']).toBe(1);
      expect(starting.quantities['poke-ball']).toBe(2);
      const second=spendKantoBallForAttempt(first.pocket,'poke-ball',16);
      expect(second.status).toBe('ok');
      if(second.status==='ok'){
        expect(second.pocket.quantities['poke-ball']).toBe(0);
        expect(spendKantoBallForAttempt(second.pocket,'poke-ball',16).status).toBe('blocked');
      }
    }
    expect(spendKantoBallForAttempt(starting,'poke-ball',150).status).toBe('blocked');
    expect(spendKantoBallForAttempt(starting,'ultra-ball',150).status).toBe('ok');
    expect(spendKantoBallForAttempt({version:1,quantities:{'master-ball':1}},'master-ball',151).status).toBe('blocked');
  });
});
