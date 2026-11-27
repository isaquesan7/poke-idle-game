/** ARENA01 candidate: pure weekly calendar and capped sequential rewards.
 * No clock read, persistence, battle, public writer or item grant. Caller must
 * obtain time from the trusted server/database and certify a real victory.
 * Brasília UTC-03:00 fixed game calendar, Monday 00:00 = 03:00 UTC.
 */
export const ARENA_FLOORS=40;
export const ARENA_WEEK_MS=7*24*60*60*1000;
const MONDAY_ANCHOR=Date.UTC(1970,0,5,3);
export const ARENA_WEEKLY_POINTS_CAP=100;
export function arenaWeek(nowMs:number){
 if(!Number.isSafeInteger(nowMs)||nowMs<MONDAY_ANCHOR||nowMs>8.64e15-ARENA_WEEK_MS)return null;
 const startMs=MONDAY_ANCHOR+Math.floor((nowMs-MONDAY_ANCHOR)/ARENA_WEEK_MS)*ARENA_WEEK_MS;
 return {startMs,endMs:startMs+ARENA_WEEK_MS};
}
export function arenaFloorPoints(floor:number):number|null{
 return Number.isSafeInteger(floor)&&floor>=1&&floor<=ARENA_FLOORS?Math.ceil(floor/10):null;
}
export function arenaEarnedPoints(cleared:number):number|null{
 if(!Number.isSafeInteger(cleared)||cleared<0||cleared>ARENA_FLOORS)return null;
 let sum=0;for(let i=1;i<=cleared;i++)sum+=arenaFloorPoints(i)!;
 return sum;
}
export interface ArenaWeeklyProgress{readonly weekStartMs:number;readonly cleared:number}
export function arenaWeeklyProjection(nowMs:number,prior:ArenaWeeklyProgress|null){
 const week=arenaWeek(nowMs);if(!week)return null;
 if(prior!==null){
  if(!prior||typeof prior!=='object'||arenaWeek(prior.weekStartMs)?.startMs!==prior.weekStartMs||
    prior.weekStartMs>week.startMs||arenaEarnedPoints(prior.cleared)===null)return null;
 }
 const cleared=prior?.weekStartMs===week.startMs?prior.cleared:0;
 return {...week,cleared,nextFloor:cleared===ARENA_FLOORS?null:cleared+1,
  earned:arenaEarnedPoints(cleared)!,cap:ARENA_WEEKLY_POINTS_CAP};
}
/** Preview only, never certifies a result or modifies a wallet. No skipping,
 * duplicate floor or old-week payout. The writer must atomically verify a
 * certified result and this quote under lock. */
export function quoteArenaFloor(nowMs:number,prior:ArenaWeeklyProgress|null,weekStartMs:number,floor:number){
 const view=arenaWeeklyProjection(nowMs,prior);
 if(!view||arenaFloorPoints(floor)===null)return {status:'invalid'} as const;
 if(weekStartMs!==view.startMs)return {status:'stale-week'} as const;
 if(floor<=view.cleared)return {status:'already-cleared'} as const;
 if(floor!==view.nextFloor)return {status:'locked-floor'} as const;
 const points=arenaFloorPoints(floor)!;
 return {status:'ok',floor,points,earned:view.earned+points,
  next:{weekStartMs:view.startMs,cleared:floor}} as const;
}
