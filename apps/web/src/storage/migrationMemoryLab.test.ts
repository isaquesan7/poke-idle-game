import { describe, expect, it } from 'vitest';
import fixture from '../../../../tests/fixtures/legacy-save-v01.json';
import { LAB_CONFIRMATION_PHRASE, MigrationMemoryLab } from './migrationMemoryLab';
import type { LabFailureMode } from './migrationMemoryLab';

const original = JSON.stringify({
  ...fixture,
  note: 'Espaços, Pokémon 🐉 e atributos extras são preservados'
}, null, 2) + '\n';

function run(lab: MigrationMemoryLab, failure: LabFailureMode = 'none',
  expectedSourceRaw=original) {
  return lab.simulateCutover({
    phrase: LAB_CONFIRMATION_PHRASE, expectedSourceRaw, createdAt:1794865600000,
    failure
  });
}

describe('laboratório de migração apenas em memória (zero writes browser)',()=>{
  it('exige confirmação literal antes de criar qualquer chave',async()=>{
    const lab=new MigrationMemoryLab(original);
    const before=lab.snapshot();
    expect((await lab.simulateCutover({
      phrase:'CONFIRMO',expectedSourceRaw:original,createdAt:0
    })).status).toBe('blocked');
    expect(lab.snapshot()).toEqual(before);
    expect(await lab.inspect()).toEqual({status:'empty'});
  });

  it('faz backup → candidato → marcador no Map, sem converter progresso real',async()=>{
    const lab=new MigrationMemoryLab(original);
    expect(await run(lab)).toMatchObject({status:'simulated'});
    expect(await lab.inspect()).toMatchObject({status:'committed',recoverableRaw:original});
    expect(lab.snapshot().sourceRaw).toBe(original);
    expect(JSON.parse(lab.snapshot().candidateRaw!).progress.note).toMatch(/Pokémon/);
    expect(JSON.parse(lab.snapshot().candidateRaw!).progress.roster).toEqual(fixture.roster);
    expect(await lab.extractBackup()).toEqual({status:'ok',originalRaw:original});
  });

  it.each([
    ['quota','backup-only'],
    ['crash-after-backup','backup-only'],
    ['crash-after-candidate','staged'],
    ['crash-after-marker','committed']
  ] as const)('%s preserva a origem e deixa estágio audível %s',async(mode,stage)=>{
    const lab=new MigrationMemoryLab(original);
    expect((await run(lab,mode)).status).toBe('interrupted');
    expect((await lab.inspect()).status).toBe(stage);
    expect(lab.snapshot().sourceRaw).toBe(original);
    expect(await lab.extractBackup()).toEqual({status:'ok',originalRaw:original});
    // Um segundo envio NUNCA sobrescreve um journal parcial ou já concluído.
    const before=lab.snapshot();
    expect((await run(lab)).status).toBe('blocked');
    expect(lab.snapshot()).toEqual(before);
  });

  it('capacidade pequena simula QuotaExceeded antes da primeira escrita',async()=>{
    const initialBytes=new TextEncoder().encode(original).length;
    const lab=new MigrationMemoryLab(original,{quotaBytes:initialBytes+100});
    expect((await run(lab)).status).toBe('interrupted');
    expect(await lab.inspect()).toEqual({status:'empty'});
    expect(lab.snapshot().sourceRaw).toBe(original);
    expect((await lab.extractBackup()).status).toBe('blocked');
  });

  it('limite de quota pode falhar depois de backup, sem apagá-lo',async()=>{
    const sample=new MigrationMemoryLab(original);
    expect((await run(sample,'crash-after-backup')).status).toBe('interrupted');
    const backupBytes=new TextEncoder().encode(sample.snapshot().backupRaw!).length;
    const baseBytes=new TextEncoder().encode(original).length;
    const lab=new MigrationMemoryLab(original,{
      quotaBytes:baseBytes+backupBytes+200
    });
    expect((await run(lab)).status).toBe('interrupted');
    expect((await lab.inspect()).status).toBe('backup-only');
    expect(await lab.extractBackup()).toEqual({status:'ok',originalRaw:original});
  });

  it('mudança de origem pela aba antiga causa conflito e bloqueia a transição',async()=>{
    const lab=new MigrationMemoryLab(original);
    expect((await run(lab,'legacy-change-after-backup')).status).toBe('interrupted');
    expect((await lab.inspect()).status).toBe('conflict');
    expect(lab.snapshot().sourceRaw).toBe(original+' ');
    expect(await lab.extractBackup()).toEqual({status:'ok',originalRaw:original});
    expect((await run(lab)).status).toBe('blocked');
  });

  it('origem já alterada bloqueia sem iniciar backup, preservando as duas versões',async()=>{
    const lab=new MigrationMemoryLab(original);
    lab.simulateLegacyTabSave(JSON.stringify({...fixture,coins:9999}));
    expect((await run(lab)).status).toBe('blocked');
    expect(await lab.inspect()).toEqual({status:'empty'});
    expect(lab.snapshot().sourceRaw).toContain('"coins":9999');
  });

  it('double-submit concorrente é recusado antes de criar segundo journal',async()=>{
    const lab=new MigrationMemoryLab(original);
    const first=run(lab);
    const second=await run(lab);
    expect(second.status).toBe('blocked');
    expect(second.message).toMatch(/em andamento/);
    expect((await first).status).toBe('simulated');
    expect((await lab.inspect()).status).toBe('committed');
  });

  it('simula duas abas com revisão obsoleta sem tocar nos saves',async()=>{
    const lab=new MigrationMemoryLab(original);
    const before=lab.snapshot();
    expect(lab.simulateRevision(0)).toEqual({status:'fresh',nextRevision:1});
    expect(lab.simulateRevision(0).status).toBe('stale');
    expect(lab.simulateRevision(-1).status).toBe('invalid');
    expect(lab.simulateRevision(1)).toEqual({status:'fresh',nextRevision:2});
    const after=lab.snapshot();
    expect(after.revision).toBe(2);
    expect(after.sourceRaw).toBe(before.sourceRaw);
    expect(after.backupRaw).toBe(before.backupRaw);
  });

  it('rejeita versão futura e save inválido antes de qualquer journal',async()=>{
    for(const bad of ['{oops',JSON.stringify({...fixture,version:9})]){
      const lab=new MigrationMemoryLab(bad);
      expect((await run(lab,'none',bad)).status).toBe('blocked');
      expect(await lab.inspect()).toEqual({status:'empty'});
    }
  });

  it('não lê window.localStorage: a instância possui Map privado e não recebe Storage',async()=>{
    const dangerous={getItem(){throw Error('não ler storage')},
      setItem(){throw Error('NÃO GRAVAR')},removeItem(){throw Error('NÃO REMOVER')}};
    expect(dangerous).not.toHaveProperty('memory');
    const lab=new MigrationMemoryLab(original);
    expect((await run(lab)).status).toBe('simulated');
    expect(lab.snapshot().sourceRaw).toBe(original);
  });
});
