import {describe,it,expect} from 'vitest';
import {prepareArenaFloorBattle,resolveArenaFloorBattle,resolvePreparedArenaDuel} from '../src/combat/serverArenaBattle.js';
import {weeklyArenaRotation} from '../src/progression/weeklyArenaRotation.js';
import {ARENA_WEEK_MS,startArenaRun} from '../src/progression/weeklyArena.js';
import type {ArenaWeeklyProgress} from '../src/progression/weeklyArena.js';
import {gymLegalTurnActions} from '../src/gyms/gymTurn.js';
import {zeroStats} from '../src/stats/types.js';

const monday=Date.UTC(2026,10,23,3),id='run-1';
const make=(level=100,trained=false)=>({
 version:1,mode:'normal',trainer:{level:100,xp:0,manual:zeroStats(),equipped:{},title:'aprendiz'},
 inventory:{version:1,gear:[],extraBagSlots:0},seen:[4,5,6],badges:[],coins:100,wins:0,losses:0,
 roster:[1,2,3,4].map(uid=>({uid,pokemonId:level<36?4:6,level,xp:0,affinity:100,
 manual:trained?{...zeroStats(),specialAttack:level-1,speed:level-1}:zeroStats(),
 moveName:trained?'ember':'scratch'})),team:[1,2,3],nextUid:5,expedition:null,
 research:{points:{},favorites:[],totalSent:0,history:[]}});
const progress=(floor:number):ArenaWeeklyProgress=>({weekStartMs:monday,paidThrough:floor-1,run:{id,team:[1,2,3],cleared:floor-1}});
const seed=(turn:number)=>Math.imul(turn,2654435761)>>>0;
describe('ARENA02B private canonical duel',()=>{
 it('only accepts the frozen trio, matches the weekly preview and disables all switching',()=>{
  const s=make(),raw=JSON.stringify(s),started=startArenaRun(monday,null,id,s.team);
  if(started.status!=='ok')throw Error(started.status);
  const p=prepareArenaFloorBattle(raw,monday,started.next,monday,id,1,2);
  if(p.status!=='ok')throw Error(p.status);
  const preview=weeklyArenaRotation(monday)?.opponents[0];
  expect(p.opponent).toEqual(preview);
  expect(p.battle.player.fighters[0].uid).toBe(2);
  expect(p.battle.leader.fighters[0].combatant.speciesId).toBe(preview?.speciesId);
  for(const side of ['player','leader'] as const){
   const party=p.battle[side];
   expect(party.fighters.slice(1).map(f=>f.hp)).toEqual([0,0]);
   expect(party.fighters[0].hp).toBe(party.fighters[0].combatant.stats.hp);
   expect(party.fighters[0].sp).toBe(party.fighters[0].maxSp);
   expect(gymLegalTurnActions(p.battle,side).some(a=>a.kind==='switch')).toBe(false);
  }
  expect(prepareArenaFloorBattle(raw,monday,started.next,monday,id,1,4).status).toBe('outside-team');
  expect(prepareArenaFloorBattle(raw,monday,started.next,monday,id,2,1).status).toBe('locked-floor');
  expect(prepareArenaFloorBattle(raw,monday+ARENA_WEEK_MS,started.next,monday,id,1,1).status).toBe('stale-week');
  expect(prepareArenaFloorBattle(JSON.stringify({...s,team:[1,2,4]}),monday,started.next,monday,id,1,1).status).toBe('invalid-team');
  expect(prepareArenaFloorBattle(JSON.stringify({...s,roster:s.roster.filter(p=>p.uid!==3)}),monday,started.next,monday,id,1,1).status).toBe('invalid-team');
 });
 it('replays actual canonical turns without mutating the save or granting rewards',()=>{
  const s=make(),raw=JSON.stringify(s),prior=progress(1);
  const a=resolveArenaFloorBattle(raw,monday,prior,monday,id,1,1,seed);
  const b=resolveArenaFloorBattle(raw,monday,prior,monday,id,1,1,seed);
  expect(a).toEqual(b);
  if(a.status!=='ok')throw Error(a.status);
  expect(a.outcome).toBe('win');
  expect(a.turns).toBeGreaterThan(0);
  expect(a.log).toHaveLength(a.frames.length);
  expect(a.log.every(line=>/^T\d+ /.test(line))).toBe(true);
  expect(a).not.toHaveProperty('points');
  expect(JSON.stringify(s)).toBe(raw);
  expect(resolveArenaFloorBattle(raw,monday,prior,monday,id,1,1,()=>-1).status).toBe('invalid-seed');
 });
 it('samples each guardian with legal untrained and trained builds, using the real engine',()=>{
  for(const [floor,level] of [[10,25],[20,50],[30,75],[40,100]] as const){
   const weak=prepareArenaFloorBattle(JSON.stringify(make(level,false)),monday,progress(floor),monday,id,floor,1);
   const trained=prepareArenaFloorBattle(JSON.stringify(make(level,true)),monday,progress(floor),monday,id,floor,1);
   if(weak.status!=='ok'||trained.status!=='ok')throw Error('floor '+floor+': '+weak.status+'/'+trained.status);
   expect(weak.opponent.guardian).toBe(true);
   expect(weak.opponent).toEqual(trained.opponent);
   expect(trained.battle.player.fighters[0].combatant.stats.speed).toBeGreaterThan(weak.battle.player.fighters[0].combatant.stats.speed);
   for(const p of [weak,trained]){
    const outcomes={win:0,loss:0,draw:0};
    for(let i=1;i<=8;i++){
     const result=resolvePreparedArenaDuel(p.battle,turn=>Math.imul(turn+i*127,2654435761)>>>0);
     if(result.status!=='ok')throw Error('floor '+floor+': '+result.status);
     outcomes[result.outcome]++;
     expect(result.turns).toBeGreaterThan(0);
    }
    expect(outcomes.win+outcomes.loss+outcomes.draw).toBe(8);
   }
  }
 });
});
