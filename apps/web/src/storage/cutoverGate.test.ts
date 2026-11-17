import { describe, expect, it } from 'vitest';
import legacy from '../../../../tests/fixtures/legacy-save-v01.json';
import { inspectCutoverGate } from './cutoverGate';
import type { StoragePort } from './draftSave';
import { createDraft, DRAFT_SAVE_KEY } from './draftSave';
import { LEGACY_SAVE_KEY } from './legacySave';
import {
  OFFICIAL_V02_KEY, ORIGIN_BACKUP_V02_KEY, COMMIT_MARKER_V02_KEY
} from './officialSaveV02';

const original = JSON.stringify(legacy);
class Store implements StoragePort {
  readonly values = new Map<string,string>();
  writes = 0;
  reads = 0;
  changeOnRead: number | null = null;
  constructor(raw: string | null = original) {
    if (raw !== null) this.values.set(LEGACY_SAVE_KEY,raw);
  }
  getItem(key:string):string|null {
    this.reads++;
    if (this.changeOnRead === this.reads) {
      this.values.set(LEGACY_SAVE_KEY, JSON.stringify({...legacy,coins:900}));
    }
    return this.values.get(key) ?? null;
  }
  setItem(key:string,value:string):void {this.writes++;this.values.set(key,value);}
  removeItem(key:string):void {this.writes++;this.values.delete(key);}
}
const codes=(store:Store,webLocksAvailable=true) =>
  inspectCutoverGate(store,webLocksAvailable).blockers.map(b=>b.code);

describe('gate de ativação fail-closed, somente leitura',()=>{
  it('mesmo save 100% válido e Web Locks disponível não autoriza cutover',()=>{
    const store=new Store();
    const report=inspectCutoverGate(store,true);
    expect(report).toMatchObject({
      status:'blocked',canMigrate:false,sourceCompatible:true
    });
    expect(report.blockers.map(b=>b.code)).toEqual([
      'legacy-writer-uncooperative',
      'gameplay-parity-incomplete',
      'official-writer-not-implemented',
      'external-backup-not-verified',
      'release-not-authorized'
    ]);
    expect(store.writes).toBe(0);
    expect(store.values.get(LEGACY_SAVE_KEY)).toBe(original);
  });

  it('bloqueia também sem Web Locks, sem fallback inseguro',()=>{
    const store=new Store();
    expect(codes(store,false)).toContain('web-locks-unavailable');
    expect(store.writes).toBe(0);
  });

  it.each([
    ['sem save',null],
    ['JSON danificado','{bad'],
    ['versão futura',JSON.stringify({...legacy,version:3})],
    ['treinador inválido',JSON.stringify({...legacy,trainer:{
      ...legacy.trainer,manual:{...legacy.trainer.manual,attack:41}
    }})]
  ])('%s: pré-verificação não é elegível',(_name,raw)=>{
    const store=new Store(raw);
    const r=inspectCutoverGate(store,true);
    expect(r.sourceCompatible).toBe(false);
    expect(r.blockers.map(b=>b.code)).toContain('preflight-ineligible');
    expect(r.canMigrate).toBe(false);
    expect(store.writes).toBe(0);
  });

  it('draft antigo ou corrompido não libera cutover',()=>{
    const store=new Store();
    expect(createDraft(store,original).status).toBe('ok');
    const draftWrites=store.writes;
    store.values.set(LEGACY_SAVE_KEY,JSON.stringify({...legacy,coins:999}));
    const r=inspectCutoverGate(store,true);
    expect(r.blockers.map(b=>b.code)).toContain('preflight-ineligible');
    expect(r.canMigrate).toBe(false);
    expect(store.writes).toBe(draftWrites);
    store.values.set(DRAFT_SAVE_KEY,'{broken');
    expect(codes(store)).toContain('preflight-ineligible');
  });

  it.each([
    OFFICIAL_V02_KEY,ORIGIN_BACKUP_V02_KEY,COMMIT_MARKER_V02_KEY
  ])('nunca substitui dados pré-existentes na chave reservada %s',key=>{
    const store=new Store();
    store.values.set(key,JSON.stringify({schemaVersion:99}));
    const before=new Map(store.values);
    const report=inspectCutoverGate(store,true);
    expect(report.blockers.map(b=>b.code)).toContain('reserved-save-exists');
    expect(report.canMigrate).toBe(false);
    expect(store.writes).toBe(0);
    expect(store.values).toEqual(before);
  });

  it('detecta concorrência durante leitura sem corrigir save automaticamente',()=>{
    const store=new Store();
    // Snapshot de cinco chaves, 4 leituras do preflight, segundo snapshot.
    store.changeOnRead=9;
    const report=inspectCutoverGate(store,true);
    expect(report.blockers.map(b=>b.code)).toContain('snapshot-changed');
    expect(report.canMigrate).toBe(false);
    expect(store.writes).toBe(0);
    expect(store.values.get(LEGACY_SAVE_KEY)).toContain('"coins":900');
  });

  it('falha de permissão é bloqueio explícito, sem gravação',()=>{
    const bad:StoragePort={
      getItem(){throw Error('SecurityError')},
      setItem(){throw Error('forbidden')},
      removeItem(){throw Error('forbidden')}
    };
    const report=inspectCutoverGate(bad,true);
    expect(report.blockers.map(b=>b.code)).toContain('storage-unavailable');
    expect(report.canMigrate).toBe(false);
  });

  it('não aceita um objeto de evidências inventado para liberar a migração',()=>{
    const store=new Store();
    const forged={allActionsPorted:true,externalBackupVerified:true,
      writerExclusive:true,approved:true};
    const report=inspectCutoverGate(store,true,...([] as []));
    expect(Object.keys(forged)).toHaveLength(4);
    expect(report.status).toBe('blocked');
    expect(report.blockers.map(b=>b.code)).toContain('release-not-authorized');
    expect(store.writes).toBe(0);
  });
});
