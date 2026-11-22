import {describe,expect,it} from 'vitest';
import {createPlaySave,PLAY_SAVE_KEY,readPlaySave,updatePlaySave}
  from '../src/play/playSave.js';
import {EXPEDITION_CYCLE_MS,expeditionRewards,
  emptyExpeditionBallProgress} from '@kanto/game-core';

function store(){
  const db=new Map<string,string>();
  return{
    getItem:(key:string)=>db.get(key)??null,
    setItem:(key:string,value:string)=>{db.set(key,value);},
    removeItem:(key:string)=>{db.delete(key);}
  };
}
function advancedSave(coins=50000){
  const storage=store();
  const initial=createPlaySave(storage,'Auditor D064BR',1,0);
  expect(initial.status).toBe('ok');
  if(initial.status!=='ok')throw Error('Sem save inicial');
  const game=JSON.parse(initial.snapshot.journal.raw);
  game.trainer.level=100;
  game.roster[0].level=100;
  game.coins=coins;
  const set=(next:typeof game)=>storage.setItem(PLAY_SAVE_KEY,
    JSON.stringify({...initial.snapshot,journal:{
      ...initial.snapshot.journal,raw:JSON.stringify(next)
    }}));
  set(game);
  return {storage,game,set};
}
const gameOf=(storage:ReturnType<typeof store>)=>{
  const save=readPlaySave(storage);
  if(save.status!=='ready')throw Error('Save indisponível');
  return {snapshot:save.snapshot,game:JSON.parse(save.snapshot.journal.raw)};
};
describe('D064BR — limites econômicos e captura sem duplicação',()=>{
  it('bolso cheio na expedição não elimina moedas, XP, nem impede claim',()=>{
    const {storage,game,set}=advancedSave();
    game.expedition={startedAt:0,lastClaimAt:0,regionId:10,teamUids:[1]};
    game.expeditionBallProgress={
      'poke-ball':1439,'great-ball':2879,'ultra-ball':8639
    };
    game.ballPocket={version:1,quantities:{
      'poke-ball':100000,'great-ball':99999,'ultra-ball':100000
    }};
    set(game);
    const expected=expeditionRewards(EXPEDITION_CYCLE_MS,{
      regionId:10,pokemon:[{level:100,xp:0}],
      ballProgress:game.expeditionBallProgress
    });
    expect(expected.ballDrops).toEqual({
      'poke-ball':1,'great-ball':1,'ultra-ball':1
    });
    const result=updatePlaySave(storage,0,{
      type:'claim-expedition',nowMs:EXPEDITION_CYCLE_MS
    });
    expect(result.status).toBe('ok');
    if(result.status!=='ok')return;
    const saved=gameOf(storage);
    expect(saved.snapshot.revision).toBe(1);
    expect(saved.snapshot.journal.receipts).toHaveLength(1);
    expect(saved.game.coins).toBe(50000+expected.coins);
    expect(saved.game.ballPocket.quantities).toMatchObject({
      'poke-ball':100000,'great-ball':100000,'ultra-ball':100000
    });
    expect(saved.game.lastClaim.ballDrops).toEqual({
      'poke-ball':0,'great-ball':1,'ultra-ball':0
    });
    expect(saved.game.expeditionBallProgress).toEqual({
      'poke-ball':1440,'great-ball':2880,'ultra-ball':8640
    });
    expect(saved.game.expedition.lastClaimAt).toBe(EXPEDITION_CYCLE_MS);
    const before=JSON.stringify(saved.snapshot);
    const duplicate=updatePlaySave(storage,0,{
      type:'claim-expedition',nowMs:EXPEDITION_CYCLE_MS
    });
    expect(duplicate.status).toBe('blocked');
    expect(JSON.stringify(gameOf(storage).snapshot)).toBe(before);
  });
  it('todas as bolas no limite não paralisam a coleta nem criam drops fictícios',()=>{
    const {storage,game,set}=advancedSave(1000);
    game.expedition={startedAt:0,lastClaimAt:0,regionId:10,teamUids:[1]};
    game.expeditionBallProgress={
      'poke-ball':1439,'great-ball':2879,'ultra-ball':8639
    };
    game.ballPocket={version:1,quantities:{
      'poke-ball':100000,'great-ball':100000,'ultra-ball':100000
    }};
    set(game);
    const result=updatePlaySave(storage,0,{
      type:'claim-expedition',nowMs:EXPEDITION_CYCLE_MS
    });
    expect(result.status).toBe('ok');
    const saved=gameOf(storage);
    expect(saved.game.coins).toBe(1016);
    expect(saved.game.lastClaim.ballDrops).toEqual(emptyExpeditionBallProgress());
    expect(saved.game.ballPocket.quantities).toMatchObject(game.ballPocket.quantities);
    expect(saved.game.expedition.lastClaimAt).toBe(EXPEDITION_CYCLE_MS);
  });
  it('bolso realmente inválido ainda deve recusar crédito sem cobrar/avançar',()=>{
    const {storage,game,set}=advancedSave(1000);
    game.expedition={startedAt:0,lastClaimAt:0,regionId:10,teamUids:[1]};
    game.expeditionBallProgress={
      'poke-ball':1439,'great-ball':2879,'ultra-ball':8639
    };
    game.ballPocket={version:1,quantities:{'poke-ball':100001}};
    set(game);
    const original=storage.getItem(PLAY_SAVE_KEY);
    const outcome=updatePlaySave(storage,0,{
      type:'claim-expedition',nowMs:EXPEDITION_CYCLE_MS
    });
    expect(outcome.status).toBe('blocked');
    expect(storage.getItem(PLAY_SAVE_KEY)).toBe(original);
  });
  it('captura lendária não consome Master/Poké e falha de lançamento não duplica gasto',()=>{
    const {storage,game,set}=advancedSave();
    game.ballPocket={version:1,quantities:{
      'poke-ball':3,'great-ball':2,'ultra-ball':1
    }};
    game.lastBattle={
      battleId:'regional-v02-99',outcome:'win',captureStatus:'available',
      regionId:10,wildSpeciesId:150,captureSeed:42,wildMaxHp:350,
      log:[],frames:[]
    };
    set(game);
    const forbidden=updatePlaySave(storage,0,{
      type:'capture-after-battle',battleId:'regional-v02-99',ballId:'poke-ball'
    });
    expect(forbidden.status).toBe('blocked');
    expect(gameOf(storage).game.ballPocket.quantities['poke-ball']).toBe(3);
    const master=updatePlaySave(storage,0,{
      type:'capture-after-battle',battleId:'regional-v02-99',ballId:'master-ball'
    });
    expect(master.status).toBe('blocked');
    const attempt=updatePlaySave(storage,0,{
      type:'capture-after-battle',battleId:'regional-v02-99',ballId:'ultra-ball'
    });
    expect(attempt.status).toBe('ok');
    const after=gameOf(storage);
    expect(after.game.ballPocket.quantities['ultra-ball']).toBe(0);
    expect(['caught','escaped']).toContain(after.game.lastBattle.captureStatus);
    expect(after.game.ballPocket.quantities['poke-ball']).toBe(3);
    expect(after.game.ballPocket.quantities['great-ball']).toBe(2);
    const persisted=JSON.stringify(after.snapshot);
    expect(updatePlaySave(storage,after.snapshot.revision,{
      type:'capture-after-battle',battleId:'regional-v02-99',ballId:'ultra-ball'
    }).status).toBe('blocked');
    expect(JSON.stringify(gameOf(storage).snapshot)).toBe(persisted);
  });
});
