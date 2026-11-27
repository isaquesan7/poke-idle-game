import {describe,it,expect} from 'vitest';
import {executableMachineMove} from '../src/combat/machineLessonCatalog.js';
import {compatibleMachineSpecies} from '../src/catalog/kantoMachineCompatibility.js';
import {frozenValidatedEquippedMoves} from '../src/combat/serverFrozenBattle.js';
import {KANTO_BATTLE_MOVES} from '../src/combat/kantoBattle.js';
import type {Combatant,KantoMove} from '../src/combat/kantoBattle.js';
import {kantoMovePp,kantoMoveSpCost} from '../src/combat/kantoSkillEnergy.js';
import {createGymBattleState} from '../src/gyms/gymBattleState.js';
import {resolveGymTurn,gymLegalTurnActions} from '../src/gyms/gymTurn.js';
import {gymApplyStatus,gymSetBarrier,gymDoubleTeam,gymAccuracyAfterEvasion} from '../src/gyms/gymEffects.js';
import {gymSetWeather} from '../src/gyms/gymWeather.js';
const move=(name:string)=>executableMachineMove(name)!;
const stats={hp:1600,attack:90,defense:60,specialAttack:90,specialDefense:60,speed:90};
const basic={kind:'basic'} as const;
const action=(name:string)=>({kind:'move',moveName:name} as const);
function make(a:KantoMove,b:KantoMove=KANTO_BATTLE_MOVES.tackle!,types=['normal']){
 const p:Combatant={speciesId:4,name:'Player',types:['normal'],level:50,stats,move:a,rank:0};
 const l:Combatant={speciesId:19,name:'Leader',types,level:50,stats:{...stats,speed:10},move:b,rank:0};
 return createGymBattleState([{uid:1,combatant:p},{uid:2,combatant:p},{uid:3,combatant:p}],[l,l,l]);
}
function run(s:ReturnType<typeof make>,p:Parameters<typeof resolveGymTurn>[1],l:Parameters<typeof resolveGymTurn>[2],seed=1234){
 const r=resolveGymTurn(s,p,l,seed);
 if(r.status!=='applied')throw Error(r.reason);
 return r;
}
describe('TM11 — Taunt, evasion and freeze',()=>{
 it('teaches only compatible species, with Gen III fichas',()=>{
  for(const [id,name,pp,power] of [['tm12','taunt',20,0],['tm13','ice-beam',10,95],['tm14','blizzard',5,120],['tm32','double-team',15,0]] as const){
   const m=move(name),species=compatibleMachineSpecies(id)[0]!;
   expect(m.power).toBe(power);expect(kantoMovePp(name)).toBe(pp);
   expect(frozenValidatedEquippedMoves(species,10,[name],undefined,[{tmId:id,speciesId:species}])).toEqual([m]);
   expect(frozenValidatedEquippedMoves(species,10,[name])).toBeNull();
  }
 });
 it('Taunt blocks the already selected support and the next action without charging target SP',()=>{
  const s=make(move('taunt'),move('calm-mind'));
  const r=run(s,action('taunt'),action('calm-mind')).state;
  expect(r.leader.fighters[0].tauntActions).toBe(1);
  expect(r.leader.fighters[0].sp).toBe(s.leader.fighters[0].sp);
  expect(r.player.fighters[0].sp).toBe(s.player.fighters[0].sp-kantoMoveSpCost(move('taunt')));
  expect(gymLegalTurnActions(r,'leader')).not.toContainEqual(action('calm-mind'));
  const next=run(r,basic,basic).state;
  expect(next.leader.fighters[0].tauntActions).toBe(0);
  expect(gymLegalTurnActions(next,'leader')).toContainEqual(action('calm-mind'));
 });
 it('Double Team caps evasion and never reduces always-hit moves',()=>{
  const s=make(move('double-team'));
  const r=run(s,action('double-team'),basic).state;
  expect(r.player.fighters[0].effects?.evasionBoosts).toBe(1);
  let capped=r;for(let i=0;i<9;i++)capped=gymDoubleTeam(capped,'player');
  expect(capped.player.fighters[0].effects?.evasionBoosts).toBe(6);
  expect(gymAccuracyAfterEvasion('tackle',100,6)).toBeCloseTo(100/3);
  expect(gymAccuracyAfterEvasion('shock-wave',100,6)).toBe(100);
  expect(gymAccuracyAfterEvasion('aerial-ace',100,6)).toBe(100);
 });
 it('ice attacks can freeze; sun, Ice and Safeguard prevent new freeze',()=>{
  const m=move('ice-beam'),s=make(m);
  expect(gymApplyStatus(make(m,KANTO_BATTLE_MOVES.tackle!,['ice']),'leader','freeze').leader.fighters[0].status).toBeNull();
  expect(gymApplyStatus(gymSetBarrier(s,'leader','safeguard'),'leader','freeze').leader.fighters[0].status).toBeNull();
  let freezes=0,thaws=0;
  for(let i=0;i<128;i++){
   const seed=Math.imul(i+1,0x9e3779b9)>>>0;
   const r=run(s,action('ice-beam'),basic,seed);
   if(r.log.some(x=>x.includes('recebeu freeze')))freezes++;
   expect(run(gymSetWeather(s,'sunny-day'),action('ice-beam'),basic,seed).log.some(x=>x.includes('recebeu freeze'))).toBe(false);
   const frozen=gymApplyStatus(s,'player','freeze');
   const next=run(frozen,basic,basic,seed);
   if(next.state.player.fighters[0].status===null)thaws++;
   else expect(next.state.leader.fighters[0].hp).toBe(1600);
  }
  expect(freezes).toBeGreaterThan(0);expect(thaws).toBeGreaterThan(0);expect(thaws).toBeLessThan(128);
 });
});
