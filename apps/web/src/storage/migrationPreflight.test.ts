import { describe, expect, it } from 'vitest';
import {
  inspectMigrationReadiness
} from './migrationPreflight';
import { DRAFT_SAVE_KEY } from './draftSave';
import { LEGACY_SAVE_KEY } from './legacySave';
import type { StoragePort } from './draftSave';
import { createDraft, editDraft } from './draftSave';
import legacyFixture from '../../../../tests/fixtures/legacy-save-v01.json';

const original = JSON.stringify(legacyFixture);
class MemoryStore implements StoragePort {
  map = new Map<string,string>();
  writes = 0;
  reads = 0;
  unstable = false;
  constructor(raw: string | null = original) {
    if (raw !== null) this.map.set(LEGACY_SAVE_KEY,raw);
  }
  getItem(key:string) {
    this.reads++;
    if (this.unstable && key === LEGACY_SAVE_KEY && this.reads > 2) {
      return JSON.stringify({...legacyFixture,coins:legacyFixture.coins+1});
    }
    return this.map.get(key) ?? null;
  }
  setItem(key:string,value:string) { this.writes++;this.map.set(key,value); }
  removeItem(key:string) { this.writes++;this.map.delete(key); }
}
describe('pré-verificação de migração nunca escreve o save',()=>{
  it('reconhece fixture v0.1 e sem simulação sem qualquer escrita',()=>{
    const store=new MemoryStore();
    expect(inspectMigrationReadiness(store)).toMatchObject({
      status:'candidate',draft:'absent',
      sourceBytes: new TextEncoder().encode(original).length
    });
    expect(store.writes).toBe(0);
    expect(store.getItem(LEGACY_SAVE_KEY)).toBe(original);
  });

  it('reconhece rascunho alinhado, ainda sem autorizar migração',()=>{
    const store=new MemoryStore();
    expect(createDraft(store,original).status).toBe('ok');
    expect(editDraft(store,0,{type:'invest',stat:'attack'}).status).toBe('ok');
    const before=store.writes;
    expect(inspectMigrationReadiness(store)).toMatchObject({
      status:'candidate',draft:'aligned'
    });
    expect(store.writes).toBe(before);
    expect(store.getItem(LEGACY_SAVE_KEY)).toBe(original);
  });

  it('bloqueia save antigo inexistente, inválido e versão futura',()=>{
    expect(inspectMigrationReadiness(new MemoryStore(null))).toMatchObject({
      status:'blocked',reason:'absent'
    });
    expect(inspectMigrationReadiness(new MemoryStore('{oops'))).toMatchObject({
      status:'blocked',reason:'invalid'
    });
    expect(inspectMigrationReadiness(new MemoryStore(JSON.stringify({
      ...legacyFixture,version:3
    })))).toMatchObject({status:'blocked',reason:'unsupported'});
  });

  it('bloqueia distribuição inválida mesmo se a estrutura básica é legível',()=>{
    const store=new MemoryStore(JSON.stringify({
      ...legacyFixture,trainer:{...legacyFixture.trainer,
        manual:{...legacyFixture.trainer.manual,attack:41}}
    }));
    expect(inspectMigrationReadiness(store)).toMatchObject({
      status:'blocked',reason:'invalid-trainer'
    });
    expect(store.writes).toBe(0);
  });

  it('recusa rascunho forjado e simulação que ficou antiga',()=>{
    const corrupt=new MemoryStore();
    corrupt.map.set(DRAFT_SAVE_KEY,JSON.stringify({schemaVersion:99}));
    expect(inspectMigrationReadiness(corrupt)).toMatchObject({
      status:'blocked',reason:'invalid-draft'
    });
    const stale=new MemoryStore();
    expect(createDraft(stale,original).status).toBe('ok');
    stale.map.set(LEGACY_SAVE_KEY,JSON.stringify({...legacyFixture,coins:322}));
    expect(inspectMigrationReadiness(stale)).toMatchObject({
      status:'blocked',reason:'stale-draft'
    });
  });

  it('detecta quando a v0.1 muda durante a consulta e não tenta reverter',()=>{
    const store=new MemoryStore();
    store.unstable=true;
    expect(inspectMigrationReadiness(store)).toMatchObject({
      status:'blocked',reason:'changed-during-read'
    });
    expect(store.writes).toBe(0);
  });

  it('trata storage inacessível explicitamente',()=>{
    const storage:StoragePort={
      getItem(){throw Error('denied')},
      setItem(){throw Error('must not write')},
      removeItem(){throw Error('must not write')}
    };
    expect(inspectMigrationReadiness(storage)).toMatchObject({
      status:'blocked',reason:'storage-unavailable'
    });
  });
});
