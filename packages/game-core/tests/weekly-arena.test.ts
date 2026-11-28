import {describe,it,expect} from 'vitest';
import {arenaWeek,arenaFloorPoints,arenaEarnedPoints,arenaWeeklyProjection,quoteArenaFloor,startArenaRun,abandonArenaRun,settleCertifiedArenaFloor,ARENA_WEEK_MS,ARENA_WEEKLY_POINTS_CAP} from '../src/progression/weeklyArena.js';
import type {ArenaWeeklyProgress} from '../src/progression/weeklyArena.js';
const monday=Date.UTC(2026,10,23,3),next=monday+ARENA_WEEK_MS;
const team=[11,22,33] as const;
const start=(prior:ArenaWeeklyProgress|null,id:string,ids:readonly number[]=team,now=monday)=>{
 const q=startArenaRun(now,prior,id,ids);if(q.status!=='ok')throw Error(q.status);return q.next;
};
const settle=(prior:ArenaWeeklyProgress,id:string,floor:number,outcome:'win'|'loss'|'draw'='win',uid=team[(floor-1)%3]! as number,now=monday)=>{
 const q=settleCertifiedArenaFloor(now,prior,prior.weekStartMs,id,floor,uid,outcome);
 if(q.status!=='ok')throw Error(q.status);return q;
};
describe('ARENA01B: weekly rewards independent of fixed-team runs',()=>{
 it('resets only Monday 00:00 Brasília',()=>{
  expect(arenaWeek(monday-1)).toEqual({startMs:monday-ARENA_WEEK_MS,endMs:monday});
  expect(arenaWeek(monday)).toEqual({startMs:monday,endMs:next});
  expect(arenaWeek(next-1)?.startMs).toBe(monday);
  expect(arenaWeek(next)?.startMs).toBe(next);
  for(const invalid of [NaN,Infinity,-1,monday+.5,Number.MAX_SAFE_INTEGER])expect(arenaWeek(invalid)).toBeNull();
 });
 it('owner example: lose at 11, restart at 1, replay 10 unpaid, lose at 16, restart again and cap at 100',()=>{
  let p=start(null,'run1'),total=0;
  for(let floor=1;floor<=10;floor++){
   const q=settle(p,'run1',floor);p=q.next;total+=q.points;expect(q.rewardEligible).toBe(true);
  }
  const loss=settle(p,'run1',11,'loss');p=loss.next;
  expect(loss).toMatchObject({points:0,rewardEligible:false,next:{paidThrough:10,run:null}});
  p=start(p,'run2');
  expect(arenaWeeklyProjection(monday,p)).toMatchObject({paidThrough:10,nextFloor:1,earned:10});
  for(let floor=1;floor<=15;floor++){
   const q=settle(p,'run2',floor);p=q.next;total+=q.points;
   expect(q.rewardEligible).toBe(floor>10);
   if(floor<=10)expect(q.points).toBe(0);
  }
  p=settle(p,'run2',16,'loss').next;
  expect(p.paidThrough).toBe(15);
  p=start(p,'run3');
  for(let floor=1;floor<=40;floor++){
   const q=settle(p,'run3',floor);p=q.next;total+=q.points;
   expect(q.rewardEligible).toBe(floor>15);
  }
  expect(total).toBe(ARENA_WEEKLY_POINTS_CAP);
  expect(arenaWeeklyProjection(monday,p)).toMatchObject({paidThrough:40,nextFloor:null,earned:100,complete:true,run:null});
  expect(startArenaRun(monday,p,'run4',team).status).toBe('weekly-complete');
  const fresh=start(p,'run5',team,next);
  expect(arenaWeeklyProjection(next,fresh)).toMatchObject({paidThrough:0,nextFloor:1,earned:0,complete:false});
  expect(quoteArenaFloor(next,fresh,monday,'run5',1,11).status).toBe('stale-week');
 });
 it('requires exactly three unique UIDs, no outside member or replacement during a run',()=>{
  for(const invalid of [[],[1],[1,2],[1,2,2],[1,2,3,4],[1,2,0],[1,2,1.5]])expect(startArenaRun(monday,null,'run',invalid).status).toBe('invalid');
  const ids=[1,2,3],p=start(null,'run',ids);
  ids[0]=99;
  expect(p.run?.team).toEqual([1,2,3]);
  expect(startArenaRun(monday,p,'other',[4,5,6]).status).toBe('run-active');
  expect(quoteArenaFloor(monday,p,monday,'run',1,99).status).toBe('outside-team');
  expect(quoteArenaFloor(monday,p,monday,'run',2,1).status).toBe('locked-floor');
  const q=settle(p,'run',1,'win',2);
  expect(quoteArenaFloor(monday,q.next,monday,'run',1,2).status).toBe('locked-floor');
  const stopped=abandonArenaRun(monday,q.next,'run');
  if(stopped.status!=='ok')throw Error(stopped.status);
  const restarted=start(stopped.next,'new',[4,5,6]);
  expect(quoteArenaFloor(monday,restarted,monday,'run',1,1).status).toBe('stale-run');
  expect(quoteArenaFloor(monday,restarted,monday,'new',1,4)).toMatchObject({status:'ok',firstClear:false,points:0});
  expect(settle(restarted,'new',1,'draw',4)).toMatchObject({points:0,rewardEligible:false,next:{run:null,paidThrough:1}});
 });
 it('rejects invalid or future weekly state and never pays an expired run',()=>{
  expect(arenaWeeklyProjection(monday,{weekStartMs:next,paidThrough:0,run:null})).toBeNull();
  expect(arenaWeeklyProjection(monday,{weekStartMs:monday+1,paidThrough:0,run:null})).toBeNull();
  expect(arenaWeeklyProjection(monday,{weekStartMs:monday,paidThrough:41,run:null})).toBeNull();
  expect(arenaWeeklyProjection(monday,{weekStartMs:monday,paidThrough:1,run:{id:'run',team,cleared:2}})).toBeNull();
  const p=start(null,'run');
  expect(quoteArenaFloor(next,p,monday,'run',1,11).status).toBe('stale-week');
  expect(arenaEarnedPoints(40)).toBe(100);
  expect([1,10,11,20,21,30,31,40].map(arenaFloorPoints)).toEqual([1,1,2,2,3,3,4,4]);
 });
});
