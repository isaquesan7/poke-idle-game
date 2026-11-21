import {describe,expect,it} from 'vitest';
import {KANTO_REGIONS,kantoRegionCatalogInvariant,kantoRegionalEncounter} from '@kanto/game-core';
import {createPlaySave,readPlaySave,updatePlaySave,PLAY_SAVE_KEY} from '../src/play/playSave';
import type {PlayStorage} from '../src/play/playSave';

function setup(demo=true){
  const map=new Map<string,string>();
  const storage:PlayStorage={
    getItem:key=>map.get(key)??null,
    setItem:(key,value)=>{map.set(key,value);},
    removeItem:key=>{map.delete(key);}
  };
  expect(createPlaySave(storage,'Beta Kanto',1,1000,demo).status).toBe('ok');
  return{map,storage};
}
function inspect(storage:PlayStorage){
  const read=readPlaySave(storage);
  if(read.status!=='ready')throw Error('Save não pronto');
  return{
    snapshot:read.snapshot,
    game:JSON.parse(read.snapshot.journal.raw) as {
      wins:number;coins:number;regionWins:number[];
      ballPocket:{version:number;quantities:Record<string,number>};
      lastBattle?:{
        outcome:string;captured:boolean;regionId:number;wildSpeciesId:number;
        captureBallId:string|null;log:string[];frames:unknown[];
      };
      roster:Array<{pokemonId:number}>;
    }
  };
}
describe('D-064AH — economia regional transacional',()=>{
  it('contém todas as 151 espécies em 10 regiões, com raridade definida',()=>{
    expect(kantoRegionCatalogInvariant()).toBe(true);
    expect(KANTO_REGIONS).toHaveLength(10);
    const all=KANTO_REGIONS.flatMap(region=>region.speciesIds);
    expect(all).toHaveLength(151);
    expect(new Set(all).size).toBe(151);
    const rare=[144,145,146,150,151];
    for(const speciesId of rare){
      const region=KANTO_REGIONS.find(r=>r.speciesIds.includes(speciesId));
      expect(region?.id).toBeGreaterThanOrEqual(9);
      expect(region?.rareSpeciesIds).toContain(speciesId);
    }
    for(const region of KANTO_REGIONS){
      const encounter=kantoRegionalEncounter(region.id,0,100);
      expect(region.speciesIds).toContain(encounter?.speciesId);
      expect(encounter?.level).toBeLessThanOrEqual(region.levelMax);
      expect(encounter?.level).toBeGreaterThanOrEqual(region.levelMin);
    }
  });
  it('inicia com 12 Poké Balls e sem drops ou estoque fictício',()=>{
    const {storage}=setup(false);
    const {game}=inspect(storage);
    expect(game.ballPocket).toEqual({version:1,quantities:{'poke-ball':12}});
    expect(game.regionWins).toEqual(Array(10).fill(0));
  });
  it('uma vitória pode gastar uma bola e só um commit, com replay idempotente',()=>{
    const {storage,map}=setup();
    let seed:number|undefined;
    // Os resultados são calculados pelo próprio motor do jogo, sem forçar vitória.
    for(let candidate=0;candidate<64;candidate++){
      const trial=setup();
      const attempt=updatePlaySave(trial.storage,0,{
        type:'regional-battle',regionId:1,seed:candidate,ballId:'poke-ball'
      });
      if(attempt.status==='ok'&&inspect(trial.storage).game.lastBattle?.outcome==='win'){
        seed=candidate;break;
      }
    }
    expect(seed).toBeDefined();
    if(seed===undefined)return;
    const initial=map.get(PLAY_SAVE_KEY);
    const outcome=updatePlaySave(storage,0,{
      type:'regional-battle',regionId:1,seed,ballId:'poke-ball'
    });
    expect(outcome.status).toBe('ok');
    const saved=inspect(storage);
    expect(saved.snapshot.revision).toBe(1);
    expect(saved.snapshot.journal.revision).toBe(1);
    expect(saved.snapshot.journal.receipts).toHaveLength(1);
    expect(saved.game.regionWins[0]).toBe(1);
    expect(saved.game.ballPocket.quantities['poke-ball']).toBe(11);
    expect(saved.game.lastBattle?.captureBallId).toBe('poke-ball');
    expect(saved.game.lastBattle?.log.length).toBe(saved.game.lastBattle?.frames.length);
    expect(updatePlaySave(storage,0,{
      type:'regional-battle',regionId:1,seed,ballId:'poke-ball'
    }).status).toBe('blocked');
    expect(map.get(PLAY_SAVE_KEY)).not.toBe(initial);
    expect(inspect(storage).snapshot).toEqual(saved.snapshot);
  });
  it('não consome bolas nas derrotas, nem captura sem escolha de bola',()=>{
    const {storage}=setup();
    const result=updatePlaySave(storage,0,{
      type:'regional-battle',regionId:1,seed:0,ballId:null
    });
    expect(result.status).toBe('ok');
    const game=inspect(storage).game;
    expect(game.ballPocket.quantities['poke-ball']).toBeGreaterThanOrEqual(12);
    expect(game.lastBattle?.captured).toBe(false);
    expect(game.lastBattle?.captureBallId).toBeNull();
  });
  it('rejeita Master Ball, estoque esgotado, regiões inválidas e IDs adulterados',()=>{
    const {storage,map}=setup();
    const prior=map.get(PLAY_SAVE_KEY);
    for(const command of [
      {regionId:1,seed:0,ballId:'master-ball'},
      {regionId:1,seed:0,ballId:'ultra-ball'},
      {regionId:1,seed:0,ballId:'great-ball'},
      {regionId:11,seed:0,ballId:'poke-ball'},
      {regionId:1,seed:0xffffffff+1,ballId:'poke-ball'}
    ]){
      expect(updatePlaySave(storage,0,{
        type:'regional-battle',...command
      } as Parameters<typeof updatePlaySave>[2]).status).toBe('blocked');
      expect(map.get(PLAY_SAVE_KEY)).toBe(prior);
    }
  });
});
