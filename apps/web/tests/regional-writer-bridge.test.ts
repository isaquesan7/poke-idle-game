import {describe,expect,it} from 'vitest';
import {createPlaySave,readPlaySave,updatePlaySave,PLAY_SAVE_KEY} from '../src/play/playSave';
import type {PlayStorage} from '../src/play/playSave';
function fixture(demo=false){
  const entries=new Map<string,string>();
  const storage:PlayStorage={
    getItem:key=>entries.get(key)??null,
    setItem:(key,value)=>{entries.set(key,value);},
    removeItem:key=>{entries.delete(key);}
  };
  expect(createPlaySave(storage,'Treinador Beta',1,1000,demo).status).toBe('ok');
  return{storage,entries};
}
function inspect(storage:PlayStorage){
  const read=readPlaySave(storage);
  if(read.status!=='ready')throw Error('Save inválido');
  const game=JSON.parse(read.snapshot.journal.raw) as{
    coins:number;wins:number;losses:number;
    trainer:{level:number;xp:number};
    lastBattle?:{
      regionId?:number;regionName?:string;wildSpeciesId:number;
      wildLevel:number;outcome:'win'|'loss'|'draw';
      battleId:string;log:string[];frames:unknown[];
      captured:boolean;rewardCoins:number
    }
  };
  return{snapshot:read.snapshot,game};
}
describe('D-064AG — combate regional no mesmo writer da Arena',()=>{
  it('região 1 usa catálogo com resultado canônico e um único commit',()=>{
    const {storage}=fixture();
    const result=updatePlaySave(storage,0,{type:'regional-battle',regionId:1,seed:0});
    expect(result.status).toBe('ok');
    const {snapshot,game}=inspect(storage);
    expect(snapshot.revision).toBe(1);
    expect(snapshot.journal.revision).toBe(1);
    expect(snapshot.journal.receipts).toHaveLength(1);
    expect(game.lastBattle?.regionId).toBe(1);
    expect(game.lastBattle?.regionName).toBe('Bosque Inicial');
    expect([10,16,1,4,7]).toContain(game.lastBattle?.wildSpeciesId);
    expect(game.lastBattle?.wildLevel).toBeGreaterThanOrEqual(2);
    expect(game.lastBattle?.wildLevel).toBeLessThanOrEqual(10);
    expect(game.lastBattle?.battleId).toBe('regional-v02-1');
    expect(game.lastBattle?.log).toHaveLength(game.lastBattle?.frames.length);
    expect(updatePlaySave(storage,0,{type:'regional-battle',regionId:1,seed:0}).status).toBe('blocked');
    expect(inspect(storage).snapshot.revision).toBe(1);
  });
  it('recusa região bloqueada, ID e seed falsos sem mexer no save',()=>{
    const {storage,entries}=fixture();
    const before=entries.get(PLAY_SAVE_KEY);
    for(const regionId of [0,2,10,-1,1.5,Number.NaN]){
      const status=updatePlaySave(storage,0,{type:'regional-battle',regionId,seed:0});
      expect(status.status).toBe('blocked');
      expect(entries.get(PLAY_SAVE_KEY)).toBe(before);
    }
    for(const seed of [-1,2**32,Number.NaN]){
      const status=updatePlaySave(storage,0,{type:'regional-battle',regionId:1,seed});
      expect(status.status).toBe('blocked');
      expect(entries.get(PLAY_SAVE_KEY)).toBe(before);
    }
  });
  it('libera região 4 no modo demo e bloqueia região 5',()=>{
    const {storage}=fixture(true);
    expect(updatePlaySave(storage,0,{type:'regional-battle',regionId:5,seed:1}).status).toBe('blocked');
    const result=updatePlaySave(storage,0,{type:'regional-battle',regionId:4,seed:1});
    expect(result.status).toBe('ok');
    expect(inspect(storage).game.lastBattle?.regionId).toBe(4);
  });
  it('preserva a rota de combate clássica sem região e mantém XP/recompensas do writer',()=>{
    const {storage}=fixture(true);
    const result=updatePlaySave(storage,0,{type:'battle',seed:1});
    expect(result.status).toBe('ok');
    const after=inspect(storage);
    expect(after.snapshot.revision).toBe(1);
    expect(after.game.lastBattle?.regionId).toBeUndefined();
    expect(after.game.lastBattle?.battleId).toBe('battle-v02-1');
    expect(after.game.lastBattle?.log).toHaveLength(after.game.lastBattle?.frames.length);
  });
});
