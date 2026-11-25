import {describe,it,expect} from 'vitest';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {prepareGymOpponent} from '../src/gyms/gymTactics.js';
import {gymSignatureTm} from '../src/gyms/gymSignatureTms.js';
import {createGymBattleState,switchGymPokemon} from '../src/gyms/gymBattleState.js';
import {gymApplyToxic,gymApplyStatus,gymCalmMind,gymSpecialStat,gymTickToxic} from '../src/gyms/gymEffects.js';
import {resolveGymTurn} from '../src/gyms/gymTurn.js';
import {gymChooseAiAction} from '../src/gyms/gymAiTurn.js';
import {kantoMoveSpCost} from '../src/combat/kantoSkillEnergy.js';
import {canonicalOnlineGymEquippedMoves} from '../src/combat/serverGymPreparation.js';
import type {GymBattleState} from '../src/gyms/gymBattleState.js';
import type {Combatant} from '../src/combat/kantoBattle.js';
const toxic=gymSignatureTm('soul',109)!.move, calm=gymSignatureTm('marsh',122)!.move;
const base=prepareGymOpponent(KANTO_GYMS[0]!).team[0];
const tank=(move:Combatant['move'],types:readonly string[]=['normal']):Combatant=>({...base,types,move,moves:[move],rank:0,ranks:{},stats:{hp:320,attack:1,defense:100,specialAttack:100,specialDefense:100,speed:50}});
const make=(actor=tank(calm),target=tank(toxic))=>createGymBattleState([{uid:1,combatant:actor},{uid:2,combatant:actor},{uid:3,combatant:actor}],[target,target,target]);
const basic={kind:'basic'} as const;
const run=(state:GymBattleState,p=basic as import('../src/gyms/gymTurn.js').GymTurnAction,l=basic as import('../src/gyms/gymTurn.js').GymTurnAction,seed=1)=>{
 const result=resolveGymTurn(state,p,l,seed);
 if(result.status!=='applied')throw Error(result.reason);
 return result;
};
describe('GYM04B: Toxic and Calm Mind only in NPC loadouts',()=>{
 it('Toxic costs SP, applies escalating active-only residual, and freezes on bench',()=>{
  const s=make(tank(toxic),tank(calm));
  const hit=Array.from({length:40},(_,seed)=>run(s,{kind:'move',moveName:'toxic'},basic,seed)).find(r=>r.state.leader.fighters[0].toxicStage===2)!;
  expect(hit).toBeDefined();
  expect(hit.state.player.fighters[0].sp).toBe(s.player.fighters[0].sp-kantoMoveSpCost(toxic));
  expect(hit.log.some(x=>x.includes('20 dano residual (toxic)'))).toBe(true);
  const second=run(hit.state);
  expect(second.state.leader.fighters[0].toxicStage).toBe(3);
  expect(second.log.some(x=>x.includes('40 dano residual (toxic)'))).toBe(true);
  const bench=run(second.state,basic,{kind:'switch',toIndex:1}).state;
  expect(bench.leader.fighters[0].hp).toBe(second.state.leader.fighters[0].hp);
  expect(bench.leader.fighters[0].toxicStage).toBe(3);
  let capped=gymApplyToxic(s,'leader');for(let i=0;i<20;i++)capped=gymTickToxic(capped,'leader');
  expect(capped.leader.fighters[0].toxicStage).toBe(15);
 });
 it('Toxic does not replace ordinary status or affect Poison/Steel; ordinary poison is unchanged',()=>{
  for(const type of ['poison','steel']){const s=make(tank(toxic),tank(calm,[type]));expect(gymApplyToxic(s,'leader')).toBe(s);}
  const poisoned=gymApplyStatus(make(),'leader','poison');
  expect(gymApplyToxic(poisoned,'leader')).toBe(poisoned);
  expect(run(poisoned).log.some(x=>x.includes('40 dano residual (poison)'))).toBe(true);
 });
 it('Calm Mind targets self even against Dark, costs SP, persists and caps at +6',()=>{
  const s=make(tank(calm),tank(toxic,['dark']));
  const r=run(s,{kind:'move',moveName:'calm-mind'});
  expect(r.state.player.fighters[0].effects?.specialAttackBoosts).toBe(1);
  expect(r.state.player.fighters[0].effects?.specialDefenseBoosts).toBe(1);
  expect(r.state.leader.fighters[0].effects?.specialDefenseBoosts).toBeUndefined();
  expect(r.state.player.fighters[0].sp).toBe(s.player.fighters[0].sp-kantoMoveSpCost(calm));
  expect(gymSpecialStat(100,1)).toBe(150);expect(gymSpecialStat(100,1,1)).toBe(100);
  let capped=r.state;for(let i=0;i<9;i++)capped=gymCalmMind(capped,'player');
  expect(capped.player.fighters[0].effects?.specialAttackBoosts).toBe(6);
  const switched=switchGymPokemon(capped,'player',1);
  expect(switched.status).toBe('applied');expect(switched.state.player.fighters[0].effects?.specialDefenseBoosts).toBe(6);
 });
 it('AI considers Toxic but avoids existing status and immune targets; no player teaching',()=>{
  const s=make(tank(calm),tank(toxic));
  expect(gymChooseAiAction(s,'leader')).toEqual({kind:'move',moveName:'toxic'});
  expect(gymChooseAiAction(gymApplyStatus(s,'player','burn'),'leader')).not.toEqual({kind:'move',moveName:'toxic'});
  expect(gymChooseAiAction(make(tank(calm,['poison']),tank(toxic)),'leader')).not.toEqual({kind:'move',moveName:'toxic'});
  expect(canonicalOnlineGymEquippedMoves(109,46,['toxic'])).toBeNull();
  expect(canonicalOnlineGymEquippedMoves(122,56,['calm-mind'])).toBeNull();
 });
 it('boosts affect real special damage on both sides without altering physical damage',()=>{
  const special={name:'test-special',type:'normal',category:'special' as const,power:40,accuracy:100,priority:0};
  const s=make(tank(special),tank(special)),action={kind:'move',moveName:special.name} as const;
  const plain=run(s,action,action,17).state;
  const boosted=run(gymCalmMind(s,'player'),action,action,17).state;
  expect(boosted.leader.fighters[0].hp).toBeLessThan(plain.leader.fighters[0].hp);
  expect(boosted.player.fighters[0].hp).toBeGreaterThan(plain.player.fighters[0].hp);
  const physical=run(s,basic,basic,17).state,boostedPhysical=run(gymCalmMind(s,'player'),basic,basic,17).state;
  expect(boostedPhysical.player.fighters[0].hp).toBe(physical.player.fighters[0].hp);
  expect(boostedPhysical.leader.fighters[0].hp).toBe(physical.leader.fighters[0].hp);
 });
});
