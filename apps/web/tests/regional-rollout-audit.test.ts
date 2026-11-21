import {describe,it,expect} from 'vitest';
import {PLAY_SAVE_KEY,createPlaySave,readPlaySave,updatePlaySave} from '../src/play/playSave';
import type {PlayStorage} from '../src/play/playSave';
import {auditRegionalRollout} from '../src/play/regionalRolloutAudit';

function setup(demo=false){
  let writes=0;
  const map=new Map<string,string>();
  const storage:PlayStorage={
    getItem:key=>map.get(key)??null,
    setItem:(key,value)=>{writes++;map.set(key,value);},
    removeItem:key=>{map.delete(key);}
  };
  expect(createPlaySave(storage,'D064R',4,1000,demo).status).toBe('ok');
  return{storage,map,writeCount:()=>writes};
}
const request=(policy:'legacy-empty'|'starter-proposal'='starter-proposal')=>({
  expectedRevision:0,regionId:1,seed:2,pocketPolicy:policy
  it('nega envelope com revisão externa diferente da revisão do journal',()=>{
    const {storage,map,writeCount}=setup(true);
    const baseline=writeCount();
    const raw=JSON.parse(storage.getItem(PLAY_SAVE_KEY)!);
    raw.revision=1;
    map.set(PLAY_SAVE_KEY,JSON.stringify(raw));
    const result=auditRegionalRollout(storage,{...request(),expectedRevision:1});
    expect(result.status).toBe('blocked');
    if(result.status==='blocked')expect(result.reason).toMatch(/Revisões internas/);
    expect(writeCount()).toBe(baseline);
  });
  it('nega resultado obsoleto quando outra aba modifica o save entre leituras',()=>{
    const {storage,map,writeCount}=setup(true);
    const baseline=writeCount();
    const original=storage.getItem(PLAY_SAVE_KEY)!;
    let reads=0;
    const racingStorage={
      getItem:(key:string)=>{
        reads++;
        if(reads===2){
          const tampered=JSON.parse(original);
          tampered.journal.raw=tampered.journal.raw.replace('"coins":200','"coins":199');
          map.set(key,JSON.stringify(tampered));
        }
        return storage.getItem(key);
      }
    };
    const result=auditRegionalRollout(racingStorage,request());
    expect(result.status).toBe('blocked');
    if(result.status==='blocked')expect(result.reason).toMatch(/mudou durante a auditoria/);
    expect(writeCount()).toBe(baseline);
  });
  it('nega auditoria quando a segunda leitura fica indisponível',()=>{
    const {storage,writeCount}=setup(true);
    const baseline=writeCount();
    let reads=0;
    const flaky={getItem:(key:string)=>{
      if(++reads===2)throw new Error('blocked storage');
      return storage.getItem(key);
    }};
    const result=auditRegionalRollout(flaky,request());
    expect(result.status).toBe('blocked');
    expect(writeCount()).toBe(baseline);
  });

});
describe('D-064R — auditoria de migração e combate sem qualquer persistência',()=>{
  it('ensaia migração XP, bolso e batalha a partir do save antigo sem um setItem',()=>{
    const {storage,writeCount}=setup(true);
    const raw=storage.getItem(PLAY_SAVE_KEY);
    const baseline=writeCount();
    const result=auditRegionalRollout(storage,request());
    expect(result.status).toBe('ready');
    if(result.status!=='ready')return;
    expect(result.operations).toEqual(['migrate-xp','migrate-pocket','battle']);
    expect(result.originalRevision).toBe(0);
    expect(result.proposedJournalRevision).toBe(3);
    expect(result.ballCountBefore).toBe(0);
    expect(result.ballCountAfter).toBe(12);
    expect(result.originalTrainerLevel).toBe(21);
    expect(result.willWrite).toBe(false);
    expect(auditRegionalRollout(storage,request())).toEqual(result);
    expect(writeCount()).toBe(baseline);
    expect(storage.getItem(PLAY_SAVE_KEY)).toBe(raw);
    const live=readPlaySave(storage);
    expect(live.status).toBe('ready');
    if(live.status==='ready')expect(live.snapshot.journal.revision).toBe(0);
  });
  it('política empty não cria estoque fictício, nem altera save',()=>{
    const {storage,writeCount}=setup(true);
    const baseline=writeCount();
    const preview=auditRegionalRollout(storage,request('legacy-empty'));
    expect(preview.status).toBe('ready');
    if(preview.status==='ready'){
      expect(preview.ballCountAfter).toBe(0);
      expect(preview.operations).toEqual(['migrate-xp','migrate-pocket','battle']);
    }
    expect(writeCount()).toBe(baseline);
  });
  it('tentar bola sem estoque é bloqueado e não migra de verdade',()=>{
    const {storage,writeCount}=setup(true);
    const baseline=writeCount(),raw=storage.getItem(PLAY_SAVE_KEY);
    let victorySeed:number|undefined;
    for(let seed=0;seed<60;seed++){
      const simulated=auditRegionalRollout(storage,{
        expectedRevision:0,regionId:1,seed,pocketPolicy:'starter-proposal'
      });
      if(simulated.status==='ready'&&simulated.battleOutcome==='win'){
        victorySeed=seed;break;
      }
    }
    expect(victorySeed).toBeDefined();
    const result=auditRegionalRollout(storage,{
      expectedRevision:0,regionId:1,seed:victorySeed!,pocketPolicy:'legacy-empty',ballId:'poke-ball'
    });
    expect(result.status).toBe('blocked');
    expect(writeCount()).toBe(baseline);
    expect(storage.getItem(PLAY_SAVE_KEY)).toBe(raw);
  });
  it('bloqueia região alta e revisão desatualizada',()=>{
    const {storage,writeCount}=setup();
    const count=writeCount();
    expect(auditRegionalRollout(storage,{...request(),regionId:10}).status).toBe('blocked');
    expect(auditRegionalRollout(storage,{...request(),expectedRevision:1}).status).toBe('blocked');
    expect(auditRegionalRollout(storage,{...request(),seed:-1}).status).toBe('blocked');
    expect(writeCount()).toBe(count);
  });
  it('não interrompe nem liquida expedição legada ativa',()=>{
    const {storage,writeCount}=setup();
    const started=updatePlaySave(storage,0,{type:'start-expedition',nowMs:2000});
    expect(started.status).toBe('ok');
    const raw=storage.getItem(PLAY_SAVE_KEY),count=writeCount();
    const blocked=auditRegionalRollout(storage,{...request(),expectedRevision:1});
    expect(blocked.status).toBe('blocked');
    expect(writeCount()).toBe(count);
    expect(storage.getItem(PLAY_SAVE_KEY)).toBe(raw);
  });
});
