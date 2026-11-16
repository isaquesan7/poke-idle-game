import { describe, expect, it } from 'vitest';
import {
  createDraft, editDraft, discardDraft, readDraft,
  DRAFT_SAVE_KEY, DRAFT_LOCK_NAME
} from './draftSave';
import { LEGACY_SAVE_KEY } from './legacySave';

const sample = JSON.stringify({
  version: 1, name: 'Original', coins: 400, wins: 3, badges: ['boulder'],
  trainer: {
    level: 21, xp: 200, manual: {hp:0,attack:39,defense:0,specialAttack:0,specialDefense:0,speed:0},
    equipped: {gloves:'gloves',hat:'cap',ring1:'ring-a'}, title:'aprendiz'
  },
  roster:[{ uid:1,pokemonId:1,level:20,affinity:73,upgrades:{} }],
  team:[1], expedition:{startedAt:1000,lastClaimAt:2000,teamUids:[1]}
});
class FakeStorage {
  readonly values = new Map<string,string>();
  blocked = false;
  constructor() { this.values.set(LEGACY_SAVE_KEY,sample); }
  getItem(key:string) {
    if(this.blocked) throw Error('storage denied');
    return this.values.get(key) ?? null;
  }
  setItem(key:string,value:string) {
    if(this.blocked) throw Error('quota');
    this.values.set(key,value);
  }
  removeItem(key:string) {
    if(this.blocked) throw Error('not allowed');
    this.values.delete(key);
  }
}

describe('persistência draft v0.2, sem tocar no jogo v0.1', () => {
  it('mantém original byte a byte; versão2 somente na chave separada', () => {
    const store=new FakeStorage();
    expect(createDraft(store,sample).status).toBe('ok');
    const first=readDraft(store);
    expect(first.status).toBe('ready');
    if(first.status!=='ready') return;
    expect(first.draft.schemaVersion).toBe(2);
    expect(first.draft.revision).toBe(0);
    expect(first.draft.sourceRaw).toBe(sample);
    expect(store.getItem(LEGACY_SAVE_KEY)).toBe(sample);
    expect(editDraft(store,0,{type:'invest',stat:'attack'}).status).toBe('ok');
    expect(editDraft(store,1,{type:'equip',slot:'gloves',itemId:'gloves-tech'}).status).toBe('ok');
    const current=readDraft(store);
    expect(current.status).toBe('ready');
    if(current.status!=='ready')return;
    expect(current.draft.revision).toBe(2);
    const working=JSON.parse(current.draft.workingRaw);
    expect(working.trainer.manual.attack).toBe(40);
    expect(working.trainer.equipped.gloves).toBe('gloves-tech');
    expect(working.coins).toBe(400);
    expect(working.trainer.xp).toBe(200);
    expect(working.roster[0].affinity).toBe(73);
    expect(store.getItem(LEGACY_SAVE_KEY)).toBe(sample);
    expect(DRAFT_LOCK_NAME).toBe('kanto-idle-v02-draft-writer');
  });

  it('recusa criação duplicada e mudança de versão/revisão por outra aba', () => {
    const store=new FakeStorage();
    expect(createDraft(store,sample).status).toBe('ok');
    expect(createDraft(store,sample).status).toBe('conflict');
    expect(editDraft(store,0,{type:'invest',stat:'attack'}).status).toBe('ok');
    const saved=store.getItem(DRAFT_SAVE_KEY);
    expect(editDraft(store,0,{type:'equip',slot:'gloves',itemId:'gloves-tech'}).status).toBe('conflict');
    expect(store.getItem(DRAFT_SAVE_KEY)).toBe(saved);
  });

  it('bloqueia rascunho se save original mudar na v0.1, sem recuperações automáticas', () => {
    const store=new FakeStorage();
    expect(createDraft(store,sample).status).toBe('ok');
    store.values.set(LEGACY_SAVE_KEY,JSON.stringify({...JSON.parse(sample),coins:401}));
    expect(readDraft(store).status).toBe('stale');
    expect(editDraft(store,0,{type:'invest',stat:'attack'}).status).toBe('conflict');
    const raw=store.getItem(DRAFT_SAVE_KEY);
    expect(raw).not.toBeNull();
    expect(store.getItem(LEGACY_SAVE_KEY)).toContain('"coins":401');
    expect(discardDraft(store,raw!).status).toBe('ok');
    expect(store.getItem(DRAFT_SAVE_KEY)).toBeNull();
    expect(store.getItem(LEGACY_SAVE_KEY)).toContain('"coins":401');
  });

  it('rejeita rascunhos adulterados, versão futura e alterações de moedas', () => {
    const store=new FakeStorage();
    expect(createDraft(store,sample).status).toBe('ok');
    const draft=JSON.parse(store.getItem(DRAFT_SAVE_KEY)!);
    store.values.set(DRAFT_SAVE_KEY,JSON.stringify({...draft,schemaVersion:3}));
    expect(readDraft(store).status).toBe('invalid');
    store.values.set(DRAFT_SAVE_KEY,JSON.stringify({...draft,workingRaw:JSON.stringify({
      ...JSON.parse(sample), coins:999
    })}));
    expect(readDraft(store).status).toBe('invalid');
    expect(editDraft(store,0,{type:'invest',stat:'attack'}).status).toBe('conflict');
    expect(store.getItem(LEGACY_SAVE_KEY)).toBe(sample);
  });

  it('preserva dados quando storage está bloqueado/quota excedida', () => {
    const store=new FakeStorage();
    store.blocked=true;
    expect(createDraft(store,sample).status).toBe('unavailable');
    expect(readDraft(store).status).toBe('unavailable');
    store.blocked=false;
    expect(store.getItem(LEGACY_SAVE_KEY)).toBe(sample);
    expect(store.getItem(DRAFT_SAVE_KEY)).toBeNull();
    expect(createDraft(store,sample).status).toBe('ok');
    store.blocked=true;
    expect(editDraft(store,0,{type:'invest',stat:'attack'}).status).toBe('conflict');
  });

  it('descarta só o rascunho exato e bloqueia perdas por conflito', () => {
    const store=new FakeStorage();
    expect(createDraft(store,sample).status).toBe('ok');
    const first=store.getItem(DRAFT_SAVE_KEY)!;
    expect(editDraft(store,0,{type:'equip',slot:'gloves',itemId:''}).status).toBe('ok');
    expect(discardDraft(store,first).status).toBe('conflict');
    const current=store.getItem(DRAFT_SAVE_KEY)!;
    expect(discardDraft(store,current).status).toBe('ok');
    expect(store.getItem(LEGACY_SAVE_KEY)).toBe(sample);
  });

  it('não cria rascunho quando origem mudou antes da confirmação', () => {
    const store=new FakeStorage();
    store.values.set(LEGACY_SAVE_KEY,JSON.stringify({...JSON.parse(sample),coins:777}));
    expect(createDraft(store,sample).status).toBe('conflict');
    expect(store.getItem(DRAFT_SAVE_KEY)).toBeNull();
  });
});
