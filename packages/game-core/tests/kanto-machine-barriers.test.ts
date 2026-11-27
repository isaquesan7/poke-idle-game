import {describe,it,expect} from 'vitest';
import {executableMachineMove} from '../src/combat/machineLessonCatalog.js';
import {compatibleMachineSpecies} from '../src/catalog/kantoMachineCompatibility.js';
import {frozenValidatedEquippedMoves} from '../src/combat/serverFrozenBattle.js';
import {KANTO_BATTLE_MOVES} from '../src/combat/kantoBattle.js';
import type {Combatant,KantoMove} from '../src/combat/kantoBattle.js';
import {kantoMovePp,kantoMoveSpCost} from '../src/combat/kantoSkillEnergy.js';
import {createGymBattleState,switchGymPokemon} from '../src/gyms/gymBattleState.js';
import {resolveGymTurn} from '../src/gyms/gymTurn.js';
import {gymSetBarrier,gymBarrierActive,gymProtectedDamage,gymApplyStatus,gymApplySleep,gymApplyConfusion,gymProtectAttempt,gymBreakScreens} from '../src/gyms/gymEffects.js';
const move=(name:string)=>executableMachineMove(name)!;
const basic={kind:'basic'} as const;
const stats={hp:1000,attack:90,defense:60,specialAttack:90,specialDefense:60,speed:90};
function make(a:KantoMove,b:KantoMove=KANTO_BATTLE_MOVES.tackle!){
 const p:Combatant={speciesId:25,name:'Player',types:['electric'],level:40,stats,move:a,rank:0};
 const l:Combatant={speciesId:19,name:'Leader',types:['normal'],level:40,stats:{...stats,speed:10},move:b,rank:0};
 return createGymBattleState([{uid:1,combatant:p},{uid:2,combatant:p},{uid:3,combatant:p}],[l,l,l]);
}
const action=(name:string)=>({kind:'move',moveName:name} as const);
describe('TM08 — barriers and protection',()=>{
 it('canonical compatible teaching and historical metadata',()=>{
  for(const [id,name,pp,power,priority] of [['tm16','light-screen',30,0,0],['tm17','protect',10,0,3],['tm20','safeguard',25,0,0],['tm31','brick-break',15,75,0],['tm33','reflect',20,0,0]] as const){
   const m=move(name),species=compatibleMachineSpecies(id)[0]!;
   expect(m.power).toBe(power);expect(m.priority).toBe(priority);expect(kantoMovePp(name)).toBe(pp);
   expect(frozenValidatedEquippedMoves(species,10,[name],undefined,[{tmId:id,speciesId:species}])).toEqual([m]);
   expect(frozenValidatedEquippedMoves(species,10,[name])).toBeNull();
  }
 });
 it('screens halve eligible non-critical damage for five turns, preserve team switching and do not refresh',()=>{
  const s=make(move('reflect')),r=resolveGymTurn(s,action('reflect'),basic,1234);
  if(r.status!=='applied')throw Error(r.reason);
  expect(r.state.player.fighters[0].sp).toBe(s.player.fighters[0].sp-kantoMoveSpCost(move('reflect')));
  expect(gymBarrierActive(r.state,'player','reflect')).toBe(true);
  expect(gymProtectedDamage(r.state,'player','physical','tackle',101,false)).toBe(50);
  expect(gymProtectedDamage(r.state,'player','physical','tackle',101,true)).toBe(101);
  expect(gymProtectedDamage(r.state,'player','special','thunderbolt',101,false)).toBe(101);
  expect(gymSetBarrier(r.state,'player','reflect')).toBe(r.state);
  const switched=switchGymPokemon(r.state,'player',1).state;
  expect(gymBarrierActive(switched,'player','reflect')).toBe(true);
  expect(gymBarrierActive({...switched,turn:4},'player','reflect')).toBe(true);
  expect(gymBarrierActive({...switched,turn:5},'player','reflect')).toBe(false);
  const screen=gymSetBarrier(s,'player','light-screen');
  expect(gymProtectedDamage(screen,'player','special','thunderbolt',101,false)).toBe(50);
  expect(gymProtectedDamage(screen,'player','special','night-shade',40,false)).toBe(40);
 });
 it('Protect prevents attacks and status for only the current round; consecutive uses have diminishing success',()=>{
  const s=make(move('protect'));
  const p=resolveGymTurn(s,action('protect'),basic,1234);
  if(p.status!=='applied')throw Error(p.reason);
  expect(p.state.player.fighters[0].hp).toBe(1000);
  expect(p.state.player.fighters[0].sp).toBe(s.player.fighters[0].sp-kantoMoveSpCost(move('protect')));
  expect(p.log.some(x=>x.includes('bloqueou'))).toBe(true);
  const next=resolveGymTurn(p.state,basic,basic,1234);
  if(next.status!=='applied')throw Error(next.reason);
  expect(next.state.player.fighters[0].hp).toBeLessThan(1000);
  expect(gymProtectAttempt(p.state,'player',()=>.49).success).toBe(true);
  expect(gymProtectAttempt(p.state,'player',()=>.5).success).toBe(false);
  const toxic=make(move('protect'),move('toxic'));
  const q=resolveGymTurn(toxic,action('protect'),action('toxic'),1234);
  if(q.status!=='applied')throw Error(q.reason);
  expect(q.state.player.fighters[0].status).toBeNull();
 });
 it('Safeguard prevents new status, not old poison; Brick Break clears only screens before damage',()=>{
  const s=make(move('brick-break'));
  let screened=gymSetBarrier(gymSetBarrier(gymSetBarrier(s,'leader','reflect'),'leader','light-screen'),'leader','safeguard');
  expect(gymApplyStatus(screened,'leader','poison')).toBe(screened);
  expect(gymApplySleep(screened,'leader',2)).toBe(screened);
  expect(gymApplyConfusion(screened,'leader',3)).toBe(screened);
  const poisoned=gymApplyStatus(s,'leader','poison');
  expect(gymSetBarrier(poisoned,'leader','safeguard').leader.fighters[0].status).toBe('poison');
  const r=resolveGymTurn(screened,action('brick-break'),basic,1234);
  const plain=resolveGymTurn(s,action('brick-break'),basic,1234);
  if(r.status!=='applied'||plain.status!=='applied')throw Error('turn');
  expect(r.state.leader.fighters[0].hp).toBe(plain.state.leader.fighters[0].hp);
  expect(gymBarrierActive(r.state,'leader','reflect')).toBe(false);
  expect(gymBarrierActive(r.state,'leader','light-screen')).toBe(false);
  expect(gymBarrierActive(r.state,'leader','safeguard')).toBe(true);
 });
});
