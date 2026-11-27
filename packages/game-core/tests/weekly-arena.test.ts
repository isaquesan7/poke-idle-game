import {describe,it,expect} from 'vitest';
import {arenaWeek,arenaFloorPoints,arenaEarnedPoints,arenaWeeklyProjection,quoteArenaFloor,ARENA_WEEK_MS,ARENA_WEEKLY_POINTS_CAP} from '../src/progression/weeklyArena.js';
const monday=Date.UTC(2026,10,23,3),next=monday+ARENA_WEEK_MS;
describe('ARENA01: weekly calendar and sequential currency preview',()=>{
 it('resets only at Monday 00:00 Brasília, not local browser midnight',()=>{
  expect(arenaWeek(monday-1)).toEqual({startMs:monday-ARENA_WEEK_MS,endMs:monday});
  expect(arenaWeek(monday)).toEqual({startMs:monday,endMs:next});
  expect(arenaWeek(next-1)?.startMs).toBe(monday);
  expect(arenaWeek(next)?.startMs).toBe(next);
  for(const invalid of [NaN,Infinity,-1,monday+.5,Number.MAX_SAFE_INTEGER])expect(arenaWeek(invalid)).toBeNull();
 });
 it('pays exactly 100 in a full run and never repeats a cleared floor',()=>{
  let progress:null|{weekStartMs:number;cleared:number}=null;
  let total=0;
  for(let floor=1;floor<=40;floor++){
   const q=quoteArenaFloor(monday,progress,monday,floor);
   if(q.status!=='ok')throw Error(q.status);
   total+=q.points;progress=q.next;
   expect(q.earned).toBe(total);
   expect(quoteArenaFloor(monday,progress,monday,floor).status).toBe('already-cleared');
  }
  expect(total).toBe(ARENA_WEEKLY_POINTS_CAP);
  expect(arenaEarnedPoints(40)).toBe(100);
  expect(arenaWeeklyProjection(monday,progress)?.nextFloor).toBeNull();
  expect(arenaWeeklyProjection(next,progress)).toMatchObject({cleared:0,nextFloor:1,earned:0,cap:100});
  expect(quoteArenaFloor(next,progress,monday,1).status).toBe('stale-week');
 });
 it('rejects skipped floors, bad progress and noncanonical weeks',()=>{
  expect(quoteArenaFloor(monday,null,monday,2).status).toBe('locked-floor');
  expect(quoteArenaFloor(monday,null,monday,0).status).toBe('invalid');
  expect(arenaWeeklyProjection(monday,{weekStartMs:next,cleared:0})).toBeNull();
  expect(arenaWeeklyProjection(monday,{weekStartMs:monday+1,cleared:0})).toBeNull();
  expect(arenaWeeklyProjection(monday,{weekStartMs:monday,cleared:41})).toBeNull();
  expect([1,10,11,20,21,30,31,40].map(arenaFloorPoints)).toEqual([1,1,2,2,3,3,4,4]);
 });
});
