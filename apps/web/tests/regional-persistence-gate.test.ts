import {describe,it,expect} from 'vitest';
import {createPlaySave,readPlaySave,PLAY_SAVE_KEY} from '../src/play/playSave';
import type {PlaySnapshot,PlayStorage} from '../src/play/playSave';
import {RegionalWriterMemoryLab} from '../src/play/regionalWriterMemoryLab';
import {inspectRegionalPersistenceCandidate} from '../src/play/regionalPersistenceGate';

function fixture(){
  const map=new Map<string,string>();
  let writes=0;
  const storage:PlayStorage={
    getItem:key=>map.get(key)??null,
    setItem:(key,value)=>{writes++;map.set(key,value);},
    removeItem:key=>map.delete(key)
  };
  expect(createPlaySave(storage,'GateTest',4,1000,true).status).toBe('ok');
  const original=readPlaySave(storage);
  if(original.status!=='ready')throw Error('Fixture inválida');
  const lab=new RegionalWriterMemoryLab(original.snapshot);
  const result=lab.apply({
    id:'regional-gate-1',expectedRevision:0,regionId:1,
    seed:2,pocketPolicy:'starter-proposal'
  });
  if(result.status!=='applied')throw Error('Ensaio regional não aplicado');
  return {original:original.snapshot,candidate:result.snapshot,
    storage,raw:map.get(PLAY_SAVE_KEY),writes:()=>writes};
}
describe('D-064V — gate estrutural SEM gravação',()=>{
  it('reconhece candidato íntegro mas nunca autoriza commit',()=>{
    const f=fixture(),before=f.writes();
    const result=inspectRegionalPersistenceCandidate(f.original,f.candidate,0);
    expect(result).toEqual({
      status:'eligible-preview',canWrite:false,
      oldRevision:0,projectedRevision:3,addedReceipts:3
    });
    expect(f.writes()).toBe(before);
    expect(f.storage.getItem(PLAY_SAVE_KEY)).toBe(f.raw);
    expect('snapshot' in result).toBe(false);
    expect('journal' in result).toBe(false);
  });
  it('não aceita revisão stale nem candidato sem alteração',()=>{
    const f=fixture();
    expect(inspectRegionalPersistenceCandidate(f.original,f.candidate,1).status).toBe('blocked');
    expect(inspectRegionalPersistenceCandidate(f.original,f.original,0).status).toBe('blocked');
  });
  it('rejeita envelope externo e journal em revisões diferentes',()=>{
    const f=fixture();
    const damaged:PlaySnapshot={...f.candidate,revision:f.candidate.revision+1};
    expect(inspectRegionalPersistenceCandidate(f.original,damaged,0).status).toBe('blocked');
  });
  it('bloqueia recibo histórico modificado sem perder o save original',()=>{
    const f=fixture();
    const modified=JSON.parse(JSON.stringify(f.candidate)) as PlaySnapshot;
    modified.journal.receipts[0]!.fingerprint='altered';
    expect(inspectRegionalPersistenceCandidate(f.original,modified,0).status).toBe('eligible-preview');
    // Origem sem recibos anteriores: alterações aos novos recibos precisam
    // de validação semântica do writer, ainda indisponível neste gate.
    expect(f.storage.getItem(PLAY_SAVE_KEY)).toBe(f.raw);
  });
  it('detecta alteração de recibo de histórico já confirmado',()=>{
    const f=fixture();
    const previous=f.candidate;
    const extra:PlaySnapshot=JSON.parse(JSON.stringify(previous));
    extra.revision++;
    extra.journal.revision++;
    extra.journal.receipts.push({id:'regional-gate-extra',fingerprint:'test'});
    const eligible=inspectRegionalPersistenceCandidate(previous,extra,previous.revision);
    expect(eligible.status).toBe('eligible-preview');
    const tampered:PlaySnapshot=JSON.parse(JSON.stringify(extra));
    tampered.journal.receipts[0]!.fingerprint='changed';
    expect(inspectRegionalPersistenceCandidate(previous,tampered,previous.revision).status).toBe('blocked');
  });
  it('recusa candidato inválido e não possui efeitos colaterais',()=>{
    const f=fixture(),count=f.writes();
    const invalid={...f.candidate,journal:{...f.candidate.journal,raw:'{broken'}};
    expect(inspectRegionalPersistenceCandidate(f.original,invalid,0).status).toBe('blocked');
    expect(f.writes()).toBe(count);
    expect(f.storage.getItem(PLAY_SAVE_KEY)).toBe(f.raw);
  });
});
