import {describe,expect,it} from 'vitest';
import {KANTO_MACHINES} from '../src/catalog/kantoMachines.js';
import {compatibleMachineSpecies,compatibleSpeciesMachines} from '../src/catalog/kantoMachineCompatibility.js';
import {validatedMachineLessons,executableMachineMove} from '../src/combat/serverMachineLessons.js';
describe('pinned FRLG compatibility and permanent lessons',()=>{
 it('all 50 positive lists are sorted, complete and contain only Kanto IDs',()=>{
  expect(KANTO_MACHINES.map(tm=>compatibleMachineSpecies(tm.id).length)).toEqual([53,6,55,16,27,145,40,11,15,145,111,32,60,60,78,24,145,105,32,25,145,33,63,50,48,41,145,68,34,38,52,145,20,45,46,39,29,46,40,47,31,145,145,145,134,90,18,21,22,14]);
  for(const tm of KANTO_MACHINES){const ids=compatibleMachineSpecies(tm.id);expect(ids).toEqual([...new Set(ids)].sort((a,b)=>a-b));expect(ids.every(id=>id>=1&&id<=151)).toBe(true);}
  expect(compatibleMachineSpecies('tm24')).toContain(25);
  expect(compatibleMachineSpecies('tm24')).not.toContain(7);
  expect(compatibleSpeciesMachines(25).map(tm=>tm.id)).toContain('tm24');
  expect(compatibleSpeciesMachines(152)).toEqual([]);
  expect(compatibleMachineSpecies('hm01')).toEqual([]);
 });
 it('validates teaching species and rejects forged or duplicate lessons',()=>{
  expect(executableMachineMove('thunderbolt')).not.toBeNull();
  expect(validatedMachineLessons(25,10,undefined,[{tmId:'tm24',speciesId:25}])?.has('thunderbolt')).toBe(true);
  expect(validatedMachineLessons(7,10,undefined,[{tmId:'tm24',speciesId:7}])).toBeNull();
  expect(validatedMachineLessons(26,10,undefined,[{tmId:'tm24',speciesId:25}])).toBeNull();
  expect(validatedMachineLessons(26,10,[{from:25,to:26,level:10,moves:['thunder-shock']}],[{tmId:'tm24',speciesId:25}])?.has('thunderbolt')).toBe(true);
  expect(validatedMachineLessons(25,10,undefined,[{tmId:'tm24',speciesId:25},{tmId:'tm24',speciesId:25}])).toBeNull();
  expect(validatedMachineLessons(4,10,undefined,[{tmId:'tm09',speciesId:4}])).toBeNull();
 });
});

import {frozenValidatedEquippedMoves} from '../src/combat/serverFrozenBattle.js';
import {canonicalOnlineGymEquippedMoves} from '../src/combat/serverGymPreparation.js';
import {validatedOnlineMoveRanks} from '../src/combat/serverMoveRanks.js';
describe('TM move permission across combat and evolution',()=>{
 it('permits an early move only with a valid lesson and preserves it after evolution',()=>{
  const lessons=[{tmId:'tm24',speciesId:25}];
  expect(frozenValidatedEquippedMoves(25,10,['thunderbolt'])).toBeNull();
  expect(frozenValidatedEquippedMoves(25,10,['thunderbolt'],undefined,lessons)?.[0]?.name).toBe('thunderbolt');
  expect(canonicalOnlineGymEquippedMoves(25,10,['thunderbolt'],undefined,lessons)?.[0]?.name).toBe('thunderbolt');
  expect(validatedOnlineMoveRanks(25,10,undefined,{thunderbolt:1},lessons)).toEqual({thunderbolt:1});
  expect(validatedOnlineMoveRanks(25,10,undefined,{thunderbolt:1})).toBeNull();
  const history=[{from:25,to:26,level:10,moves:['thunderbolt']}];
  expect(frozenValidatedEquippedMoves(26,10,['thunderbolt'],history,lessons)?.[0]?.name).toBe('thunderbolt');
  expect(frozenValidatedEquippedMoves(7,10,['thunderbolt'],undefined,lessons)).toBeNull();
 });
});

import {gymSignatureTm} from '../src/gyms/gymSignatureTms.js';
import {createGymBattleState} from '../src/gyms/gymBattleState.js';
import {resolveGymTurn} from '../src/gyms/gymTurn.js';
import {KANTO_BATTLE_MOVES} from '../src/combat/kantoBattle.js';
import type {Combatant} from '../src/combat/kantoBattle.js';
import {kantoMoveSpCost} from '../src/combat/kantoSkillEnergy.js';
import {regionalMachinePool} from '../src/inventory/machineLoot.js';
describe('first-region TM moves with existing combat effects',()=>{
 it('uses the exact published FRLG gym stats and does not grant native moves',()=>{
  expect(executableMachineMove('rock-tomb')).toEqual(gymSignatureTm('boulder',95)?.move);
  expect(executableMachineMove('shock-wave')).toEqual(gymSignatureTm('thunder',25)?.move);
  expect(regionalMachinePool(1,'common').map(m=>m.id)).toEqual(['tm03','tm34','tm39']);
  expect(frozenValidatedEquippedMoves(25,10,['shock-wave'])).toBeNull();
  expect(frozenValidatedEquippedMoves(25,10,['shock-wave'],undefined,[{tmId:'tm34',speciesId:25}])?.[0]?.name).toBe('shock-wave');
  expect(canonicalOnlineGymEquippedMoves(25,10,['shock-wave'],undefined,[{tmId:'tm34',speciesId:25}])?.[0]?.name).toBe('shock-wave');
  expect(validatedOnlineMoveRanks(25,10,undefined,{ 'shock-wave':1},[{tmId:'tm34',speciesId:25}])).toEqual({'shock-wave':1});
 });
 it('charges SP once and resolves Rock Tomb speed drop and Shock Wave damage in the shared turn engine',()=>{
  const stats={hp:1000,attack:40,defense:40,specialAttack:40,specialDefense:40,speed:80};
  for(const name of ['rock-tomb','shock-wave']){
   const move=executableMachineMove(name)!;
   const player:Combatant={speciesId:25,name:'Player',level:30,types:['electric'],stats,move,rank:0};
   const foe:Combatant={speciesId:7,name:'Opponent',level:30,types:['water'],stats:{...stats,speed:10},move:KANTO_BATTLE_MOVES.tackle!,rank:0};
   const state=createGymBattleState([{uid:1,combatant:player},{uid:2,combatant:player},{uid:3,combatant:player}],[foe,foe,foe]);
   let hit=false;
   for(let seed=0;seed<32;seed++){
    const turn=resolveGymTurn(state,{kind:'move',moveName:name},{kind:'basic'},seed);
    expect(turn.status).toBe('applied');
    if(turn.status!=='applied')throw Error('turn rejected');
    expect(turn.state.player.fighters[0].sp).toBe(state.player.fighters[0].sp-kantoMoveSpCost(move));
    const damaged=turn.state.leader.fighters[0].hp<foe.stats.hp;
    if(name==='shock-wave')expect(damaged).toBe(true);
    if(damaged){
     hit=true;
     if(name==='rock-tomb')expect(turn.state.leader.fighters[0].effects?.speedDrops).toBe(1);
    }
   }
   expect(hit).toBe(true);
  }
 });
});

import {kantoMovePp} from '../src/combat/kantoSkillEnergy.js';
import {kantoMoveExpectedHits,kantoRollHitCount} from '../src/combat/kantoMultiHit.js';
import {kantoTmPreviewHitCount} from '../src/catalog/kantoTmPreview.js';
import {kantoLevelMoves} from '../src/catalog/kantoLevelMoves.js';
import {simulateKantoBattle} from '../src/combat/kantoBattle.js';
describe('TM09 historical Bullet Seed',()=>{
 const lesson=[{tmId:'tm09',speciesId:1}];
 const move=executableMachineMove('bullet-seed')!;
 it('uses Gen III special damage, exact multi-hit distribution and no native permission',()=>{
  expect(move).toEqual({name:'bullet-seed',type:'grass',category:'special',power:10,accuracy:100,priority:0});
  expect(kantoMovePp(move.name)).toBe(30);
  expect(kantoMoveExpectedHits(move.name)).toBe(3);
  expect(kantoMoveSpCost(move)).toBe(12);
  for(let i=0;i<800;i++){
   const roll=(i+.5)/800;
   expect(kantoRollHitCount(move.name,()=>roll)).toBe(kantoTmPreviewHitCount('tm09',roll));
  }
  expect(compatibleMachineSpecies('tm09')).toHaveLength(15);
  expect(kantoLevelMoves(1,100).some(x=>x.move.name===move.name)).toBe(false);
  expect(frozenValidatedEquippedMoves(1,10,[move.name])).toBeNull();
  expect(frozenValidatedEquippedMoves(1,10,[move.name],undefined,lesson)).toEqual([move]);
  expect(canonicalOnlineGymEquippedMoves(1,10,[move.name],undefined,lesson)).toEqual([move]);
  expect(validatedOnlineMoveRanks(1,10,undefined,{[move.name]:1},lesson)).toEqual({[move.name]:1});
  expect(validatedMachineLessons(2,16,[{from:1,to:2,level:16,moves:[move.name]}],lesson)?.get(move.name)).toEqual(move);
  expect(regionalMachinePool(2,'uncommon')).toEqual([]);
  expect(regionalMachinePool(3,'uncommon').map(x=>x.id)).toContain('tm09');
 });
 it('resolves all hit counts in shared Gym/region turn engine with a single SP cost',()=>{
  const stats={hp:1000,attack:15,defense:50,specialAttack:60,specialDefense:50,speed:90};
  const player:Combatant={speciesId:1,name:'Player',level:30,types:['grass','poison'],stats,move,rank:0};
  const foe:Combatant={speciesId:7,name:'Opponent',level:30,types:['water'],stats:{...stats,speed:10},move:KANTO_BATTLE_MOVES.tackle!,rank:0};
  const state=createGymBattleState([{uid:1,combatant:player},{uid:2,combatant:player},{uid:3,combatant:player}],[foe,foe,foe]);
  const counts=new Set<number>();
  for(let i=0;i<64;i++){
   const seed=Math.imul(i+1,0x9e3779b9)>>>0;
   const actions=[{kind:'move',moveName:move.name},{kind:'basic'}] as const;
   const result=resolveGymTurn(state,actions[0],actions[1],seed);
   expect(result).toEqual(resolveGymTurn(state,actions[0],actions[1],seed));
   expect(result.status).toBe('applied');
   if(result.status!=='applied')throw Error('turn rejected');
   const frames=result.frames.filter(f=>f.moveName===move.name&&f.hitIndex!==undefined);
   expect(frames.length).toBeGreaterThanOrEqual(2);
   expect(frames.length).toBeLessThanOrEqual(5);
   expect(frames.map(f=>f.hitIndex)).toEqual(Array.from({length:frames.length},(_,j)=>j+1));
   expect(frames.every(f=>f.hitTotal===frames.length)).toBe(true);
   counts.add(frames.length);
   expect(result.state.player.fighters[0].sp).toBe(state.player.fighters[0].sp-12);
  }
  expect([...counts].sort()).toEqual([2,3,4,5]);
  const bad={...player,move:{...move,power:25,category:'physical' as const}};
  expect(()=>simulateKantoBattle(bad,foe,1)).toThrow();
  const replay=simulateKantoBattle(player,foe,12345);
  expect(replay).toEqual(simulateKantoBattle(player,foe,12345));
  expect(replay.frames.some(f=>f.moveName===move.name&&f.hitTotal!==undefined)).toBe(true);
 });
});

describe('TM05 — executable historical attacks in the shared online engine',()=>{
 const moves=[
  ['tm02','dragon-claw','dragon','special',80,100,15],
  ['tm03','water-pulse','water','special',60,100,20],
  ['tm23','iron-tail','steel','physical',100,75,15],
  ['tm26','earthquake','ground','physical',100,100,10],
  ['tm29','psychic','psychic','special',90,100,10],
  ['tm30','shadow-ball','ghost','physical',80,100,15]
 ] as const;
 it('admits only compatible lessons and retains historical metadata and PP',()=>{
  for(const [id,name,type,category,power,accuracy,pp] of moves){
   const species=compatibleMachineSpecies(id)[0]!;
   const move=executableMachineMove(name)!;
   expect(move).toEqual({name,type,category,power,accuracy,priority:0});
   expect(kantoMovePp(name)).toBe(pp);
   expect(kantoMoveSpCost(move)).toBeGreaterThan(0);
   expect(frozenValidatedEquippedMoves(species,10,[name],undefined,[{tmId:id,speciesId:species}])).toEqual([move]);
   expect(canonicalOnlineGymEquippedMoves(species,10,[name],undefined,[{tmId:id,speciesId:species}])).toEqual([move]);
   const incompatible=Array.from({length:151},(_,i)=>i+1).find(i=>!compatibleMachineSpecies(id).includes(i))!;
   expect(validatedMachineLessons(incompatible,10,undefined,[{tmId:id,speciesId:incompatible}])).toBeNull();
  }
  expect(executableMachineMove('water-pulse')).toEqual(gymSignatureTm('cascade',120)?.move);
  expect(executableMachineMove('earthquake')).toEqual(gymSignatureTm('earth',51)?.move);
 });
 it('resolves damage, confusion and defense stage drops, with one charge per attack',()=>{
  const stats={hp:1000,attack:60,defense:50,specialAttack:60,specialDefense:50,speed:90};
  for(const [,name] of moves){
   const move=executableMachineMove(name)!;
   const player:Combatant={speciesId:1,name:'Player',level:30,types:['grass','poison'],stats,move,rank:0};
   const foe:Combatant={speciesId:7,name:'Opponent',level:30,types:['water'],stats:{...stats,speed:10},move:KANTO_BATTLE_MOVES.tackle!,rank:0};
   const state=createGymBattleState([{uid:1,combatant:player},{uid:2,combatant:player},{uid:3,combatant:player}],[foe,foe,foe]);
   let hits=0,effects=0;
   for(let i=0;i<128;i++){
    const result=resolveGymTurn(state,{kind:'move',moveName:name},{kind:'basic'},Math.imul(i+1,0x9e3779b9)>>>0);
    expect(result.status).toBe('applied');
    if(result.status!=='applied')throw Error('turn rejected');
    expect(result.state.player.fighters[0].sp).toBe(state.player.fighters[0].sp-kantoMoveSpCost(move));
    const target=result.state.leader.fighters[0];
    if(target.hp<foe.stats.hp)hits++;
    if(name==='water-pulse'&&result.log.some(x=>x.includes('ficou confuso')))effects++;
    if(name==='iron-tail'&&target.effects?.defenseDrops===1)effects++;
    if((name==='shadow-ball'||name==='psychic')&&target.effects?.specialDefenseDrops===1)effects++;
   }
   expect(hits).toBeGreaterThan(0);
   if(['water-pulse','iron-tail','shadow-ball','psychic'].includes(name))expect(effects).toBeGreaterThan(0);
  }
 });
 it('never applies Shadow Ball secondary against Normal immunity',()=>{
  const stats={hp:1000,attack:60,defense:50,specialAttack:60,specialDefense:50,speed:90};
  const move=executableMachineMove('shadow-ball')!;
  const player:Combatant={speciesId:92,name:'Player',level:30,types:['ghost','poison'],stats,move,rank:0};
  const foe:Combatant={speciesId:19,name:'Opponent',level:30,types:['normal'],stats:{...stats,speed:10},move:KANTO_BATTLE_MOVES.tackle!,rank:0};
  const state=createGymBattleState([{uid:1,combatant:player},{uid:2,combatant:player},{uid:3,combatant:player}],[foe,foe,foe]);
  for(let i=0;i<64;i++){
   const result=resolveGymTurn(state,{kind:'move',moveName:move.name},{kind:'basic'},Math.imul(i+1,0x9e3779b9)>>>0);
   if(result.status!=='applied')throw Error('turn rejected');
   expect(result.state.leader.fighters[0].hp).toBe(foe.stats.hp);
   expect(result.state.leader.fighters[0].effects?.specialDefenseDrops).toBe(0);
  }
 });
});
