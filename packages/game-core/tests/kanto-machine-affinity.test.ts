import {describe,it,expect} from 'vitest';
import {executableMachineMove} from '../src/combat/machineLessonCatalog.js';
import {compatibleMachineSpecies} from '../src/catalog/kantoMachineCompatibility.js';
import {frozenValidatedEquippedMoves} from '../src/combat/serverFrozenBattle.js';
import {KANTO_BATTLE_MOVES} from '../src/combat/kantoBattle.js';
import type {Combatant,KantoMove} from '../src/combat/kantoBattle.js';
import {kantoMovePp,kantoMoveSpCost} from '../src/combat/kantoSkillEnergy.js';
import {createGymBattleState} from '../src/gyms/gymBattleState.js';
import {resolveGymTurn} from '../src/gyms/gymTurn.js';
import {gymEffectiveMove} from '../src/gyms/gymVariableMoves.js';
import {gymApplyStatus} from '../src/gyms/gymEffects.js';
const move=(name:string)=>executableMachineMove(name)!;
const stats={hp:1600,attack:90,defense:60,specialAttack:90,specialDefense:60,speed:90};
const basic={kind:'basic'} as const;
const action=(name:string)=>({kind:'move',moveName:name} as const);
function make(a:KantoMove,affinity=100,b:KantoMove=KANTO_BATTLE_MOVES.tackle!){
 const p:Combatant={speciesId:4,name:'Player',types:['normal'],level:50,stats,move:a,rank:0,affinity};
 const l:Combatant={speciesId:19,name:'Leader',types:['normal'],level:50,stats:{...stats,speed:10},move:b,rank:0};
 return createGymBattleState([{uid:1,combatant:p},{uid:2,combatant:p},{uid:3,combatant:p}],[l,l,l]);
}
function run(s:ReturnType<typeof make>,p:Parameters<typeof resolveGymTurn>[1],l:Parameters<typeof resolveGymTurn>[2]){
 const r=resolveGymTurn(s,p,l,1234);
 if(r.status!=='applied')throw Error(r.reason);
 return r;
}
describe('TM12 — affinity, Facade and Focus Punch',()=>{
 it('requires compatible lessons with canonical power and SP',()=>{
  for(const [id,name,pp,power,priority] of [['tm01','focus-punch',20,150,-3],['tm21','frustration',20,102,0],['tm27','return',20,102,0],['tm42','facade',20,70,0]] as const){
   const m=move(name),species=compatibleMachineSpecies(id)[0]!;
   expect(m.power).toBe(power);expect(m.priority).toBe(priority);expect(kantoMovePp(name)).toBe(pp);
   expect(frozenValidatedEquippedMoves(species,10,[name],undefined,[{tmId:id,speciesId:species}])).toEqual([m]);
   expect(frozenValidatedEquippedMoves(species,10,[name])).toBeNull();
  }
 });
 it('Return and Frustration are inverse across individual affinity and never cost variable SP',()=>{
  const ret=move('return'),fr=move('frustration');
  expect([0,25,50,75,100].map(a=>gymEffectiveMove(ret,a,null).power)).toEqual([1,25,51,76,102]);
  expect([0,25,50,75,100].map(a=>gymEffectiveMove(fr,a,null).power)).toEqual([102,76,51,25,1]);
  expect(()=>gymEffectiveMove(ret,undefined,null)).toThrow();
  const lo=make(ret,0),hi=make(ret,100);
  const l=run(lo,action('return'),basic).state,h=run(hi,action('return'),basic).state;
  expect(h.leader.fighters[0].hp).toBeLessThan(l.leader.fighters[0].hp);
  expect(h.player.fighters[0].sp).toBe(l.player.fighters[0].sp);
  expect(h.player.fighters[0].combatant.move.power).toBe(102);
  expect(run(make(fr,0),action('frustration'),basic).state.leader.fighters[0].hp).toBe(h.leader.fighters[0].hp);
 });
 it('Facade doubles base power only for burn, poison or paralysis, retains canonical slot',()=>{
  const m=move('facade');
  for(const status of ['burn','poison','paralysis'])expect(gymEffectiveMove(m,100,status).power).toBe(140);
  for(const status of ['sleep','freeze',null])expect(gymEffectiveMove(m,100,status).power).toBe(70);
  const s=make(m);
  const normal=run(s,action('facade'),basic).state;
  const poisoned=run(gymApplyStatus(s,'player','poison'),action('facade'),basic).state;
  expect(poisoned.leader.fighters[0].hp).toBeLessThan(normal.leader.fighters[0].hp);
  expect(poisoned.player.fighters[0].sp).toBe(normal.player.fighters[0].sp);
 });
 it('Focus Punch acts late and loses concentration if previously damaged; no second turn',()=>{
  const m=move('focus-punch'),s=make(m);
  const blocked=run(s,action(m.name),basic);
  expect(blocked.state.leader.fighters[0].hp).toBe(1600);
  expect(blocked.log.some(x=>x.includes('perdeu a concentração'))).toBe(true);
  expect(blocked.state.player.fighters[0].sp).toBe(s.player.fighters[0].sp-kantoMoveSpCost(m));
  const support=make(m,100,move('calm-mind'));
  const hit=run(support,action(m.name),action('calm-mind')).state;
  expect(hit.leader.fighters[0].hp).toBeLessThan(1600);
  expect(hit.player.fighters[0].pendingAction).toBeUndefined();
 });
});
