import {describe,it,expect} from 'vitest';
import {
  prepareRewardJournal,applyRegionalBattleDraft,
  d064DraftBattleReward,d064DraftGrantXp,kantoRegionalEncounter
} from '../src/index.js';

const original=()=>({
  version:1,name:'D064 XP',mode:'normal',coins:30,wins:0,losses:0,
  trainer:{level:1,xp:0,manual:{}},
  roster:[{uid:1,pokemonId:4,level:5,xp:0,affinity:1,manual:{},moveName:'scratch',upgrades:{}}],
  team:[1],nextUid:2,badges:[],seen:[4],caughtSpecies:[4],
  expedition:null,lastClaim:null,ballPocket:{version:1,quantities:{'poke-ball':2}}
});
const command=()=>({
  id:'xp-battle-1',expectedRevision:0,regionId:1,seed:2,activeUid:1,
  outcome:'win' as const,affinityGain:3
});
function fixture(data:Record<string,unknown>=original()){
  const journal=prepareRewardJournal(JSON.stringify(data));
  if(!journal)throw Error('Fixture inválida');
  return journal;
}
describe('D-064O — nova economia por região (somente journal de teste)',()=>{
  it('recompensa usa a curva D-064 e não XP/moedas legados',()=>{
    const previous=fixture();
    const event=applyRegionalBattleDraft(previous,command());
    expect(event.status).toBe('applied');
    if(event.status!=='applied')return;
    const wild=kantoRegionalEncounter(1,2,5)!;
    const reward=d064DraftBattleReward(wild.level)!;
    const game=JSON.parse(event.journal.raw);
    expect(game.coins).toBe(30+reward.coins);
    expect(game.trainer.level).toBe(1);
    expect(game.trainer.xp).toBe(reward.trainerXp);
    expect(game.roster[0].level).toBe(5);
    expect(game.roster[0].xp).toBe(reward.pokemonXp);
    expect(game.wins).toBe(1);
    expect(game.caughtSpecies).toEqual([4]);
    expect(game.ballPocket.quantities['poke-ball']).toBe(2);
    expect(previous.raw).toContain('"coins":30');
    expect(applyRegionalBattleDraft(event.journal,command()).status).toBe('duplicate');
    expect(applyRegionalBattleDraft(event.journal,{...command(),seed:3}).status).toBe('rejected');
  });
  it('XP de níveis altos mantém teto 100 e saldo seguro',()=>{
    expect(d064DraftGrantXp('trainer',{level:100,xp:0},500000))
      .toEqual({level:100,xp:0});
    expect(d064DraftGrantXp('pokemon',{level:99,xp:0},500000))
      .toEqual({level:100,xp:0});
    expect(d064DraftGrantXp('pokemon',{level:0,xp:0},10)).toBeNull();
    expect(d064DraftGrantXp('trainer',{level:1,xp:132},0)).toBeNull();
  });
  it('rejeita XP herdado incompatível sem migrar silenciosamente',()=>{
    const bad=original();
    bad.trainer.xp=150;
    const journal=fixture(bad);
    const result=applyRegionalBattleDraft(journal,command());
    expect(result.status).toBe('rejected');
    expect(result.journal).toBe(journal);
  });
  it('derrota não altera moedas, nível, XP ou mochila',()=>{
    const previous=fixture();
    const {affinityGain:_ignored,...base}=command();
    const event=applyRegionalBattleDraft(previous,{...base,outcome:'loss',ballId:'poke-ball'});
    expect(event.status).toBe('applied');
    if(event.status!=='applied')return;
    const game=JSON.parse(event.journal.raw);
    expect(game.coins).toBe(30);
    expect(game.trainer.xp).toBe(0);
    expect(game.roster[0].xp).toBe(0);
    expect(game.ballPocket.quantities['poke-ball']).toBe(2);
  });
});
