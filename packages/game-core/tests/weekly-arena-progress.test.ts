import {describe,it,expect} from 'vitest';
import {onlineArenaProgress,startOnlineArenaRun,abandonOnlineArenaRun,applyCertifiedOnlineArenaResult,arenaFirstClearRewards} from '../src/progression/serverArenaProgress.js';
import {ARENA_WEEK_MS} from '../src/progression/weeklyArena.js';
import {zeroStats} from '../src/stats/types.js';
const monday=Date.UTC(2026,10,23,3);
const fixture=(level=5)=>JSON.stringify({version:1,mode:'normal',trainer:{level:5,xp:0,manual:zeroStats(),equipped:{},title:'aprendiz'},
 inventory:{version:1,gear:[],extraBagSlots:0},seen:[4],badges:[],coins:100,wins:0,losses:0,
 roster:[1,2,3,4].map(uid=>({uid,pokemonId:4,level,xp:0,affinity:0,manual:zeroStats(),moveName:'scratch'})),
 team:[1,2,3],nextUid:5,expedition:null,research:{points:{},favorites:[],totalSent:0,history:[]}});
function ok<T extends {status:string}>(v:T):Extract<T,{status:'ok'}>{
 if(v.status!=='ok')throw Error(v.status);
 return v as Extract<T,{status:'ok'}>;
}
describe('ARENA03A private weekly wallet and first-clear progression',()=>{
 it('credits the selected UID, trainer and coins only once, even when mandatory floors replay',()=>{
  const raw=fixture(),a=ok(startOnlineArenaRun(raw,monday,'run-1'));
  const b=ok(applyCertifiedOnlineArenaResult(a.raw,monday,monday,'run-1',1,2,'win'));
  expect(b.balance).toBe(1);expect(b.reward).toEqual(arenaFirstClearRewards(5,5));
  const before=JSON.parse(raw),after=JSON.parse(b.raw);
  expect(after.coins).toBe(before.coins+b.reward.coins);
  expect(after.roster[0]).toEqual(before.roster[0]);
  expect(after.roster[1]).not.toEqual(before.roster[1]);
  expect(after.roster[2]).toEqual(before.roster[2]);
  expect(after.roster[1].affinity).toBe(0);expect(after.wins).toBe(0);
  expect(applyCertifiedOnlineArenaResult(b.raw,monday,monday,'run-1',1,2,'win').status).toBe('locked-floor');
  const c=ok(applyCertifiedOnlineArenaResult(b.raw,monday,monday,'run-1',2,2,'loss'));
  expect(c.balance).toBe(1);expect(c.progress.run).toBeNull();
  const d=ok(startOnlineArenaRun(c.raw,monday,'run-2'));
  const e=ok(applyCertifiedOnlineArenaResult(d.raw,monday,monday,'run-2',1,3,'win'));
  expect(e.balance).toBe(1);expect(e.rewardEligible).toBe(false);
  expect(e.reward).toEqual({coins:0,trainerXp:0,pokemonXp:0});
  expect(JSON.parse(e.raw).roster).toEqual(after.roster);
  expect(JSON.parse(e.raw).trainer).toEqual(after.trainer);
  expect(JSON.parse(e.raw).coins).toBe(after.coins);
 });
 it('retains accumulated points through reset; old run cannot claim in new week',()=>{
  const a=ok(startOnlineArenaRun(fixture(100),monday,'run-1'));
  const b=ok(applyCertifiedOnlineArenaResult(a.raw,monday,monday,'run-1',1,1,'win'));
  expect(b.balance).toBe(1);expect(b.reward).toEqual({coins:0,trainerXp:0,pokemonXp:0});
  const nextWeek=monday+ARENA_WEEK_MS;
  expect(onlineArenaProgress(b.raw,nextWeek)).toMatchObject({balance:1,earned:0,paidThrough:0,run:null});
  expect(applyCertifiedOnlineArenaResult(b.raw,nextWeek,monday,'run-1',2,1,'win').status).toBe('stale-week');
  const c=ok(startOnlineArenaRun(b.raw,nextWeek,'run-2'));
  const d=ok(applyCertifiedOnlineArenaResult(c.raw,nextWeek,nextWeek,'run-2',1,1,'win'));
  expect(d.balance).toBe(2);expect(d.points).toBe(1);
  expect(ok(abandonOnlineArenaRun(d.raw,nextWeek,'run-2')).progress.run).toBeNull();
 });
 it('rejects busy activity, invalid ledger, altered team and wallet overflow',()=>{
  const raw=fixture(),s=JSON.parse(raw);
  expect(startOnlineArenaRun(JSON.stringify({...s,expedition:{startedAt:1,lastClaimAt:1,teamUids:[1]}}),monday,'run').status).toBe('busy');
  expect(onlineArenaProgress(JSON.stringify({...s,weeklyArena:{version:1,balance:-1,progress:{}}}),monday)).toBeNull();
  const a=ok(startOnlineArenaRun(raw,monday,'run'));
  const state=JSON.parse(a.raw);
  expect(applyCertifiedOnlineArenaResult(JSON.stringify({...state,team:[1,2,4]}),monday,monday,'run',1,1,'win').status).toBe('invalid-team');
  expect(applyCertifiedOnlineArenaResult(a.raw,monday,monday,'run',1,4,'win').status).toBe('outside-team');
  state.weeklyArena.balance=Number.MAX_SAFE_INTEGER;
  expect(applyCertifiedOnlineArenaResult(JSON.stringify(state),monday,monday,'run',1,1,'win').status).toBe('overflow');
 });
});
