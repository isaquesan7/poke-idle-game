import { describe, expect, it } from 'vitest';
import fixture from '../../../../tests/fixtures/legacy-save-v01.json';
import {
  prepareRecoveryBundle,
  ORIGIN_BACKUP_V02_KEY, OFFICIAL_V02_KEY, COMMIT_MARKER_V02_KEY
} from './officialSaveV02';
import {
  auditRecoveryJournal, extractRecoverableLegacyRaw,
  planRecoveryJournal, RESERVED_RECOVERY_KEYS
} from './recoveryJournal';
import type { RecoverySlots } from './recoveryJournal';

const original = JSON.stringify(fixture);
const empty: RecoverySlots = {
  legacyRaw: original,
  backupRaw: null, candidateRaw: null, markerRaw: null
};
async function plan() {
  const prepared = await prepareRecoveryBundle(original, 1794865513000);
  if (prepared.status !== 'ok') throw Error(prepared.reason);
  const written = await planRecoveryJournal(JSON.stringify(prepared.value), empty);
  if (written.status !== 'planned') throw Error(written.reason);
  return written.steps;
}
function simulate(steps: readonly {key:string,value:string}[],completed:number,
  storage:Map<string,string> = new Map([['kanto-idle-lab-save-v01',original]])): RecoverySlots {
  steps.slice(0,completed).forEach(({key,value})=>storage.set(key,value));
  return {
    legacyRaw:storage.get('kanto-idle-lab-save-v01') ?? null,
    backupRaw:storage.get(ORIGIN_BACKUP_V02_KEY) ?? null,
    candidateRaw:storage.get(OFFICIAL_V02_KEY) ?? null,
    markerRaw:storage.get(COMMIT_MARKER_V02_KEY) ?? null
  };
}

describe('journal simulado de backup, sem writes no navegador', () => {
  it('produz exatamente backup → candidato → commit, sem chamar storage', async () => {
    const steps = await plan();
    expect(steps.map(s=>s.key)).toEqual([
      ORIGIN_BACKUP_V02_KEY,OFFICIAL_V02_KEY,COMMIT_MARKER_V02_KEY
    ]);
    expect(RESERVED_RECOVERY_KEYS).toContain('kanto-idle-lab-save-v01');
    expect(await auditRecoveryJournal(empty)).toEqual({status:'empty'});
  });

  it.each([
    [0,'empty'],
    [1,'backup-only'],
    [2,'staged'],
    [3,'committed']
  ] as const)('identifica interrupção após %i escrita(s), estágio %s',async(completed,status)=>{
    const steps=await plan();
    const slots=simulate(steps,completed);
    const audit=await auditRecoveryJournal(slots);
    expect(audit.status).toBe(status);
    expect(slots.legacyRaw).toBe(original);
    if(completed>0) {
      expect(await extractRecoverableLegacyRaw(slots)).toEqual({
        status:'ok',originalRaw:original
      });
    } else {
      expect((await extractRecoverableLegacyRaw(slots)).status).toBe('blocked');
    }
  });

  it.each([1,2,3] as const)(
    'simula quota/permissão negada ANTES da escrita %i, sem perder a origem',
    async(failAt)=>{
      const steps=await plan();
      const storage=new Map<string,string>([['kanto-idle-lab-save-v01',original]]);
      for(let i=0;i<steps.length;i++){
        if(i+1===failAt) break; // quota ou crash interrompe o fluxo antes de setItem
        const step=steps[i]!;
        storage.set(step.key,step.value);
      }
      const slots=simulate([],0,storage);
      expect(storage.get('kanto-idle-lab-save-v01')).toBe(original);
      expect((await auditRecoveryJournal(slots)).status).toBe(
        failAt===1?'empty':failAt===2?'backup-only':'staged'
      );
      if(failAt>1) {
        expect(await extractRecoverableLegacyRaw(slots)).toEqual({
          status:'ok',originalRaw:original
        });
      }
    }
  );

  it('não sobrescreve chave alguma se houver backup, candidato ou commit anterior', async()=>{
    const steps=await plan();
    const prepared=await prepareRecoveryBundle(original,0);
    if(prepared.status!=='ok')throw Error('fixture inválida');
    const serialized=JSON.stringify(prepared.value);
    for(const step of steps) {
      const slots:RecoverySlots={
        ...empty,
        backupRaw:step.key===ORIGIN_BACKUP_V02_KEY?step.value:null,
        candidateRaw:step.key===OFFICIAL_V02_KEY?step.value:null,
        markerRaw:step.key===COMMIT_MARKER_V02_KEY?step.value:null
      };
      expect((await planRecoveryJournal(serialized,slots)).status).toBe('blocked');
    }
    expect((await planRecoveryJournal(serialized,{
      ...empty,legacyRaw:JSON.stringify({...fixture,coins:999})
    })).status).toBe('blocked');
  });

  it('interrompe ativação se o save v0.1 mudar, mantendo recuperação do original',async()=>{
    const steps=await plan();
    const slots={
      ...simulate(steps,3),
      legacyRaw: JSON.stringify({...fixture,coins:322})
    };
    const audit=await auditRecoveryJournal(slots);
    expect(audit.status).toBe('conflict');
    expect(await extractRecoverableLegacyRaw(slots)).toEqual({
      status:'ok',originalRaw:original
    });
    expect(slots.legacyRaw).not.toBe(original);
  });

  it('detecta candidato, backup e marcador corrompidos sem apagar nada',async()=>{
    const steps=await plan();
    const slots=simulate(steps,3);
    expect((await auditRecoveryJournal({...slots,markerRaw:'{bad'})).status).toBe('damaged');
    expect((await auditRecoveryJournal({...slots,markerRaw:JSON.stringify({
      ...JSON.parse(slots.markerRaw!),candidateSha256:'a'.repeat(64)
    })})).status).toBe('damaged');
    expect((await auditRecoveryJournal({...slots,candidateRaw:'{bad'})).status).toBe('damaged');
    expect((await auditRecoveryJournal({...slots,backupRaw:'{bad'})).status).toBe('damaged');
    expect((await auditRecoveryJournal({...slots,backupRaw:null})).status).toBe('damaged');
    expect((await auditRecoveryJournal({...slots,candidateRaw:null})).status).toBe('damaged');
    // Mesmo com candidato ruim, backup intacto preserva bytes da v0.1.
    expect(await extractRecoverableLegacyRaw({...slots,candidateRaw:'{bad'})).toEqual({
      status:'ok',originalRaw:original
    });
  });

  it('rejeita usar o rascunho como save oficial, não existe promoção de draft',async()=>{
    const prepared=await prepareRecoveryBundle(original,0);
    if(prepared.status!=='ok')throw Error('fixture inválida');
    const forged=JSON.stringify({
      ...prepared.value,
      candidate:{...prepared.value.candidate,progress:{...fixture,coins:9999}}
    });
    expect((await planRecoveryJournal(forged,empty)).status).toBe('blocked');
  });
});
