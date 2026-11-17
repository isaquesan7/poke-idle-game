import { describe, expect, it } from 'vitest';
import fixture from '../../../../tests/fixtures/legacy-save-v01.json';
import {
  MAX_RECOVERY_FILE_BYTES, prepareVerifiedRecoveryExport, inspectRecoveryFile
} from './recoveryExchange';
import { LEGACY_SAVE_KEY } from './legacySave';

const original=JSON.stringify(fixture);

class ReadOnlyStore {
  content:string|null=original;
  readCount=0;
  writes=0;
  switchAt=Number.MAX_SAFE_INTEGER;
  getItem(key:string):string|null {
    expect(key).toBe(LEGACY_SAVE_KEY);
    this.readCount++;
    if(this.readCount >= this.switchAt)
      return JSON.stringify({...fixture,coins:fixture.coins+5});
    return this.content;
  }
  setItem(){this.writes++;throw Error('proibido gravar');}
  removeItem(){this.writes++;throw Error('proibido apagar');}
}

describe('pacote de recuperação verificável, sem importação automática',()=>{
  it('gera backup SHA-256 verificável sem tocar na chave de save',async()=>{
    const store=new ReadOnlyStore();
    const generated=await prepareVerifiedRecoveryExport(store,original,1794865600000);
    expect(generated.status).toBe('ready');
    if(generated.status!=='ready')return;
    expect(generated.fileName).toBe('kanto-idle-v01-recovery-verified.json');
    const object=JSON.parse(generated.json);
    expect(object.backup.sourceRaw).toBe(original);
    expect(object.candidate.progress).toEqual(fixture);
    expect((await inspectRecoveryFile(generated.json,store)).status).toBe('matching');
    expect(store.writes).toBe(0);
    expect(store.content).toBe(original);
  });

  it('recusa exportar origem desatualizada antes da preparação',async()=>{
    const store=new ReadOnlyStore();
    store.content=JSON.stringify({...fixture,coins:999});
    expect((await prepareVerifiedRecoveryExport(store,original,0)).status).toBe('blocked');
    expect(store.writes).toBe(0);
  });

  it('recusa exportar se outra aba atualiza durante cálculo/validação async',async()=>{
    for(const switchAt of [2,3]) {
      const store=new ReadOnlyStore();
      store.switchAt=switchAt;
      const result=await prepareVerifiedRecoveryExport(store,original,0);
      expect(result.status).toBe('blocked');
      expect(store.writes).toBe(0);
    }
  });

  it('distingue arquivo íntegro mas diferente e origem ausente sem restaurar',async()=>{
    const store=new ReadOnlyStore();
    const generated=await prepareVerifiedRecoveryExport(store,original,0);
    if(generated.status!=='ready')throw Error('fixture');
    store.content=JSON.stringify({...fixture,coins:322});
    expect((await inspectRecoveryFile(generated.json,store)).status).toBe('different');
    store.content=null;
    expect((await inspectRecoveryFile(generated.json,store)).status).toBe('missing');
    expect(store.writes).toBe(0);
  });

  it('recusa arquivo inválido, adulterado, versão futura e tamanho excessivo',async()=>{
    const store=new ReadOnlyStore();
    const generated=await prepareVerifiedRecoveryExport(store,original,0);
    if(generated.status!=='ready')throw Error('fixture');
    expect((await inspectRecoveryFile('{oops',store)).status).toBe('invalid');
    const packageJson=JSON.parse(generated.json);
    expect((await inspectRecoveryFile(JSON.stringify({
      ...packageJson,bundleVersion:3
    }),store)).status).toBe('invalid');
    expect((await inspectRecoveryFile(JSON.stringify({
      ...packageJson,backup:{...packageJson.backup,sourceRaw:original+' '}
    }),store)).status).toBe('invalid');
    expect((await inspectRecoveryFile('x'.repeat(MAX_RECOVERY_FILE_BYTES+1),store)).status)
      .toBe('invalid');
    expect(store.writes).toBe(0);
  });

  it('erro do armazenamento não implica que importação ocorreu',async()=>{
    const unavailable={getItem(){throw Error('storage disabled')}};
    const store=new ReadOnlyStore();
    const generated=await prepareVerifiedRecoveryExport(store,original,0);
    if(generated.status!=='ready')throw Error('fixture');
    expect((await inspectRecoveryFile(generated.json,unavailable)).status).toBe('unavailable');
    expect((await prepareVerifiedRecoveryExport(unavailable,original,0)).status).toBe('blocked');
  });
});
