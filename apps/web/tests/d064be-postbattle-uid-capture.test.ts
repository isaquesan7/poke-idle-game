/**
 * D064BE — regressão do writer em 2 estágios e captura post battle.
 * Sem RNG adicional no cliente e sem gravar progresso antes de finalizar.
 */
import {describe,expect,it} from 'vitest';
import {createPlaySave,readPlaySave,updatePlaySave} from '../src/play/playSave.js';
import {kantoRegionalEncounter} from '@kanto/game-core';

class Storage {
  readonly map=new Map<string,string>();
  getItem(k:string){return this.map.get(k)??null;}
  setItem(k:string,v:string){this.map.set(k,v);}
  removeItem(k:string){this.map.delete(k);}
}
function snapshot(s:Storage){
  const r=readPlaySave(s);
  if(r.status!=='ready')throw Error('Save indisponível');
  return r.snapshot;
}
function game(s:Storage):any{return JSON.parse(snapshot(s).journal.raw);}
function action(s:Storage,value:Parameters<typeof updatePlaySave>[2]){
  return updatePlaySave(s,snapshot(s).revision,value);
}
function normal(starter=4,demo=false){
  const s=new Storage();
  expect(createPlaySave(s,'D064BE',starter,1000,demo).status).toBe('ok');
  return s;
}
describe('D064BE — batalha pendente, recompensa e captura',()=>{
  it('não altera XP, nível, moedas ou vitórias antes do final do replay',()=>{
    const s=normal();
    const before=game(s),revision=snapshot(s).journal.revision;
    const start=action(s,{type:'start-regional-battle',seed:25,regionId:1});
    expect(start.status).toBe('ok');
    const pending=game(s);
    expect(pending.pendingBattle).toMatchObject({seed:25,regionId:1});
    expect(pending.pendingBattle.preview.log.length).toBeGreaterThan(2);
    expect(pending.pendingBattle.preview.frames).toHaveLength(pending.pendingBattle.preview.log.length);
    expect(pending.wins).toBe(before.wins);
    expect(pending.losses).toBe(before.losses);
    expect(pending.trainer).toEqual(before.trainer);
    expect(pending.coins).toBe(before.coins);
    expect(pending.roster).toEqual(before.roster);
    expect(snapshot(s).journal.revision).toBe(revision);
    expect(action(s,{type:'start-regional-battle',seed:26,regionId:1}).status).toBe('blocked');
    expect(action(s,{type:'trainer-invest-batch',increments:{hp:1}}).status).toBe('blocked');
    const id=pending.pendingBattle.battleId;
    expect(action(s,{type:'finish-regional-battle',battleId:'wrong'}).status).toBe('blocked');
    const afterBlocked=snapshot(s);
    const finish=action(s,{type:'finish-regional-battle',battleId:id});
    expect(finish.status).toBe('ok');
    expect(game(s).pendingBattle).toBeUndefined();
    expect(game(s).lastBattle.battleId).toBe(id);
    expect(snapshot(s).journal.revision).toBe(revision+1);
    expect(action(s,{type:'finish-regional-battle',battleId:id}).status).toBe('blocked');
    expect(snapshot(s).journal.revision).toBe(afterBlocked.journal.revision+1);
    const r=game(s).roster[0].battleRecord;
    expect(r.wins+r.draws+r.losses).toBe(1);
    expect(r.wins).toBe(game(s).lastBattle.outcome==='win'?1:0);
    expect(r.draws).toBe(game(s).lastBattle.outcome==='draw'?1:0);
    expect(r.losses).toBe(game(s).lastBattle.outcome==='loss'?1:0);
  });

  it('mantém pending após reabrir save e bloqueia captura antes do resultado',()=>{
    const s=normal(7);
    expect(action(s,{type:'start-regional-battle',seed:11,regionId:1}).status).toBe('ok');
    const id=game(s).pendingBattle.battleId;
    expect(readPlaySave(s).status).toBe('ready');
    const raw=s.getItem('kanto-idle-play-v02')!;
    const reloaded=new Storage();reloaded.setItem('kanto-idle-play-v02',raw);
    expect(action(reloaded,{type:'capture-after-battle',battleId:id,ballId:'poke-ball'}).status).toBe('blocked');
    expect(action(reloaded,{type:'finish-regional-battle',battleId:id}).status).toBe('ok');
    expect(game(reloaded).lastBattle.battleId).toBe(id);
    expect(game(reloaded).pendingBattle).toBeUndefined();
  });

  it('não cobra bola nem duplica captura antes do resultado; vitória oferece no máximo uma escolha',()=>{
    let used=0;
    for(let seed=0;seed<256;seed++){
      const s=normal(4,true);
      if(action(s,{type:'start-regional-battle',seed,regionId:1}).status!=='ok')continue;
      const id=game(s).pendingBattle.battleId;
      expect(action(s,{type:'finish-regional-battle',battleId:id}).status).toBe('ok');
      if(game(s).lastBattle.outcome!=='win')continue;
      const before=game(s);
      const ballsBefore=before.ballPocket.quantities['poke-ball'];
      expect(before.lastBattle.captureStatus).toBe('available');
      expect(action(s,{type:'start-regional-battle',seed:seed+1,regionId:1}).status).toBe('blocked');
      const response=action(s,{type:'capture-after-battle',battleId:id,ballId:'poke-ball'});
      expect(response.status).toBe('ok');
      const after=game(s);
      expect(after.ballPocket.quantities['poke-ball']).toBe(ballsBefore-1);
      expect(['caught','escaped']).toContain(after.lastBattle.captureStatus);
      expect(action(s,{type:'capture-after-battle',battleId:id,ballId:'poke-ball'}).status).toBe('blocked');
      expect(action(s,{type:'skip-capture',battleId:id}).status).toBe('blocked');
      expect(game(s)).toEqual(after);
      expect(after.wins).toBe(before.wins);
      expect(after.trainer).toEqual(before.trainer);
      expect(after.roster[0].battleRecord).toEqual(before.roster[0].battleRecord);
      if(after.lastBattle.captured){
        expect(after.roster).toHaveLength(before.roster.length+1);
        expect(after.roster.at(-1).battleRecord).toEqual({wins:0,draws:0,losses:0});
      }
      used++;break;
    }
    expect(used).toBe(1);
  });

  it('permite dispensar uma vitória sem gastar bola nem ganhar prêmio adicional',()=>{
    let skipped=false;
    for(let seed=0;seed<256;seed++){
      const s=normal(4,true);
      expect(action(s,{type:'start-regional-battle',regionId:1,seed}).status).toBe('ok');
      const id=game(s).pendingBattle.battleId;
      expect(action(s,{type:'finish-regional-battle',battleId:id}).status).toBe('ok');
      if(game(s).lastBattle.outcome!=='win')continue;
      const before=game(s);
      expect(action(s,{type:'skip-capture',battleId:id}).status).toBe('ok');
      expect(game(s).ballPocket).toEqual(before.ballPocket);
      expect(game(s).roster).toEqual(before.roster);
      expect(game(s).lastBattle.captureStatus).toBe('skipped');
      expect(action(s,{type:'capture-after-battle',battleId:id,ballId:'poke-ball'}).status).toBe('blocked');
      skipped=true;break;
    }
    expect(skipped).toBe(true);
  });
});
