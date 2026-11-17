import { describe, expect, it } from 'vitest';
import fixture from '../../../../tests/fixtures/legacy-save-v01.json';
import { prepareRecoveryBundle } from './officialSaveV02';
import { planRecoveryJournal } from './recoveryJournal';
import type { RecoverySlots } from './recoveryJournal';
import {
  OFFICIAL_V02_LOCK_NAME, checkCooperativeRevision,
  inspectWriterHandoff, withExclusiveV02Writer
} from './writerCoordination';

const original = JSON.stringify(fixture);
const empty: RecoverySlots = {
  legacyRaw: original, backupRaw: null, candidateRaw: null, markerRaw: null
};

async function slotsAfter(writeCount: number): Promise<RecoverySlots> {
  const result = await prepareRecoveryBundle(original, 1794865600000);
  if (result.status !== 'ok') throw Error('fixture inválida');
  const plan = await planRecoveryJournal(JSON.stringify(result.value), empty);
  if (plan.status !== 'planned') throw Error(plan.reason);
  const entries = new Map(plan.steps.slice(0,writeCount).map(({ key,value })=>[key,value]));
  return {
    legacyRaw: original,
    backupRaw: entries.get('kanto-idle-lab-save-v02-origin-backup') ?? null,
    candidateRaw: entries.get('kanto-idle-lab-save-v02') ?? null,
    markerRaw: entries.get('kanto-idle-lab-save-v02-commit') ?? null
  };
}

class LockHarness {
  occupied = false;
  requests: { name:string; options:LockOptions }[] = [];
  async request<T>(
    name: string, options: LockOptions,
    callback: (lock: Lock | null) => T | Promise<T>
  ): Promise<T> {
    this.requests.push({ name, options });
    if (this.occupied) return callback(null);
    this.occupied=true;
    try {
      return await callback({name,mode:'exclusive'} as Lock);
    } finally {
      this.occupied=false;
    }
  }
}

describe('isolamento entre versões e lock cooperativo (sem tocar saves)',()=>{
  it('sem migração, a v0.1 permanece canônica; escrita real nunca liberada',async()=>{
    expect(await inspectWriterHandoff(empty)).toMatchObject({
      state:'legacy-only',canWriteRealSave:false
    });
  });

  it('detecta backup parcial e candidata staged sem ativar a v0.2',async()=>{
    for(const n of [1,2]){
      const audit=await inspectWriterHandoff(await slotsAfter(n));
      expect(audit.state).toBe('backup-incomplete');
      expect(audit.canWriteRealSave).toBe(false);
      expect(audit.recoveryRaw).toBe(original);
    }
  });

  it('commit íntegro ainda não habilita escrita nem sincroniza a v0.1',async()=>{
    const snapshot=await slotsAfter(3);
    expect(await inspectWriterHandoff(snapshot)).toMatchObject({
      state:'v02-isolated',canWriteRealSave:false,recoveryRaw:original
    });
    const v01Changed={...snapshot,legacyRaw:JSON.stringify({...fixture,coins:999})};
    expect(await inspectWriterHandoff(v01Changed)).toMatchObject({
      state:'legacy-diverged',canWriteRealSave:false,recoveryRaw:original
    });
    expect(v01Changed.legacyRaw).toContain('"coins":999');
  });

  it('não mascara corrupção do journal; backup íntegro permanece exportável',async()=>{
    const full=await slotsAfter(3);
    expect(await inspectWriterHandoff({...full,markerRaw:'{'})).toMatchObject({
      state:'damaged',canWriteRealSave:false,recoveryRaw:original
    });
    expect(await inspectWriterHandoff({...full,backupRaw:'{'})).toMatchObject({
      state:'damaged',canWriteRealSave:false
    });
  });

  it('revisão monotônica rejeita stale, negativa, NaN e overflow',()=>{
    expect(checkCooperativeRevision(4,4)).toEqual({status:'fresh',nextRevision:5});
    expect(checkCooperativeRevision(4,5)).toMatchObject({status:'stale'});
    expect(checkCooperativeRevision(1.5,1.5)).toMatchObject({status:'invalid'});
    expect(checkCooperativeRevision(-1,0)).toMatchObject({status:'invalid'});
    expect(checkCooperativeRevision(Number.NaN,0)).toMatchObject({status:'invalid'});
    expect(checkCooperativeRevision(Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER))
      .toMatchObject({status:'invalid'});
  });

  it('sem Web Locks não executa sequer a callback, evitando fallback inseguro',async()=>{
    let called=false;
    expect((await withExclusiveV02Writer(null,()=>{
      called=true;
      return 1;
    })).status).toBe('blocked');
    expect(called).toBe(false);
  });

  it('uma segunda aba fica bloqueada enquanto outra mantém o lock',async()=>{
    const harness=new LockHarness();
    let release!:()=>void;
    const hold=new Promise<void>(resolve=>{release=resolve;});
    const first=withExclusiveV02Writer(harness as unknown as LockManager,async()=>{
      await hold;
      return 'A';
    });
    let secondCalled=false;
    const second=await withExclusiveV02Writer(
      harness as unknown as LockManager,()=>{
        secondCalled=true;return 'B';
      }
    );
    expect(second.status).toBe('blocked');
    expect(secondCalled).toBe(false);
    release();
    expect(await first).toEqual({status:'ok',value:'A'});
    expect(harness.requests).toHaveLength(2);
    expect(harness.requests.every(r=>r.name===OFFICIAL_V02_LOCK_NAME)).toBe(true);
    expect(harness.requests.every(r=>
      r.options.ifAvailable===true && r.options.mode==='exclusive'
    )).toBe(true);
  });

  it('falha de callback não é relatada como commit bem-sucedido',async()=>{
    const harness=new LockHarness();
    const result=await withExclusiveV02Writer(
      harness as unknown as LockManager,
      ()=>{throw Error('quota simulada');}
    );
    expect(result.status).toBe('blocked');
    if(result.status==='blocked') expect(result.reason).toMatch(/Audite o journal/);
    expect(harness.occupied).toBe(false);
  });

  it('recheck dentro do lock identifica revisão antiga da aba B',async()=>{
    const harness=new LockHarness();
    let revision=0;
    const a=await withExclusiveV02Writer(
      harness as unknown as LockManager,()=>{
        const checked=checkCooperativeRevision(0,revision);
        if(checked.status==='fresh')revision=checked.nextRevision;
        return checked.status;
      }
    );
    const b=await withExclusiveV02Writer(
      harness as unknown as LockManager,()=>checkCooperativeRevision(0,revision).status
    );
    expect(a).toEqual({status:'ok',value:'fresh'});
    expect(b).toEqual({status:'ok',value:'stale'});
    expect(revision).toBe(1);
  });
});
