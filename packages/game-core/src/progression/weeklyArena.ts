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
/** The weekly reward watermark and current run are distinct. A run may replay
 * paid floors, but only a new weekly record is eligible for ANY reward. */
export interface ArenaRun {
 readonly id:string;
 readonly team:readonly number[];
 readonly cleared:number;
}
export interface ArenaWeeklyProgress {
 readonly weekStartMs:number;
 readonly paidThrough:number;
 readonly run:ArenaRun|null;
}
const validTeam=(team:unknown):team is readonly number[]=>Array.isArray(team)&&team.length===3&&
 team.every(uid=>Number.isSafeInteger(uid)&&uid>0)&&new Set(team).size===3;
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,96}$/.test(id);
function validProgress(prior:ArenaWeeklyProgress,weekStartMs:number){
 if(!prior||typeof prior!=='object'||arenaWeek(prior.weekStartMs)?.startMs!==prior.weekStartMs||
    prior.weekStartMs>weekStartMs||arenaEarnedPoints(prior.paidThrough)===null)return false;
 const run=prior.run;
 return run===null||!!run&&validId(run.id)&&validTeam(run.team)&&
  arenaEarnedPoints(run.cleared)!==null&&run.cleared<ARENA_FLOORS&&
  run.cleared<=prior.paidThrough&&prior.paidThrough<ARENA_FLOORS;
}
export function arenaWeeklyProjection(nowMs:number,prior:ArenaWeeklyProgress|null){
 const week=arenaWeek(nowMs);if(!week)return null;
 if(prior!==null&&!validProgress(prior,week.startMs))return null;
 const current=prior?.weekStartMs===week.startMs?prior:null;
 const paidThrough=current?.paidThrough??0,run=current?.run??null;
 return {...week,paidThrough,run,nextFloor:run?run.cleared+1:null,
  earned:arenaEarnedPoints(paidThrough)!,cap:ARENA_WEEKLY_POINTS_CAP,
  complete:paidThrough===ARENA_FLOORS};
}
/** Team and run ID must come from the authoritative save/server respectively.
 * A fresh run always starts at floor 1. An active run must be ended first. */
export function startArenaRun(nowMs:number,prior:ArenaWeeklyProgress|null,id:string,team:readonly number[]){
 const view=arenaWeeklyProjection(nowMs,prior);
 if(!view||!validId(id)||!validTeam(team))return {status:'invalid'} as const;
 if(view.complete)return {status:'weekly-complete'} as const;
 if(view.run)return {status:'run-active'} as const;
 const next:ArenaWeeklyProgress={weekStartMs:view.startMs,paidThrough:view.paidThrough,
  run:{id,team:[...team],cleared:0}};
 return {status:'ok',next} as const;
}
export function abandonArenaRun(nowMs:number,prior:ArenaWeeklyProgress|null,runId:string){
 const view=arenaWeeklyProjection(nowMs,prior);
 if(!view)return {status:'invalid'} as const;
 if(!view.run||view.run.id!==runId)return {status:'stale-run'} as const;
 const next:ArenaWeeklyProgress={weekStartMs:view.startMs,paidThrough:view.paidThrough,run:null};
 return {status:'ok',next} as const;
}
/** Preview only: no client-selected opponent, no outside-team UID or skipped
 * floor. The future writer must enforce the real save and run identity. */
export function quoteArenaFloor(nowMs:number,prior:ArenaWeeklyProgress|null,weekStartMs:number,runId:string,floor:number,uid:number){
 const view=arenaWeeklyProjection(nowMs,prior);
 if(!view||arenaFloorPoints(floor)===null||!Number.isSafeInteger(uid)||uid<=0)return {status:'invalid'} as const;
 if(weekStartMs!==view.startMs)return {status:'stale-week'} as const;
 if(!view.run||view.run.id!==runId)return {status:'stale-run'} as const;
 if(floor!==view.nextFloor)return {status:'locked-floor'} as const;
 if(!view.run.team.includes(uid))return {status:'outside-team'} as const;
 const firstClear=floor>view.paidThrough;
 return {status:'ok',floor,uid,firstClear,points:firstClear?arenaFloorPoints(floor)!:0} as const;
}
/** PRIVATE pure transition, not an HTTP command. Outcome must be derived from
 * a certified server battle and committed with XP, gold, points and receipt
 * under one lock. Loss/draw end the attempt; no rewards on a replayed floor. */
export function settleCertifiedArenaFloor(nowMs:number,prior:ArenaWeeklyProgress|null,weekStartMs:number,runId:string,floor:number,uid:number,outcome:'win'|'loss'|'draw'){
 const q=quoteArenaFloor(nowMs,prior,weekStartMs,runId,floor,uid);
 if(q.status!=='ok')return q;
 if(!['win','loss','draw'].includes(outcome))return {status:'invalid'} as const;
 const view=arenaWeeklyProjection(nowMs,prior)!;
 const won=outcome==='win',rewardEligible=won&&q.firstClear;
 const paidThrough=rewardEligible?floor:view.paidThrough;
 const run=won&&floor<ARENA_FLOORS?{...view.run!,cleared:floor}:null;
 const next:ArenaWeeklyProgress={weekStartMs:view.startMs,paidThrough,run};
 return {status:'ok',outcome,floor,rewardEligible,points:rewardEligible?q.points:0,
  earned:arenaEarnedPoints(paidThrough)!,next} as const;
}
