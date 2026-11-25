import {describe,it,expect} from 'vitest';
import {
  d064BattleBallDropFromRoll,d064BattleBallDropRates,d064DraftBallDrop,
  quoteFrozenBattleRewards,applyFrozenBattleRewardQuote
} from '../src/index.js';

const blank=()=>({hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0});
const snapshot=(level=1)=>({
  version:1 as const,regionId:1 as const,
  trainer:{equipped:{},title:'aprendiz',wins:0,seen:[4],badges:[],inventory:{version:1 as const,gear:[],extraBagSlots:0},level:1,manual:blank()},
  activePokemon:{uid:1,speciesId:4,level,affinity:0,manual:blank(),moveName:'scratch'},
  opponent:{speciesId:10,level:2}
});
const preview=(outcome:'win'|'loss'|'draw')=>({
  outcome,turns:3,playerRemainingHp:1,wildRemainingHp:outcome==='win'?0:3,
  log:['battle'],frames:[{kind:'info'}]
});
const raw=()=>({
  version:1,mode:'normal',
  trainer:{level:1,xp:0,manual:blank()},
  roster:[{uid:1,pokemonId:4,level:1,xp:0,affinity:0,
    manual:blank(),battleRecord:{wins:0,draws:0,losses:0}}],
  team:[1],coins:0,wins:0,losses:0,
  regionWins:Array(10).fill(0),
  ballPocket:{version:1,quantities:{'poke-ball':12}},
  badges:[],nextUid:2
});
describe('ONLINE-01C-17 — regional victory drops, canonical thresholds',()=>{
  it('exactly matches published exclusive probabilities over all 10,000 rolls',()=>{
    for(const region of [1,3,4,6,7,8,9,10]){
      const rates=d064BattleBallDropRates(region)!;
      const totals={'poke-ball':0,'great-ball':0,'ultra-ball':0};
      let noDrop=0;
      for(let roll=0;roll<10000;roll++){
        const r=d064BattleBallDropFromRoll(region,roll)!;
        expect(r['poke-ball']+r['great-ball']+r['ultra-ball']).toBeLessThanOrEqual(1);
        totals['poke-ball']+=r['poke-ball'];
        totals['great-ball']+=r['great-ball'];
        totals['ultra-ball']+=r['ultra-ball'];
        if(!Object.values(r).some(Boolean))noDrop++;
      }
      expect(totals).toEqual({
        'poke-ball':100*rates['poke-ball'],
        'great-ball':100*rates['great-ball'],
        'ultra-ball':100*rates['ultra-ball']
      });
      expect(noDrop).toBe(10000-Object.values(totals).reduce((a,b)=>a+b,0));
    }
    expect(d064BattleBallDropFromRoll(1,-1)).toBeNull();
    expect(d064BattleBallDropFromRoll(1,10000)).toBeNull();
    expect(d064BattleBallDropFromRoll(11,0)).toBeNull();
  });
  it('preserves legacy local hash interpretation without changing /play rewards',()=>{
    for(let seed=0;seed<64;seed++){
      const r=d064DraftBallDrop(1,seed,`regional-v02-${seed+1}`)!;
      expect(r['great-ball']).toBe(0);
      expect(r['ultra-ball']).toBe(0);
    }
  });
  it('only awards region 1 Poké Balls after eligible wins; no milestone grants',()=>{
    expect(quoteFrozenBattleRewards(snapshot(),preview('win'),0,0)!.ballDropId)
      .toBe('poke-ball');
    expect(quoteFrozenBattleRewards(snapshot(),preview('win'),0,2999)!.ballDropId)
      .toBe('poke-ball');
    expect(quoteFrozenBattleRewards(snapshot(),preview('win'),0,3000)!.ballDropId)
      .toBeNull();
    expect(quoteFrozenBattleRewards(snapshot(),preview('win'),0,9999)!.ballDropId)
      .toBeNull();
    expect(quoteFrozenBattleRewards(snapshot(),preview('loss'),0,0)!.ballDropId)
      .toBeNull();
    expect(quoteFrozenBattleRewards(snapshot(),preview('draw'),0,0)!.ballDropId)
      .toBeNull();
    expect(quoteFrozenBattleRewards(snapshot(14),preview('win'),0,0)!.ballDropId)
      .toBe('poke-ball');
    expect(quoteFrozenBattleRewards(snapshot(),preview('win'),0,10000)).toBeNull();
  });
  it('pays a farm-only victory: full item probability but zero XP, coins or progression',()=>{
    const s={...snapshot(80),regionId:5,trainer:{...snapshot().trainer,level:40},opponent:{speciesId:25,level:45}};
    const p=preview('win'),q=quoteFrozenBattleRewards(s,p,0,2500)!;
    expect(q).toMatchObject({coins:0,trainerXp:0,pokemonXp:0,wins:0,affinityDelta:0,ballDropId:'great-ball'});
    const state=raw();state.trainer.level=40;state.roster[0]!.level=80;
    const result=applyFrozenBattleRewardQuote(JSON.stringify(state),s,p,q)!;
    expect(result.paid).toMatchObject({coins:0,trainerXp:0,pokemonXp:0,ballDrop:{ballId:'great-ball',quantity:1}});
    const after=JSON.parse(result.raw);
    expect(after.ballPocket.quantities['great-ball']).toBe(1);
    expect(after.coins).toBe(0);expect(after.wins).toBe(0);expect(after.regionWins[4]).toBe(0);
    expect(after.trainer.level).toBe(40);expect(after.roster[0].level).toBe(80);
    expect(quoteFrozenBattleRewards(s,preview('loss'),0,2500)!.ballDropId).toBeNull();
  });
  it('credits one ball with XP/coins once; rejects forgery and supports old quotes',()=>{
    const s=snapshot(),p=preview('win'),q=quoteFrozenBattleRewards(s,p,2,0)!;
    const candidate=applyFrozenBattleRewardQuote(JSON.stringify(raw()),s,p,q)!;
    const state=JSON.parse(candidate.raw);
    expect(state.ballPocket.quantities['poke-ball']).toBe(13);
    expect(state.coins).toBe(31);
    expect(candidate.paid).toMatchObject({
      coins:31,ballDrop:{ballId:'poke-ball',quantity:1}
    });
    expect(applyFrozenBattleRewardQuote(JSON.stringify(raw()),s,p,
      {...q,ballDropId:'great-ball'})).toBeNull();
    expect(applyFrozenBattleRewardQuote(JSON.stringify(raw()),s,p,
      {...q,ballDropId:'ultra-ball'})).toBeNull();
    expect(applyFrozenBattleRewardQuote(JSON.stringify(raw()),s,p,
      {...q,ballDropId:'poke-ball',freeBalls:5})).toBeNull();
    const noDrop=quoteFrozenBattleRewards(s,p,2,9999)!;
    const legacy=Object.fromEntries(Object.entries(noDrop)
      .filter(([key])=>key!=='ballDropId'));
    const prior=applyFrozenBattleRewardQuote(JSON.stringify(raw()),s,p,legacy)!;
    expect(JSON.parse(prior.raw).ballPocket.quantities['poke-ball']).toBe(12);
    expect(prior.paid).toMatchObject({ballDrop:null});
  });
  it('caps the pocket amount at 100,000 without stopping farming at regional counter cap',()=>{
    const s=snapshot(),p=preview('win'),q=quoteFrozenBattleRewards(s,p,0,0)!;
    const full=raw();full.ballPocket.quantities['poke-ball']=100000;
    const done=applyFrozenBattleRewardQuote(JSON.stringify(full),s,p,q)!;
    expect(JSON.parse(done.raw).ballPocket.quantities['poke-ball']).toBe(100000);
    expect(done.paid).toMatchObject({ballDrop:{ballId:'poke-ball',quantity:0}});
    const capped=raw();capped.regionWins[0]=100000;
    const stillPaid=applyFrozenBattleRewardQuote(JSON.stringify(capped),s,p,q)!;
    expect(JSON.parse(stillPaid.raw).ballPocket.quantities['poke-ball']).toBe(13);
    expect(stillPaid.paid).toMatchObject({ballDrop:{ballId:'poke-ball',quantity:1}});
    expect(JSON.parse(stillPaid.raw).regionWins[0]).toBe(100000);
  });
});
