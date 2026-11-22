import {describe,expect,it} from 'vitest';
import {AFFINITY_IDLE_DAY_MS} from '@kanto/game-core';
import {createPlaySave,readPlaySave,updatePlaySave} from '../src/play/playSave.js';
const D=AFFINITY_IDLE_DAY_MS;
class Storage {
  readonly entries=new Map<string,string>();
  getItem(k:string){return this.entries.get(k)??null;}
  setItem(k:string,v:string){this.entries.set(k,v);}
  removeItem(k:string){this.entries.delete(k);}
}
const fresh=()=>{
  const s=new Storage();
  expect(createPlaySave(s,'Afinidade',4,1000,true).status).toBe('ok');
  return s;
};
const snapshot=(s:Storage)=>{
  const r=readPlaySave(s);if(r.status!=='ready')throw Error('Save inválido');
  return r.snapshot;
};
const game=(s:Storage):any=>JSON.parse(snapshot(s).journal.raw);
const write=(s:Storage,action:Parameters<typeof updatePlaySave>[2])=>
  updatePlaySave(s,snapshot(s).revision,action);
describe('D064BG — persistência segura da afinidade por UID',()=>{
  it('passagem de dias altera somente afinidade; não repete após reload',()=>{
    const s=fresh();const before=game(s),t=1000+3*D;
    expect(before.roster[0].affinity).toBe(70);
    expect(write(s,{type:'affinity-tick',nowMs:1000+2*D-1}).status).toBe('blocked');
    expect(write(s,{type:'affinity-tick',nowMs:t}).status).toBe('ok');
    const changed=game(s);
    expect(changed.roster[0].affinity).toBe(68);
    expect(changed.roster[0].affinityIdleDaysApplied).toBe(2);
    expect(changed.coins).toBe(before.coins);
    expect(changed.roster[0].level).toBe(before.roster[0].level);
    const version=snapshot(s).revision;
    expect(write(s,{type:'affinity-tick',nowMs:t}).status).toBe('blocked');
    expect(write(s,{type:'affinity-tick',nowMs:1000}).status).toBe('blocked');
    expect(snapshot(s).revision).toBe(version);
    expect(write(s,{type:'affinity-tick',nowMs:t+D}).status).toBe('ok');
    expect(game(s).roster[0].affinity).toBe(67);
  });
  it('o líder combate com a afinidade já reduzida e a batalha reinicia a contagem',()=>{
    const s=fresh(),now=1000+4*D;
    expect(write(s,{type:'start-regional-battle',seed:2,regionId:1,nowMs:now}).status).toBe('ok');
    const pending=game(s);
    expect(pending.roster[0].affinity).toBe(67);
    expect(pending.pendingBattle).toMatchObject({startedAt:now,regionId:1});
    const id=pending.pendingBattle.battleId;
    expect(write(s,{type:'finish-regional-battle',battleId:id}).status).toBe('ok');
    const settled=game(s);
    expect(settled.roster[0].affinityLastUsedAt).toBe(now);
    expect(settled.roster[0].affinityIdleDaysApplied).toBe(0);
    expect(write(s,{type:'affinity-tick',nowMs:now+D}).status).toBe('blocked');
    const after=game(s);
    expect(after.roster[0].affinity).toBe(settled.roster[0].affinity);
    expect(write(s,{type:'affinity-tick',nowMs:now+2*D}).status).toBe('ok');
    expect(game(s).roster[0].affinity).toBe(Math.max(0,after.roster[0].affinity-1));
  });
  it('save sem timestamp recebe âncora na primeira sincronização sem perda retroativa',()=>{
    const s=fresh();
    const existing=snapshot(s),legacy=JSON.parse(existing.journal.raw);
    delete legacy.roster[0].affinityLastUsedAt;delete legacy.roster[0].affinityIdleDaysApplied;
    s.setItem('kanto-idle-play-v02',JSON.stringify({
      ...existing,journal:{...existing.journal,raw:JSON.stringify(legacy)}
    }));
    expect(write(s,{type:'affinity-tick',nowMs:1000+365*D}).status).toBe('ok');
    expect(game(s).roster[0].affinity).toBe(70);
    expect(game(s).roster[0].affinityIdleDaysApplied).toBe(0);
  });
});
