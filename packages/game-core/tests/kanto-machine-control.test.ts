import {describe,it,expect} from 'vitest';
import {executableMachineMove} from '../src/combat/machineLessonCatalog.js';
import {compatibleMachineSpecies} from '../src/catalog/kantoMachineCompatibility.js';
import {frozenValidatedEquippedMoves} from '../src/combat/serverFrozenBattle.js';
import {KANTO_BATTLE_MOVES} from '../src/combat/kantoBattle.js';
import type {Combatant,KantoMove} from '../src/combat/kantoBattle.js';
import {kantoMovePp,kantoMoveSpCost} from '../src/combat/kantoSkillEnergy.js';
import {createGymBattleState,spendGymSp} from '../src/gyms/gymBattleState.js';
import {resolveGymTurn,gymLegalTurnActions} from '../src/gyms/gymTurn.js';
const move=(name:string)=>executableMachineMove(name)!;
const stats={hp:1600,attack:90,defense:60,specialAttack:90,specialDefense:60,speed:90};
const basic={kind:'basic'} as const;
const action=(name:string)=>({kind:'move',moveName:name} as const);
function make(a:KantoMove,b:KantoMove=KANTO_BATTLE_MOVES.tackle!){
 const p:Combatant={speciesId:4,name:'Player',types:['normal'],level:50,stats,move:a,rank:0};
 const l:Combatant={speciesId:19,name:'Leader',types:['normal'],level:50,stats:{...stats,speed:10},move:b,rank:0};
 return createGymBattleState([{uid:1,combatant:p},{uid:2,combatant:p},{uid:3,combatant:p}],[l,l,l]);
}
function run(s:ReturnType<typeof make>,p:Parameters<typeof resolveGymTurn>[1],l:Parameters<typeof resolveGymTurn>[2]){
 const r=resolveGymTurn(s,p,l,1234);
 if(r.status!=='applied')throw Error(r.reason);
 return r;
}
describe('TM13 — team control',()=>{
 it('canonical compatible moves',()=>{
  for(const [id,name,pp,priority] of [['tm05','roar',20,-6],['tm41','torment',15,0]] as const){
   const m=move(name),species=compatibleMachineSpecies(id)[0]!;
   expect(m.power).toBe(0);expect(m.priority).toBe(priority);expect(kantoMovePp(name)).toBe(pp);
   expect(frozenValidatedEquippedMoves(species,10,[name],undefined,[{tmId:id,speciesId:species}])).toEqual([m]);
   expect(frozenValidatedEquippedMoves(species,10,[name])).toBeNull();
  }
 });
 it('Roar forces reserve without quota or SP recovery; no reserve means no effect',()=>{
  const s=spendGymSp(make(move('roar')),'leader',10);
  const r=run(s,action('roar'),basic).state;
  expect(r.leader.activeIndex).not.toBe(0);
  expect(r.leader.voluntarySwitchesUsed).toBe(0);
  expect(r.leader.fighters[0].sp).toBe(s.leader.fighters[0].sp);
  expect(r.player.fighters[0].sp).toBe(s.player.fighters[0].sp-kantoMoveSpCost(move('roar')));
  const only={...s,leader:{...s.leader,fighters:[s.leader.fighters[0],{...s.leader.fighters[1],hp:0},{...s.leader.fighters[2],hp:0}] as const}};
  const fail=run(only,action('roar'),basic).state;
  expect(fail.leader.activeIndex).toBe(0);expect(fail.outcome).toBe('ongoing');
 });
 it('Torment blocks repeated skills, basic remains available, switch clears torment',()=>{
  const s=make(move('torment'),move('rock-tomb'));
  const r=run(s,action('torment'),action('rock-tomb')).state;
  expect(r.leader.fighters[0].tormented).toBe(true);
  expect(r.leader.fighters[0].lastSkill).toBe('rock-tomb');
  expect(gymLegalTurnActions(r,'leader')).not.toContainEqual(action('rock-tomb'));
  expect(gymLegalTurnActions(r,'leader')).toContainEqual(basic);
  const next=run(r,basic,basic).state;
  expect(gymLegalTurnActions(next,'leader')).toContainEqual(action('rock-tomb'));
  const switched=run(r,basic,{kind:'switch',toIndex:1}).state;
  expect(switched.leader.fighters[0].tormented).toBeUndefined();
 });
});
