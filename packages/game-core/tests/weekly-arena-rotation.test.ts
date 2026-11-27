import {describe,it,expect} from 'vitest';
import {weeklyArenaRotation,arenaOpponentLevel,ARENA_ROTATION_VERSION} from '../src/progression/weeklyArenaRotation.js';
import {ARENA_WEEK_MS} from '../src/progression/weeklyArena.js';
import {compatibleMachineSpecies} from '../src/catalog/kantoMachineCompatibility.js';
import {kantoMachine} from '../src/catalog/kantoMachines.js';
import {kantoCaptureStartingLevel} from '../src/catalog/kantoEvolution.js';
import {kantoSpecies} from '../src/catalog/kantoSpecies.js';
import {gymTrainedMoves} from '../src/gyms/gymTactics.js';
import {executableMachineMove} from '../src/combat/machineLessonCatalog.js';
import {legacyMoveRankLimits} from '../src/legacy/pokemonMoveReducer.js';
const monday=Date.UTC(2026,10,23,3);
describe('ARENA02: weekly deterministic legal opponent schedule',()=>{
 it('publishes the same preview to every run, with a different schedule next week',()=>{
  const current=weeklyArenaRotation(monday);
  expect(current).not.toBeNull();
  expect(current).toEqual(weeklyArenaRotation(monday));
  expect(current?.opponents.map(x=>x.speciesId)).not.toEqual(weeklyArenaRotation(monday+ARENA_WEEK_MS)?.opponents.map(x=>x.speciesId));
  expect(weeklyArenaRotation(monday+1)).toBeNull();
  expect(arenaOpponentLevel(0)).toBeNull();
  expect(arenaOpponentLevel(41)).toBeNull();
 });
 it('builds 40 increasing opponents across eight weeks, using only legal attacks and existing compatible TM effects',()=>{
  for(let week=0;week<8;week++){
   const schedule=weeklyArenaRotation(monday+week*ARENA_WEEK_MS);
   if(!schedule)throw Error('missing schedule week '+week);
   expect(schedule.version).toBe(ARENA_ROTATION_VERSION);
   expect(schedule.opponents).toHaveLength(40);
   expect(schedule.opponents.filter(x=>x.guardian).map(x=>x.floor)).toEqual([10,20,30,40]);
   expect(schedule.opponents[0]?.level).toBe(5);
   expect(schedule.opponents[39]?.level).toBe(100);
   for(const [index,p] of schedule.opponents.entries()){
    expect(p.floor).toBe(index+1);
    expect(p.level).toBe(arenaOpponentLevel(p.floor));
    expect(p.level).toBeGreaterThanOrEqual(kantoCaptureStartingLevel(p.speciesId));
    expect(p.name).toBe(kantoSpecies(p.speciesId)?.name);
    expect(p.moves.length).toBeLessThanOrEqual(4);
    expect(new Set(p.moves.map(m=>m.name)).size).toBe(p.moves.length);
    expect(p.moves.some(m=>m.category!=='status'&&m.power>0)).toBe(true);
    expect(p.floor<=20?p.tmIds.length===0:p.tmIds.length>0).toBe(true);
    const native=gymTrainedMoves(p.speciesId,p.level).map(m=>m.name);
    const lessons=p.tmIds.map(id=>{
     const tm=kantoMachine(id)!;
     expect(compatibleMachineSpecies(id)).toContain(p.speciesId);
     expect(executableMachineMove(tm.moveName)).not.toBeNull();
     expect(p.moves.map(m=>m.name)).toContain(tm.moveName);
     return tm.moveName;
    });
    expect(p.moves.every(m=>native.includes(m.name)||lessons.includes(m.name))).toBe(true);
    expect(lessons.every(n=>!['roar','secret-power','sunny-day','rain-dance','sandstorm','hail'].includes(n))).toBe(true);
    const limits=legacyMoveRankLimits(p.level);
    expect(Object.values(p.ranks).reduce((a,b)=>a+b,0)).toBeLessThanOrEqual(limits.skillPoints);
    expect(Object.values(p.ranks).every(rank=>Number.isInteger(rank)&&rank>=0&&rank<=limits.maxRankPerMove)).toBe(true);
   }
  }
 });
});
