import {describe,it,expect} from 'vitest';
import {prepareRewardJournal,applyRegionalBattleDraft} from '../src/index.js';

function journal(regionWins:Record<string,number>={}){
  const value={
    version:1,mode:'demo',name:'Region Stock',coins:50,wins:0,losses:0,
    trainer:{level:100,xp:0,manual:{}},
    roster:[{uid:1,pokemonId:4,level:100,xp:0,affinity:0,
      manual:{},moveName:'ember',upgrades:{}}],
    team:[1],nextUid:2,badges:[],seen:[4],caughtSpecies:[4],
    expedition:null,lastClaim:null,regionalWins:regionWins,
    ballPocket:{version:1,quantities:{'poke-ball':2,'great-ball':0,'ultra-ball':0}},
    unrelated:{preserved:true}
  };
  const result=prepareRewardJournal(JSON.stringify(value));
  if(!result)throw Error('Fixture inválida');
  return result;
}
const run=(j:ReturnType<typeof journal>,regionId:number,i:number,ballId?:'poke-ball'|'great-ball'|'ultra-ball')=>
  applyRegionalBattleDraft(j,{
    id:'supply-'+regionId+'-'+i,expectedRevision:j.revision,regionId,
    seed:2,activeUid:1,outcome:'win',affinityGain:2,
    ...(ballId?{ballId}:{})
  });
describe('D-064Q — Poké Bolas renováveis por vitória regional em journal puro',()=>{
  it('reposição de Poké Ball ocorre uma vez a cada 3 vitórias no Bosque',()=>{
    let state=journal();
    for(let i=1;i<=6;i++){
      const res=run(state,1,i);
      expect(res.status).toBe('applied');
      if(res.status!=='applied')return;
      state=res.journal;
      const data=JSON.parse(state.raw);
      expect(data.regionalWins['1']).toBe(i);
      expect(data.ballPocket.quantities['poke-ball']).toBe(2+Math.floor(i/3));
      expect(data.unrelated).toEqual({preserved:true});
      expect(state.receipts).toHaveLength(i);
    }
    const last=JSON.parse(state.raw);
    const before=state.raw;
    expect(applyRegionalBattleDraft(state,{
      id:'supply-1-6',expectedRevision:5,regionId:1,seed:2,
      activeUid:1,outcome:'win',affinityGain:2
    }).status).toBe('duplicate');
    expect(state.raw).toBe(before);
    expect(last.ballPocket.quantities['poke-ball']).toBe(4);
  });
  it('captura e reposição na mesma vitória preservam bolso, UID e recibo',()=>{
    let state=journal({'1':2});
    const result=run(state,1,3,'poke-ball');
    expect(result.status).toBe('applied');
    if(result.status!=='applied')return;
    const data=JSON.parse(result.journal.raw);
    expect(data.regionalWins['1']).toBe(3);
    expect(data.ballPocket.quantities['poke-ball']).toBe(2);
    expect(data.roster).toHaveLength(2);
    expect(data.roster[1].pokemonId).toBe(16);
    expect(data.nextUid).toBe(3);
    expect(result.journal.receipts).toHaveLength(1);
    expect(applyRegionalBattleDraft(result.journal,{
      id:'supply-1-3',expectedRevision:0,regionId:1,seed:2,
      activeUid:1,outcome:'win',affinityGain:2,ballId:'poke-ball'
    }).status).toBe('duplicate');
    expect(state.revision).toBe(0);
  });
  it('Ultra Ball é renovável somente em regiões avançadas, a cada 15 vitórias',()=>{
    let state=journal();
    for(let i=1;i<=15;i++){
      const event=run(state,9,i);
      expect(event.status).toBe('applied');
      if(event.status!=='applied')return;
      state=event.journal;
    }
    const data=JSON.parse(state.raw);
    expect(data.regionalWins['9']).toBe(15);
    expect(data.ballPocket.quantities['ultra-ball']).toBe(1);
    expect(data.ballPocket.quantities['great-ball']).toBe(2);
    expect(data.ballPocket.quantities['poke-ball']).toBe(2);
  });
  it('recusa estado de vitórias corrompido ou estoque acima do teto sem premiação',()=>{
    const invalid=journal({'1':-1});
    expect(run(invalid,1,1).status).toBe('rejected');
    const initial=journal({'1':2});
    const data=JSON.parse(initial.raw);
    data.ballPocket.quantities['poke-ball']=100000;
    const filled=prepareRewardJournal(JSON.stringify(data))!;
    const denied=run(filled,1,3);
    expect(denied.status).toBe('rejected');
    expect(denied.journal).toBe(filled);
  });
});
