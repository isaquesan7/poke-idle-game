import {describe,it,expect} from 'vitest';
import {
  prepareRewardJournal,applyRegionalBattleDraft,
  kantoRegionalEncounter
} from '../src/index.js';

const source=()=>({
  version:1,name:'D064',mode:'demo',
  coins:100,wins:0,losses:0,trainer:{level:100,xp:0,manual:{}},
  roster:[{uid:1,pokemonId:4,level:100,xp:0,affinity:50,manual:{},moveName:'ember',upgrades:{}}],
  team:[1],nextUid:2,badges:[],seen:[4],caughtSpecies:[4],
  expedition:null,lastClaim:null,
  ballPocket:{version:1,quantities:{'poke-ball':3,'ultra-ball':2}},
  unrelated:{preserve:true}
});
function fixture(v:Record<string,unknown>=source()){
  const j=prepareRewardJournal(JSON.stringify(v));
  if(!j)throw Error('Fixture inválida');
  return j;
}
const command=(overrides:Partial<Parameters<typeof applyRegionalBattleDraft>[1]>={})=>({
  id:'region-battle-1',expectedRevision:0,regionId:1,seed:2,activeUid:1,
  outcome:'win' as const,affinityGain:3,ballId:'poke-ball' as const,
  ...overrides
});
describe('D-064J — transação pura de recompensa, débito e captura regionais',()=>{
  it('vitória regional debita uma bola e resolve captura na mesma revisão',()=>{
    const original=fixture();
    const first=applyRegionalBattleDraft(original,command());
    expect(first.status).toBe('applied');
    if(first.status!=='applied')return;
    const data=JSON.parse(first.journal.raw);
    expect(first.journal.revision).toBe(1);
    expect(first.journal.receipts).toHaveLength(1);
    expect(data.ballPocket.quantities['poke-ball']).toBe(2);
    // Pidgey #16 capture_rate=255, modelo de HP0: captura garantida.
    expect(kantoRegionalEncounter(1,2,100)?.speciesId).toBe(16);
    expect(data.roster).toHaveLength(2);
    expect(data.roster[1].pokemonId).toBe(16);
    expect(data.roster[1].uid).toBe(2);
    expect(data.nextUid).toBe(3);
    expect(data.seen).toContain(16);
    expect(data.caughtSpecies).toContain(16);
    expect(data.unrelated).toEqual({preserve:true});
    expect(data.coins).toBeGreaterThan(100);
    expect(source().ballPocket.quantities['poke-ball']).toBe(3);
    expect(original.revision).toBe(0);
    const replay=applyRegionalBattleDraft(first.journal,command());
    expect(replay.status).toBe('duplicate');
    expect(replay.journal).toBe(first.journal);
    expect(applyRegionalBattleDraft(first.journal,command({ballId:'ultra-ball'})).status)
      .toBe('rejected');
  });
  it('sem bola também permite vitória sem tentativa nem capture UID',()=>{
    const {ballId:_unusedBall,...withoutBall}=command();
    const result=applyRegionalBattleDraft(fixture(),withoutBall);
    expect(result.status).toBe('applied');
    if(result.status==='applied'){
      const data=JSON.parse(result.journal.raw);
      expect(data.ballPocket.quantities['poke-ball']).toBe(3);
      expect(data.roster).toHaveLength(1);
      expect(data.seen).toContain(16);
    }
  });
  it('Mewtwo só pode ter tentativa com Ultra Ball, consumo mesmo se falhar',()=>{
    const seed=1680; // 7 comuns×240 = 1680; primeiro raro é #150
    expect(kantoRegionalEncounter(10,seed,100)?.speciesId).toBe(150);
    const invalid=applyRegionalBattleDraft(fixture(),command({
      regionId:10,seed,ballId:'poke-ball'
    }));
    expect(invalid.status).toBe('rejected');
    const valid=applyRegionalBattleDraft(fixture(),command({
      regionId:10,seed,ballId:'ultra-ball'
    }));
    expect(valid.status).toBe('applied');
    if(valid.status==='applied'){
      const data=JSON.parse(valid.journal.raw);
      expect(data.ballPocket.quantities['ultra-ball']).toBe(1);
      expect(data.seen).toContain(150);
    }
  });
  it('perda com bola pré-selecionada não gasta nada e não gera captura',()=>{
    const {affinityGain:_unusedGain,...lossCommand}=command();
    const result=applyRegionalBattleDraft(fixture(),{
      ...lossCommand,outcome:'loss',ballId:'ultra-ball'
    });
    expect(result.status).toBe('applied');
    if(result.status==='applied'){
      const data=JSON.parse(result.journal.raw);
      expect(data.ballPocket.quantities['ultra-ball']).toBe(2);
      expect(data.wins).toBe(0);
      expect(data.losses).toBe(1);
      expect(data.roster).toHaveLength(1);
    }
  });
  it('recusa region lock, bolso ausente, revisão velha, UID e resultado impróprio',()=>{
    const old={...source(),trainer:{level:1,xp:0,manual:{}}};
    expect(applyRegionalBattleDraft(fixture(old),command({regionId:10})).status)
      .toBe('rejected');
    const noPocket={...source(),ballPocket:undefined};
    expect(applyRegionalBattleDraft(fixture(noPocket),command()).status)
      .toBe('rejected');
    expect(applyRegionalBattleDraft(fixture(),command({expectedRevision:2})).status)
      .toBe('rejected');
    expect(applyRegionalBattleDraft(fixture(),command({activeUid:99})).status)
      .toBe('rejected');
    expect(applyRegionalBattleDraft(fixture(),command({outcome:'loss',affinityGain:3})).status)
      .toBe('rejected');
    expect(applyRegionalBattleDraft(fixture(),command({outcome:'win',affinityGain:9})).status)
      .toBe('rejected');
  });
});
