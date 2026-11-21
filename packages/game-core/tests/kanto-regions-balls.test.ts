import {describe,it,expect} from 'vitest';
import {
  KANTO_REGIONS,KANTO_POKEDEX,KANTO_BALLS,
  kantoRegion,kantoRegionForSpecies,kantoRegionCatalogInvariant,
  kantoRegionalEncounter,canUseKantoBall,
  canStartRegionalExpedition,cappedRegionalPokemonXp,xpThreshold,
  inspectKantoBallPocket,spendKantoBallForAttempt,
  d064DraftXpThreshold,d064DraftBattleReward,d064DraftSimulateWins,
  previewKantoRegionalBattle,KANTO_BATTLE_SPECIES,pokemonOwnStats,zeroStats,
  d064CaptureProjection
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
      for(let seed=0;seed<2000;seed++){
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
    expect(canStartRegionalExpedition(5,10,2)).toBe(false);
    expect(canStartRegionalExpedition(11,10,3)).toBe(false);
    expect(canStartRegionalExpedition(11,20,3)).toBe(false);
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


describe('D-064E — curva de XP/moedas experimental, sem rewards ativos',()=>{
  it('torna o treino do treinador mais lento que o Pokémon no cenário otimista',()=>{
    const stats=d064DraftSimulateWins(1200);
    expect(stats).not.toBeNull();
    expect(stats!.pokemon.level).toBeGreaterThan(stats!.trainer.level+20);
    expect(stats!.milestoneWins['pokemon-40']!).toBeLessThan(stats!.milestoneWins['trainer-40']!);
    expect(stats!.milestoneWins['trainer-40']!).toBeGreaterThan(300);
    expect(stats!.milestoneWins['trainer-40']!).toBeLessThan(800);
  });
  it('exige milhares de vitórias para treinador Nv.100 (sem Expedição)',()=>{
    const stats=d064DraftSimulateWins(5000)!;
    expect(stats.trainer.level).toBe(100);
    expect(stats.milestoneWins['trainer-100']!).toBeGreaterThan(2500);
    expect(stats.milestoneWins['trainer-100']!).toBeLessThan(5000);
    expect(stats.milestoneWins['pokemon-100']!).toBeLessThan(stats.milestoneWins['trainer-100']!);
    expect(stats.totalCoins).toBeGreaterThan(0);
  });
  it('rejeita níveis inválidos, não promove recompensas reais',()=>{
    expect(d064DraftXpThreshold('trainer',1)).toBe(132);
    expect(d064DraftXpThreshold('trainer',100)).toBeNull();
    expect(d064DraftXpThreshold('pokemon',-1)).toBeNull();
    expect(d064DraftBattleReward(10)).toEqual({coins:15,trainerXp:25,pokemonXp:57});
    expect(d064DraftBattleReward(0)).toBeNull();
    expect(d064DraftSimulateWins(-1)).toBeNull();
  });
});


describe('D-064F — simulação regional REAL sem recompensas',()=>{
  const starter=KANTO_BATTLE_SPECIES[4]!;
  function leader(level:number){
    return {
      speciesId:starter.id,name:starter.name,level,types:starter.types,
      stats:pokemonOwnStats(starter.base,level,zeroStats()),
      move:starter.move,rank:0
    };
  }
  it('bloqueia nível de Treinador insuficiente e região inexistente',()=>{
    expect(previewKantoRegionalBattle(1,2,leader(5),123).status).toBe('blocked');
    expect(previewKantoRegionalBattle(5,2,leader(20),123).status).toBe('blocked');
    expect(previewKantoRegionalBattle(100,11,leader(20),123).status).toBe('blocked');
    expect(previewKantoRegionalBattle(100,1,leader(20),-1).status).toBe('blocked');
  });
  it('deriva inimigos e níveis apenas da pool da região e não oferece capturas',()=>{
    for(const region of KANTO_REGIONS){
      for(const seed of [0,1,7,33,100,999,1234567890]){
        const resolved=previewKantoRegionalBattle(100,region.id,leader(region.levelMin),seed);
        expect(resolved.status).toBe('ready');
        if(resolved.status!=='ready')continue;
        const fight=resolved.preview;
        expect(region.speciesIds).toContain(fight.wildSpeciesId);
        expect(fight.wildLevel).toBeGreaterThanOrEqual(region.levelMin);
        expect(fight.wildLevel).toBeLessThanOrEqual(region.levelMax);
        expect(fight.battle.wildSpeciesId).toBe(fight.wildSpeciesId);
        expect(fight.battle.log.length).toBeGreaterThan(0);
        expect(fight.battle.frames.length).toBe(fight.battle.log.length);
        expect(fight.captureDisabled).toBe(true);
        expect('captured' in fight.battle).toBe(false);
        expect(fight.battle.log.some(line=>line.startsWith('Captura!'))).toBe(false);
        expect(fight.battle.log.some(line=>line.includes('Recompensas de combate recebidas'))).toBe(false);
      }
    }
  });
  it('simulação idêntica para a mesma seed, sem mutar combatente',()=>{
    const p=leader(14);
    const before=JSON.stringify(p);
    const first=previewKantoRegionalBattle(20,2,p,777);
    const second=previewKantoRegionalBattle(20,2,p,777);
    expect(first).toEqual(second);
    expect(JSON.stringify(p)).toBe(before);
  });
});


describe('D-064G — probabilidade teórica de completar Kanto',()=>{
  it('calcula encontros muito raros com Ultra Ball, sem habilitar captura',()=>{
    const bird=d064CaptureProjection(144,9,'ultra-ball',100,0);
    const mew=d064CaptureProjection(151,10,'ultra-ball',100,0);
    expect(bird).not.toBeNull();
    expect(mew).not.toBeNull();
    expect(bird!.appearanceChance).toBeCloseTo(1/843,8);
    expect(mew!.appearanceChance).toBeCloseTo(1/1682,8);
    expect(mew!.appearanceChance).toBeLessThan(bird!.appearanceChance);
    expect(bird!.captureChance).toBeGreaterThan(0);
    expect(mew!.captureChance).toBeGreaterThan(0);
    expect(mew!.expectedBattlesPerCapture).toBeGreaterThan(10000);
  });
  it('impede captura dos raros com bolas comuns e rejeita Master automática',()=>{
    expect(d064CaptureProjection(144,9,'poke-ball',100,0)).toBeNull();
    expect(d064CaptureProjection(150,10,'great-ball',100,0)).toBeNull();
    expect(d064CaptureProjection(151,10,'master-ball',100,0)).toBeNull();
    expect(d064CaptureProjection(151,9,'ultra-ball',100,0)).toBeNull();
    expect(d064CaptureProjection(16,1,'poke-ball',100,100)).not.toBeNull();
    expect(d064CaptureProjection(16,1,'great-ball',100,100)!.captureChance)
      .toBeGreaterThan(d064CaptureProjection(16,1,'poke-ball',100,100)!.captureChance);
  });
});
