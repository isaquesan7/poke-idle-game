import {describe,it,expect} from 'vitest';
import {createPlaySave,readPlaySave,PLAY_SAVE_KEY,updatePlaySave} from '../src/play/playSave';
import type {PlayStorage} from '../src/play/playSave';
import {RegionalWriterMemoryLab} from '../src/play/regionalWriterMemoryLab';

function fixture(demo=true){
  const map=new Map<string,string>();
  let writes=0;
  const storage:PlayStorage={
    getItem:key=>map.get(key)??null,
    setItem:(key,value)=>{writes++;map.set(key,value);},
    removeItem:key=>map.delete(key)
  };
  expect(createPlaySave(storage,'Laboratorio',4,1000,demo).status).toBe('ok');
  const initial=readPlaySave(storage);
  if(initial.status!=='ready')throw Error('fixture inválida');
  const lab=new RegionalWriterMemoryLab(initial.snapshot);
  return{storage,map,lab,baseline:map.get(PLAY_SAVE_KEY),writes:()=>writes};
}
const action=(revision=0)=>({
  id:'regional-test-1',expectedRevision:revision,regionId:1,
  seed:2,pocketPolicy:'starter-proposal' as const
});

describe('D-064T — writer transacional isolado em memória',()=>{
  it('combina migração XP, bolso e combate numa transição, sem tocar storage',()=>{
    const f=fixture();
    const startWrites=f.writes();
    const result=f.lab.apply(action());
    expect(result.status).toBe('applied');
    if(result.status!=='applied')return;
    expect(result.snapshot.revision).toBe(3);
    expect(result.snapshot.journal.revision).toBe(3);
    expect(result.snapshot.journal.receipts).toHaveLength(3);
    const before=JSON.parse(f.baseline!);
    const after=JSON.parse(result.snapshot.journal.raw);
    expect(after.trainer.level).toBe(before.journal?JSON.parse(before.journal.raw).trainer.level:21);
    expect(after.ballPocket).toBeDefined();
    expect(f.writes()).toBe(startWrites);
    expect(f.map.get(PLAY_SAVE_KEY)).toBe(f.baseline);
    result.snapshot.journal.receipts.splice?.(0); // apenas saída isolada (sem alteração da instância)
    expect(f.lab.inspect().journal.receipts).toHaveLength(3);
  });
  it('retry idêntico não cria novos recibos e ID conflitante é negado',()=>{
    const f=fixture();
    const first=f.lab.apply(action());
    expect(first.status).toBe('applied');
    const copy=JSON.stringify(f.lab.inspect());
    expect(f.lab.apply(action()).status).toBe('duplicate');
    expect(f.lab.apply({...action(),seed:3}).status).toBe('blocked');
    expect(JSON.stringify(f.lab.inspect())).toBe(copy);
  });
  it('revisão antiga bloqueia operação nova e mantém todas as recompensas',()=>{
    const f=fixture();
    expect(f.lab.apply(action()).status).toBe('applied');
    const before=JSON.stringify(f.lab.inspect());
    expect(f.lab.apply({...action(),id:'regional-test-2'}).status).toBe('blocked');
    expect(JSON.stringify(f.lab.inspect())).toBe(before);
  });
  it('sem suprimento inicial, tentativa de captura fracassa integralmente',()=>{
    const f=fixture();
    const before=JSON.stringify(f.lab.inspect());
    const result=f.lab.apply({...action(),pocketPolicy:'legacy-empty',ballId:'poke-ball' as const});
    expect(result.status).toBe('blocked');
    expect(JSON.stringify(f.lab.inspect())).toBe(before);
    expect(f.lab.apply(action()).status).toBe('applied');
  });
  it('região bloqueada não migra nem concede bolso e deixa retry livre',()=>{
    const f=fixture(false);
    const before=JSON.stringify(f.lab.inspect());
    const blocked=f.lab.apply({...action(),regionId:10});
    expect(blocked.status).toBe('blocked');
    expect(JSON.stringify(f.lab.inspect())).toBe(before);
    expect(f.lab.apply(action()).status).toBe('applied');
  });
  it('expedição antiga ativa impede migração sem liquidar seus ciclos',()=>{
    const f=fixture();
    expect(updatePlaySave(f.storage,0,{type:'start-expedition',nowMs:2000}).status).toBe('ok');
    const next=readPlaySave(f.storage);
    if(next.status!=='ready')throw Error('save inválido');
    const lab=new RegionalWriterMemoryLab(next.snapshot);
    const before=JSON.stringify(lab.inspect());
    expect(lab.apply({...action(),expectedRevision:1}).status).toBe('blocked');
    expect(JSON.stringify(lab.inspect())).toBe(before);
  });
  it('rejeita envelope inconsistente na inicialização',()=>{
    const f=fixture();
    const bad={...f.lab.inspect(),revision:5};
    expect(()=>new RegionalWriterMemoryLab(bad)).toThrow(/inválido/);
  });
});
