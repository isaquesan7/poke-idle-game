import {describe,it,expect} from 'vitest';
import {executableMachineMove} from '../src/combat/machineLessonCatalog.js';
import {compatibleMachineSpecies} from '../src/catalog/kantoMachineCompatibility.js';
import {frozenValidatedEquippedMoves} from '../src/combat/serverFrozenBattle.js';
import {KANTO_BATTLE_MOVES} from '../src/combat/kantoBattle.js';
import type {Combatant,KantoMove} from '../src/combat/kantoBattle.js';
import {kantoMovePp,kantoMoveSpCost} from '../src/combat/kantoSkillEnergy.js';
import {createGymBattleState,applyGymDamage} from '../src/gyms/gymBattleState.js';
import {resolveGymTurn,gymLegalTurnActions} from '../src/gyms/gymTurn.js';
import {gymApplyToxic} from '../src/gyms/gymEffects.js';
import {gymSetWeather,gymWeatherDamage} from '../src/gyms/gymWeather.js';
const move=(name:string)=>executableMachineMove(name)!;
const stats={hp:1600,attack:90,defense:60,specialAttack:90,specialDefense:60,speed:90};
const basic={kind:'basic'} as const;
const action=(name:string)=>({kind:'move',moveName:name} as const);
function make(a:KantoMove,b:KantoMove=KANTO_BATTLE_MOVES.tackle!){
 const p:Combatant={speciesId:4,name:'Player',types:['normal'],level:50,stats,move:a,rank:0};
 const l:Combatant={speciesId:19,name:'Leader',types:['normal'],level:50,stats:{...stats,speed:10},move:b,rank:0};
 return createGymBattleState([{uid:1,combatant:p},{uid:2,combatant:p},{uid:3,combatant:p}],[l,l,l]);
}
function run(s:ReturnType<typeof make>,p:Parameters<typeof resolveGymTurn>[1],l:Parameters<typeof resolveGymTurn>[2],seed=1234){
 const r=resolveGymTurn(s,p,l,seed);
 if(r.status!=='applied')throw Error(r.reason);
 return r;
}
describe('TM10 — charge, recharge and Rest',()=>{
 it('canonical FRLG lessons',()=>{
  for(const [id,name,pp,power] of [['tm15','hyper-beam',5,150],['tm22','solar-beam',10,120],['tm28','dig',10,60],['tm44','rest',5,0]] as const){
   const m=move(name),species=compatibleMachineSpecies(id)[0]!;
   expect(m.power).toBe(power);expect(kantoMovePp(name)).toBe(pp);
   expect(frozenValidatedEquippedMoves(species,10,[name],undefined,[{tmId:id,speciesId:species}])).toEqual([m]);
   expect(frozenValidatedEquippedMoves(species,10,[name])).toBeNull();
  }
 });
 it('Solar Beam charges only once and sun skips preparation, other climates halve damage',()=>{
  const m=move('solar-beam'),s=make(m);
  const charge=run(s,action(m.name),basic).state;
  expect(charge.player.fighters[0].pendingAction).toBe(m.name);
  expect(charge.leader.fighters[0].hp).toBe(1600);
  expect(charge.player.fighters[0].sp).toBe(s.player.fighters[0].sp-kantoMoveSpCost(m));
  expect(gymLegalTurnActions(charge,'player')).toEqual([basic]);
  expect(resolveGymTurn(charge,action(m.name),basic,1234).status).toBe('blocked');
  const hit=run(JSON.parse(JSON.stringify(charge)),basic,basic).state;
  expect(hit.player.fighters[0].pendingAction).toBeUndefined();
  expect(hit.player.fighters[0].sp).toBe(charge.player.fighters[0].sp);
  expect(hit.leader.fighters[0].hp).toBeLessThan(1600);
  const sun=run(gymSetWeather(s,'sunny-day'),action(m.name),basic).state;
  expect(sun.player.fighters[0].pendingAction).toBeUndefined();
  expect(sun.leader.fighters[0].hp).toBeLessThan(1600);
  expect(gymWeatherDamage('rain-dance',m,100)).toBe(50);
 });
 it('Dig evades normal attack, Earthquake can hit underground, continuation costs zero',()=>{
  const m=move('dig'),s=make(m);
  const charge=run(s,action(m.name),basic).state;
  expect(charge.player.fighters[0].hp).toBe(1600);
  expect(charge.player.fighters[0].pendingAction).toBe('dig');
  const hit=run(charge,basic,basic).state;
  expect(hit.leader.fighters[0].hp).toBeLessThan(1600);
  expect(hit.player.fighters[0].sp).toBe(charge.player.fighters[0].sp);
  const quake=run(make(m,move('earthquake')),action(m.name),action('earthquake')).state;
  expect(quake.player.fighters[0].hp).toBeLessThan(1600);
 });
 it('successful Hyper Beam requires a no-attack round without extra SP',()=>{
  const m=move('hyper-beam'),s=make(m);
  const hit=run(s,action(m.name),basic).state;
  expect(hit.leader.fighters[0].hp).toBeLessThan(1600);
  expect(hit.player.fighters[0].pendingAction).toBe('recharge');
  expect(gymLegalTurnActions(hit,'player')).toEqual([basic]);
  const next=run(hit,basic,basic).state;
  expect(next.leader.fighters[0].hp).toBe(hit.leader.fighters[0].hp);
  expect(next.player.fighters[0].sp).toBe(hit.player.fighters[0].sp);
  expect(next.player.fighters[0].pendingAction).toBeUndefined();
 });
 it('Rest restores HP, removes toxic and sleeps for two own actions',()=>{
  const m=move('rest'),s=make(m,move('rest'));
  const hurt=gymApplyToxic(applyGymDamage(s,'player',600),'player');
  // Opponent uses basic; faster actor rests before incoming damage.
  const slept=run(hurt,action('rest'),basic).state;
  expect(slept.player.fighters[0].hp).toBeGreaterThan(1500);
  expect(slept.player.fighters[0].status).toBe('sleep');
  expect(slept.player.fighters[0].toxicStage).toBeUndefined();
  expect(slept.player.fighters[0].sleepActions).toBe(2);
  expect(slept.player.fighters[0].sp).toBe(hurt.player.fighters[0].sp-kantoMoveSpCost(m));
  const one=run(slept,basic,basic).state,two=run(one,basic,basic).state;
  expect(one.player.fighters[0].sleepActions).toBe(1);
  expect(two.player.fighters[0].sleepActions).toBe(0);
  expect(two.leader.fighters[0].hp).toBe(slept.leader.fighters[0].hp);
  expect(run(two,basic,basic).state.leader.fighters[0].hp).toBeLessThan(two.leader.fighters[0].hp);
 });
});
