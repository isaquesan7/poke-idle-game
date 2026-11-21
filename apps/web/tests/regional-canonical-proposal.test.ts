import {describe,expect,it} from 'vitest';
import {createPlaySave,PLAY_SAVE_KEY,readPlaySave} from '../src/play/playSave';
import type {PlaySnapshot,PlayStorage} from '../src/play/playSave';
import {RegionalWriterMemoryLab} from '../src/play/regionalWriterMemoryLab';
import {inspectCanonicalRegionalProposal} from '../src/play/regionalPersistenceGate';

const command={
  id:'d064w-canonical-1',
  expectedRevision:0,regionId:1,seed:2,
  pocketPolicy:'starter-proposal' as const
};
function fixture(){
  const records=new Map<string,string>();
  let writes=0;
  const storage:PlayStorage={
    getItem:key=>records.get(key)??null,
    setItem:(key,value)=>{records.set(key,value);writes++;},
    removeItem:key=>{records.delete(key);}
  };
  expect(createPlaySave(storage,'CanonicalTest',4,1000,true).status).toBe('ok');
  const read=readPlaySave(storage);
  if(read.status!=='ready')throw Error('Falha na fixture D064W');
  const original=read.snapshot;
  const lab=new RegionalWriterMemoryLab(original);
  const proposed=lab.apply(command);
  if(proposed.status!=='applied')throw Error('Simulação D064W indisponível');
  return {original,candidate:proposed.snapshot,storage,
    originalRaw:storage.getItem(PLAY_SAVE_KEY),writeCount:()=>writes};
}
const copy=(value:PlaySnapshot):PlaySnapshot=>
  JSON.parse(JSON.stringify(value)) as PlaySnapshot;

describe('D-064W — candidato equivalente ao cálculo canônico, sem gravação',()=>{
  it('permite apenas prévia de uma proposta reconstruída pelo motor',()=>{
    const f=fixture(),writes=f.writeCount();
    const outcome=inspectCanonicalRegionalProposal(f.original,f.candidate,command);
    expect(outcome).toEqual({
      status:'eligible-preview',canWrite:false,
      oldRevision:0,projectedRevision:3,addedReceipts:3
    });
    expect('snapshot' in outcome).toBe(false);
    expect(f.writeCount()).toBe(writes);
    expect(f.storage.getItem(PLAY_SAVE_KEY)).toBe(f.originalRaw);
  });
  it('rejeita moedas forjadas apesar de schema e recibos válidos',()=>{
    const f=fixture(),bad=copy(f.candidate);
    const game=JSON.parse(bad.journal.raw);
    game.coins+=10000;
    (bad.journal as {raw:string}).raw=JSON.stringify(game);
    const result=inspectCanonicalRegionalProposal(f.original,bad,command);
    expect(result.status).toBe('blocked');
    expect(result.canWrite).toBe(false);
    expect(f.storage.getItem(PLAY_SAVE_KEY)).toBe(f.originalRaw);
  });
  it('rejeita manipulação de recibos novos com estrutura válida',()=>{
    const f=fixture(),bad=copy(f.candidate);
    (bad.journal.receipts as unknown as Array<{fingerprint:string}>)[2]!.fingerprint='fabricado';
    expect(inspectCanonicalRegionalProposal(f.original,bad,command).status).toBe('blocked');
    expect(f.storage.getItem(PLAY_SAVE_KEY)).toBe(f.originalRaw);
  });
  it('rejeita seed/área distinta da proposta e revisão antiga',()=>{
    const f=fixture();
    expect(inspectCanonicalRegionalProposal(f.original,f.candidate,
      {...command,seed:3}).status).toBe('blocked');
    expect(inspectCanonicalRegionalProposal(f.original,f.candidate,
      {...command,regionId:2}).status).toBe('blocked');
    expect(inspectCanonicalRegionalProposal(f.original,f.candidate,
      {...command,expectedRevision:1}).status).toBe('blocked');
  });
  it('rejeita captura ou UID acrescentado arbitrariamente',()=>{
    const f=fixture(),bad=copy(f.candidate);
    const game=JSON.parse(bad.journal.raw);
    game.nextUid+=1;
    (bad.journal as {raw:string}).raw=JSON.stringify(game);
    expect(inspectCanonicalRegionalProposal(f.original,bad,command).status).toBe('blocked');
    expect(f.storage.getItem(PLAY_SAVE_KEY)).toBe(f.originalRaw);
  });
});
