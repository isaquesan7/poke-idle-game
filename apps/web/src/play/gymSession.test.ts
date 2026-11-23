import {describe,it,expect} from 'vitest';
import {
  createPlaySave,readPlaySave,updatePlaySave,PLAY_SAVE_KEY
} from './playSave';
import type {PlayStorage} from './playSave';
import {replayGymSession,replayGymSessionTrace} from './gymSession';
import type {GymSessionV1} from './gymSession';
import {gymLegalTurnActions} from '@kanto/game-core';
type Progress=Record<string,any>;
function setup(strong=true){
  const map=new Map<string,string>();
  const storage:PlayStorage={
    getItem:key=>map.get(key)??null,
    setItem:(key,value)=>{map.set(key,value);},
    removeItem:key=>{map.delete(key);}
  };
  expect(createPlaySave(storage,'Equipe Kanto',1,1000,true).status).toBe('ok');
  const envelope=JSON.parse(map.get(PLAY_SAVE_KEY)!);
  const game:Progress=JSON.parse(envelope.journal.raw);
  const starter=game.roster[0]!;
  for(let i=2;i<=3;i++)
    game.roster.push({...starter,uid:i});
  game.nextUid=4;
  game.team=[1,2,3];
  if(strong){
    for(const p of game.roster){
      p.level=100;
      p.manual={hp:200,attack:200,defense:200,specialAttack:200,
        specialDefense:200,speed:200};
    }
  }
  envelope.journal.raw=JSON.stringify(game);
  map.set(PLAY_SAVE_KEY,JSON.stringify(envelope));
  const get=()=>{
    const r=readPlaySave(storage);
    if(r.status!=='ready')throw Error('save não encontrado');
    return {snapshot:r.snapshot,game:JSON.parse(r.snapshot.journal.raw) as Progress};
  };
  return {storage,map,get};
}
function dispatch(x:ReturnType<typeof setup>,action:Parameters<typeof updatePlaySave>[2]){
  const previous=x.get();
  return updatePlaySave(x.storage,previous.snapshot.revision,action);
}
describe('GYM-03B: sessão de Ginásio transacional no save v0.2',()=>{
  it('iniciar congela três UIDs; turnos persistem e são reproduzidos após reload',()=>{
    const x=setup();
    const previous=x.get();
    // A ordem da Coleção (não a seleção improvisada no Ginásio) é autoridade.
    previous.game.team=[2,3,1];
    const envelope=JSON.parse(x.map.get(PLAY_SAVE_KEY)!);
    envelope.journal.raw=JSON.stringify(previous.game);
    x.map.set(PLAY_SAVE_KEY,JSON.stringify(envelope));
    expect(dispatch(x,{type:'gym-start',seed:778}).status).toBe('ok');
    const a=x.get(),session=a.game.gymSession as GymSessionV1;
    expect(session).toMatchObject({
      id:'gym-v02-1',gymId:'boulder',seed:778,uids:[2,3,1],actions:[]
    });
    expect(dispatch(x,{type:'gym-turn',sessionId:session.id,
      action:{kind:'basic'}}).status).toBe('ok');
    const b=x.get(),stored=b.game.gymSession as GymSessionV1;
    const replay=replayGymSession(b.game,stored);
    expect(stored.actions).toEqual([{kind:'basic'}]);
    expect(replay.turn).toBe(1);
    const trace=replayGymSessionTrace(b.game,stored);
    expect(trace.state).toEqual(replay);
    expect(trace.rounds).toHaveLength(1);
    expect(trace.rounds[0]!.turn).toBe(1);
    expect(trace.rounds[0]!.lines.length).toBeGreaterThan(0);
    expect(trace.rounds[0]!.frames).toHaveLength(trace.rounds[0]!.lines.length);
    expect(trace.rounds[0]!.snapshots).toHaveLength(trace.rounds[0]!.lines.length);
    const firstFrame=trace.rounds[0]!.frames[0]!;
    const firstSnapshot=trace.rounds[0]!.snapshots[0]!;
    expect(firstFrame.playerHp).toBe(firstSnapshot.player.fighters[
      firstSnapshot.player.activeIndex]!.hp);
    expect(firstFrame.wildHp).toBe(firstSnapshot.leader.fighters[
      firstSnapshot.leader.activeIndex]!.hp);
    const visual=trace.rounds[0]!.visual;
    expect(Object.values(visual).every(value=>typeof value==='boolean')).toBe(true);
    expect(visual.playerLostHp||visual.leaderLostHp
      ||visual.playerGainedSp||visual.leaderGainedSp
      ||visual.playerSwitched||visual.leaderSwitched).toBe(true);

    const rawBefore=x.map.get(PLAY_SAVE_KEY);
    expect(replayGymSessionTrace(b.game,stored)).toEqual(trace);
    expect(x.map.get(PLAY_SAVE_KEY)).toBe(rawBefore);

    expect(b.snapshot.revision).toBe(2);
    expect(b.game.badges).toEqual([]);
    expect(b.game.coins).toBe(a.game.coins);
    expect(b.snapshot.journal.receipts).toHaveLength(0);
    expect(readPlaySave(x.storage).status).toBe('ready');
  });
  it('bloqueia alterações concorrentes, 2ª sessão, seleção falsificada e revisão stale',()=>{
    const x=setup();
    // Even a valid-looking list sent at gym start is prohibited.
    expect(dispatch(x,{type:'gym-start',seed:11,uids:[1,1,3]} as unknown as
      Parameters<typeof updatePlaySave>[2]).status).toBe('blocked');
    expect(dispatch(x,{type:'gym-start',seed:11,uids:[1,2,999]} as unknown as
      Parameters<typeof updatePlaySave>[2]).status).toBe('blocked');
    expect(dispatch(x,{type:'gym-start',seed:11,uids:[1,2,3]} as unknown as
      Parameters<typeof updatePlaySave>[2]).status).toBe('blocked');
    expect(dispatch(x,{type:'gym-start',seed:11}).status).toBe('ok');
    const session=x.get().game.gymSession as GymSessionV1;
    const before=x.map.get(PLAY_SAVE_KEY);
    expect(dispatch(x,{type:'gym-start',seed:11}).status).toBe('blocked');
    expect(dispatch(x,{type:'buy-ball',purchaseId:'oops',ballId:'poke-ball',quantity:1}).status)
      .toBe('blocked');
    expect(dispatch(x,{type:'trainer-invest-batch',increments:{attack:1}}).status)
      .toBe('blocked');
    expect(dispatch(x,{type:'gym-finish',sessionId:session.id}).status).toBe('blocked');
    expect(dispatch(x,{type:'gym-turn',sessionId:session.id,
      action:{kind:'move',moveName:'not-learned'}}).status).toBe('blocked');
    expect(dispatch(x,{type:'gym-turn',sessionId:'gym-v02-other',
      action:{kind:'basic'}}).status).toBe('blocked');
    expect(updatePlaySave(x.storage,0,{type:'gym-abandon',sessionId:session.id}).status)
      .toBe('blocked');
    expect(x.map.get(PLAY_SAVE_KEY)).toBe(before);
  });

  it('sem trio completo na Coleção não inicia, e a escalação ativa não pode mudar',()=>{
    const x=setup();
    const envelope=JSON.parse(x.map.get(PLAY_SAVE_KEY)!);
    const game:Progress=JSON.parse(envelope.journal.raw);
    game.team=[1,2];
    envelope.journal.raw=JSON.stringify(game);
    x.map.set(PLAY_SAVE_KEY,JSON.stringify(envelope));
    const before=x.map.get(PLAY_SAVE_KEY);
    expect(dispatch(x,{type:'gym-start',seed:44}).status).toBe('blocked');
    expect(x.map.get(PLAY_SAVE_KEY)).toBe(before);
    game.team=[1,2,3];
    envelope.journal.raw=JSON.stringify(game);
    x.map.set(PLAY_SAVE_KEY,JSON.stringify(envelope));
    expect(dispatch(x,{type:'gym-start',seed:44}).status).toBe('ok');
    const session=x.get().game.gymSession as GymSessionV1;
    expect(session.uids).toEqual([1,2,3]);
    expect(dispatch(x,{type:'pokemon',value:{type:'set-active',uid:2}}).status)
      .toBe('blocked');
    expect(dispatch(x,{type:'pokemon',value:{type:'remove-team',uid:3}}).status)
      .toBe('blocked');
    // Even a tampered journal cannot replay a Gym team different from the
    // frozen Collection selection.
    const corrupted=JSON.parse(x.map.get(PLAY_SAVE_KEY)!);
    const altered=JSON.parse(corrupted.journal.raw);
    altered.team=[2,1,3];
    corrupted.journal.raw=JSON.stringify(altered);
    x.map.set(PLAY_SAVE_KEY,JSON.stringify(corrupted));
    expect(dispatch(x,{type:'gym-turn',sessionId:session.id,
      action:{kind:'basic'}}).status).toBe('blocked');
  });
  it('abandono apaga sessão sem tocar moedas, insígnias nem XP; replay bloqueado',()=>{
    const x=setup();
    expect(dispatch(x,{type:'gym-start',seed:22}).status).toBe('ok');
    const a=x.get(),id=(a.game.gymSession as GymSessionV1).id;
    expect(dispatch(x,{type:'gym-abandon',sessionId:id}).status).toBe('ok');
    const b=x.get();
    expect(b.game.gymSession).toBeUndefined();
    expect(b.game.lastGymOutcome).toEqual({gymId:'boulder',outcome:'abandoned'});
    expect(b.game.coins).toBe(a.game.coins);
    expect(b.game.badges).toEqual([]);
    expect(b.snapshot.journal.receipts).toHaveLength(0);
    expect(dispatch(x,{type:'gym-abandon',sessionId:id}).status).toBe('blocked');
    expect(dispatch(x,{type:'gym-finish',sessionId:id}).status).toBe('blocked');
  });
  it('vitória real: só finalização paga e registra receipt; replay não paga novamente',()=>{
    const x=setup();
    expect(dispatch(x,{type:'gym-start',seed:99}).status).toBe('ok');
    const before=x.get(),id=(before.game.gymSession as GymSessionV1).id;
    let result:'ongoing'|'player-win'|'leader-win'|'draw'='ongoing';
    for(let i=0;i<140;i++){
      const snap=x.get();
      const state=replayGymSession(snap.game,snap.game.gymSession);
      result=state.outcome;
      if(result!=='ongoing')break;
      const action=gymLegalTurnActions(state,'player').find(a=>a.kind==='basic')
        ??gymLegalTurnActions(state,'player')[0]!;
      const response=dispatch(x,{type:'gym-turn',sessionId:id,action});
      expect(response.status).toBe('ok');
      if(response.status!=='ok')throw Error(response.reason);
    }
    expect(result).toBe('player-win');
    const pre=x.get();
    expect(pre.game.coins).toBe(before.game.coins);
    expect(pre.game.badges).toEqual([]);
    expect(dispatch(x,{type:'gym-finish',sessionId:id}).status).toBe('ok');
    const after=x.get();
    expect(after.game.badges).toEqual(['boulder']);
    expect(after.game.coins).toBe(before.game.coins+1500);
    expect(after.game.lastGymVictory).toMatchObject({
      gymId:'boulder',eventId:id,coins:1500,trainerXp:120
    });
    expect(after.snapshot.journal.receipts).toHaveLength(1);
    expect(after.snapshot.journal.receipts[0]!.id).toBe(id);
    expect(after.game.gymSession).toBeUndefined();
    const frozen=x.map.get(PLAY_SAVE_KEY);
    expect(dispatch(x,{type:'gym-finish',sessionId:id}).status).toBe('blocked');
    expect(x.map.get(PLAY_SAVE_KEY)).toBe(frozen);
  });
  it('transcript adulterado no save bloqueia turnos e finalização sem prêmios',()=>{
    const x=setup();
    expect(dispatch(x,{type:'gym-start',seed:31}).status).toBe('ok');
    const env=JSON.parse(x.map.get(PLAY_SAVE_KEY)!);
    const game:Progress=JSON.parse(env.journal.raw);
    const id=game.gymSession.id;
    game.gymSession.actions=[{kind:'move',moveName:'hyper-beam'}];
    env.journal.raw=JSON.stringify(game);
    x.map.set(PLAY_SAVE_KEY,JSON.stringify(env));
    const before=x.map.get(PLAY_SAVE_KEY);
    expect(dispatch(x,{type:'gym-turn',sessionId:id,action:{kind:'basic'}}).status)
      .toBe('blocked');
    expect(dispatch(x,{type:'gym-finish',sessionId:id}).status).toBe('blocked');
    expect(x.map.get(PLAY_SAVE_KEY)).toBe(before);
  });
});
