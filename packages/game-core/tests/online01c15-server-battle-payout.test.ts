import {describe,it,expect} from 'vitest';
import {applyFrozenBattleRewardQuote,quoteFrozenBattleRewards,previewFrozenWildBattle}
  from '../src/index.js';
const zero=()=>({hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0});
const source=()=>({
 version:1,mode:'normal',trainer:{level:1,xp:0,manual:zero()},
 coins:0,wins:0,losses:0,roster:[{
  uid:1,pokemonId:4,level:1,xp:0,affinity:0,manual:zero(),
  battleRecord:{wins:0,draws:0,losses:0}
 }],team:[1],regionWins:Array(10).fill(0),
 ballPocket:{version:1,quantities:{'poke-ball':12}},badges:[]
});
const snap=(affinity=0)=>({
 version:1 as const,regionId:1 as const,
 trainer:{equipped:{},title:'aprendiz',wins:0,seen:[4],badges:[],inventory:{version:1 as const,gear:[],extraBagSlots:0},level:1,manual:zero()},
 activePokemon:{uid:1,speciesId:4,level:1,affinity,manual:zero(),moveName:'scratch'},
 opponent:{speciesId:10,level:2}
});
const preview=(outcome:'win'|'loss'|'draw')=>({
 outcome,turns:3,playerRemainingHp:1,wildRemainingHp:1,
 log:['test'],frames:[{kind:'info'}]
});
describe('ONLINE-01C-15 — canonical payout candidate',()=>{
 it('credits a win using the canonical XP curve and protects items/badges',()=>{
  const s=snap(),q=quoteFrozenBattleRewards(s,preview('win'),2)!;
  const r=applyFrozenBattleRewardQuote(JSON.stringify(source()),s,preview('win'),q)!;
  const state=JSON.parse(r.raw);
  expect([state.coins,state.wins,state.losses,state.draws]).toEqual([31,1,0,0]);
  expect([state.trainer.level,state.trainer.xp]).toEqual([1,56]);
  expect([state.roster[0].level,state.roster[0].xp]).toEqual([1,32]);
  expect(state.roster[0].affinity).toBe(4);
  expect(state.roster[0].battleRecord).toEqual({wins:1,draws:0,losses:0});
  expect(state.regionWins[0]).toBe(1);
  expect(state.ballPocket.quantities['poke-ball']).toBe(12);
  expect(state.badges).toEqual([]);
  expect(r.paid).toMatchObject({coins:31,trainerXp:56,pokemonXp:32,affinityDelta:4});
 });
 it('credits half XP on defeat without coins or drops',()=>{
  const s=snap();
  const q=quoteFrozenBattleRewards(s,preview('loss'),0)!;
  const r=applyFrozenBattleRewardQuote(JSON.stringify(source()),s,preview('loss'),q)!;
  const state=JSON.parse(r.raw);
  expect([state.roster[0].xp,state.coins,state.losses]).toEqual([16,0,1]);
  expect(state.trainer.xp).toBe(28);
  expect(state.ballPocket.quantities['poke-ball']).toBe(12);
  expect(state.roster[0].battleRecord.losses).toBe(1);
  expect(state.roster[0].affinity).toBe(0);
 });
 it('rejects forged quotes, stale affinity or party, malformed state and overspend',()=>{
  const s=snap();
  const q=quoteFrozenBattleRewards(s,preview('win'),0)!;
  const orig=source();
  const raw=JSON.stringify(orig);
  expect(applyFrozenBattleRewardQuote(raw,s,preview('win'),{...q,coins:999})).toBeNull();
  expect(applyFrozenBattleRewardQuote(raw,s,preview('win'),{...q,freeBalls:99})).toBeNull();
  expect(applyFrozenBattleRewardQuote(raw,s,preview('loss'),q)).toBeNull();
  expect(applyFrozenBattleRewardQuote(JSON.stringify({...orig,team:[55]}),
    s,preview('win'),q)).toBeNull();
  expect(applyFrozenBattleRewardQuote(JSON.stringify({...orig,coins:Number.MAX_SAFE_INTEGER}),
    s,preview('win'),q)).toBeNull();
  const tampered=JSON.parse(JSON.stringify(orig));
  tampered.roster[0].affinity=20;
  expect(applyFrozenBattleRewardQuote(JSON.stringify(tampered),
    s,preview('win'),q)).toBeNull();
  const realPreview=previewFrozenWildBattle(s,7654)!;
  const realQuote=quoteFrozenBattleRewards(s,realPreview,2)!;
  expect(applyFrozenBattleRewardQuote(raw,s,realPreview,realQuote)).not.toBeNull();
 });
});
