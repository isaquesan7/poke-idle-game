import {describe,expect,it} from 'vitest';
import {createPlaySave,PLAY_SAVE_KEY,readPlaySave} from '../src/play/playSave';
import type {PlayStorage,PlaySnapshot} from '../src/play/playSave';
import {RegionalWriterMemoryLab} from '../src/play/regionalWriterMemoryLab';
import {RegionalCrashRecoveryLab} from '../src/play/regionalCrashRecoveryLab';
import type {RegionalCrashPoint} from '../src/play/regionalCrashRecoveryLab';

function snapshots(){
  const data=new Map<string,string>();
  let writes=0;
  const storage:PlayStorage={
    getItem:k=>data.get(k)??null,
    setItem:(k,v)=>{writes++;data.set(k,v);},
    removeItem:k=>{data.delete(k);}
  };
  expect(createPlaySave(storage,'CrashLab',4,1000,true).status).toBe('ok');
  const initial=readPlaySave(storage);
  if(initial.status!=='ready')throw Error('Fixture inválida');
  const before=initial.snapshot;
  const lab=new RegionalWriterMemoryLab(before);
  const applied=lab.apply({
    id:'regional-crash-1',expectedRevision:0,regionId:1,seed:2,
    pocketPolicy:'starter-proposal'
  });
  if(applied.status!=='applied')throw Error('Candidato hipotético indisponível');
  return{before,after:applied.snapshot,storage,data,writeCount:()=>writes};
}
describe('D-064U — recuperação de crash em laboratório, sem IO real',()=>{
  for(const point of ['before-backup','after-backup','after-candidate','after-marker','none'] as RegionalCrashPoint[]){
    it('crash '+point+' mantém origem íntegra e recuperação determinística',()=>{
      const f=snapshots(),start=f.writeCount(),raw=f.data.get(PLAY_SAVE_KEY);
      const recovery=new RegionalCrashRecoveryLab(f.before);
      recovery.stage(f.after,point);
      const result=recovery.recover();
      const committed=point==='after-marker'||point==='none';
      expect(result.status).toBe(committed?'committed':'original');
      if(result.status!=='blocked'){
        expect(result.snapshot).toEqual(committed?f.after:f.before);
        (result.snapshot.journal.receipts as unknown[]).splice(0);
        expect(recovery.recover().status).toBe(result.status);
      }
      expect(f.writeCount()).toBe(start);
      expect(f.data.get(PLAY_SAVE_KEY)).toBe(raw);
    });
  }
  it('marcador presente com candidato corrompido bloqueia rollback automático',()=>{
    const f=snapshots(),recovery=new RegionalCrashRecoveryLab(f.before);
    recovery.stage(f.after,'none');
    recovery.corruptCandidateForTest();
    expect(recovery.recover().status).toBe('blocked');
    expect(f.data.get(PLAY_SAVE_KEY)).toBe(JSON.stringify(f.before));
  });
  it('candidato obsoleto e origem inconsistente são rejeitados',()=>{
    const f=snapshots();
    const recovery=new RegionalCrashRecoveryLab(f.before);
    expect(()=>recovery.stage(f.before,'none')).toThrow(/obsoleto/);
    const invalid:PlaySnapshot={...f.before,revision:99};
    expect(()=>new RegionalCrashRecoveryLab(invalid)).toThrow(/Origem inválida/);
    recovery.stage(f.after,'after-backup');
    expect(()=>recovery.stage(f.after,'none')).toThrow(/já iniciado/);
  });
});
