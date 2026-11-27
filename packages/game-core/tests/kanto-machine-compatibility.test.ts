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
  expect(validatedMachineLessons(1,10,undefined,[{tmId:'tm09',speciesId:1}])).toBeNull();
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
  expect(regionalMachinePool(1,'common').map(m=>m.id)).toEqual(['tm34','tm39']);
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
