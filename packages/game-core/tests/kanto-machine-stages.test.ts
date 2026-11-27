import {describe,it,expect} from 'vitest';
import {executableMachineMove} from '../src/combat/machineLessonCatalog.js';
import {compatibleMachineSpecies} from '../src/catalog/kantoMachineCompatibility.js';
import {frozenValidatedEquippedMoves} from '../src/combat/serverFrozenBattle.js';
import {regionalMachinePool} from '../src/inventory/machineLoot.js';
import {KANTO_BATTLE_MOVES} from '../src/combat/kantoBattle.js';
import type {Combatant,KantoMove} from '../src/combat/kantoBattle.js';
import {kantoMovePp,kantoMoveSpCost} from '../src/combat/kantoSkillEnergy.js';
import {createGymBattleState,switchGymPokemon} from '../src/gyms/gymBattleState.js';
import {resolveGymTurn} from '../src/gyms/gymTurn.js';
import {gymBulkUp,gymOverheatDrop,gymSpecialStat,gymDropStat} from '../src/gyms/gymEffects.js';
const bulk=executableMachineMove('bulk-up')!,steel=executableMachineMove('steel-wing')!,heat=executableMachineMove('overheat')!;
const stats={hp:1000,attack:60,defense:50,specialAttack:60,specialDefense:50,speed:90};
const make=(move:KantoMove,enemyHp=1000,types=['normal'])=>{
 const p:Combatant={speciesId:4,name:'Player',level:30,types:['fire'],stats,move,rank:0};
 const foe:Combatant={speciesId:19,name:'Opponent',level:30,types,stats:{...stats,hp:enemyHp,speed:10},move:KANTO_BATTLE_MOVES.tackle!,rank:0};
 return createGymBattleState([{uid:1,combatant:p},{uid:2,combatant:p},{uid:3,combatant:p}],[foe,foe,foe]);
};
const action=(move:KantoMove)=>({kind:'move',moveName:move.name} as const);
const basic={kind:'basic'} as const;
describe('TM07 — stages and self effects',()=>{
 it('uses historical fichas and requires valid lessons',()=>{
  for(const [id,move,pp,power,acc] of [['tm08',bulk,20,0,100],['tm47',steel,25,70,90],['tm50',heat,5,140,90]] as const){
   const species=compatibleMachineSpecies(id)[0]!;
   expect(move.power).toBe(power);expect(move.accuracy).toBe(acc);expect(kantoMovePp(move.name)).toBe(pp);
   expect(frozenValidatedEquippedMoves(species,10,[move.name],undefined,[{tmId:id,speciesId:species}])).toEqual([move]);
   expect(frozenValidatedEquippedMoves(species,10,[move.name])).toBeNull();
  }
  expect(regionalMachinePool(9,'legendary').map(x=>x.id)).toContain('tm50');
  expect(regionalMachinePool(8,'legendary')).toEqual([]);
 });
 it('Bulk Up modifies physical damage and defense, preserves reserve stages, caps at six',()=>{
  const s=make(bulk);
  const r=resolveGymTurn(s,action(bulk),basic,1234);
  if(r.status!=='applied')throw Error(r.reason);
  expect(r.state.player.fighters[0].sp).toBe(s.player.fighters[0].sp-kantoMoveSpCost(bulk));
  expect(r.state.player.fighters[0].effects?.attackBoosts).toBe(1);
  expect(r.state.player.fighters[0].effects?.defenseBoosts).toBe(1);
  const a=resolveGymTurn(s,basic,basic,1234),b=resolveGymTurn(gymBulkUp(s,'player'),basic,basic,1234);
  if(a.status!=='applied'||b.status!=='applied')throw Error('turn');
  expect(b.state.player.fighters[0].hp).toBeGreaterThan(a.state.player.fighters[0].hp);
  expect(b.state.leader.fighters[0].hp).toBeLessThan(a.state.leader.fighters[0].hp);
  let capped=s;for(let i=0;i<9;i++)capped=gymBulkUp(capped,'player');
  expect(capped.player.fighters[0].effects?.attackBoosts).toBe(6);
  expect(gymSpecialStat(60,1,1)).toBe(60);
  const switched=switchGymPokemon(capped,'player',1);
  expect(switched.state.player.fighters[0].effects?.defenseBoosts).toBe(6);
 });
 it('Steel Wing has a deterministic defense proc only after damage; Overheat drops Sp.Atk even after KO',()=>{
  const seeds=Array.from({length:128},(_,i)=>Math.imul(i+1,0x9e3779b9)>>>0);
  const s=make(steel);let procs=0;
  for(const seed of seeds){
   const result=resolveGymTurn(s,action(steel),basic,seed);
   if(result.status!=='applied')throw Error(result.reason);
   if(result.state.player.fighters[0].effects?.defenseBoosts===1){
    procs++;expect(result.state.leader.fighters[0].hp).toBeLessThan(1000);
   }
   expect(result.state.player.fighters[0].sp).toBe(s.player.fighters[0].sp-kantoMoveSpCost(steel));
  }
  expect(procs).toBeGreaterThan(0);
  const h=make(heat,1);
  const ko=seeds.map(seed=>resolveGymTurn(h,action(heat),basic,seed)).find(x=>x.status==='applied'&&x.state.leader.needsReplacement);
  if(ko?.status!=='applied')throw Error('no KO');
  expect(ko.state.player.fighters[0].effects?.specialAttackDrops).toBe(2);
  let capped=h;for(let i=0;i<5;i++)capped=gymOverheatDrop(capped,'player');
  expect(capped.player.fighters[0].effects?.specialAttackDrops).toBe(6);
  expect(gymSpecialStat(60,0,2)).toBe(30);
 });
});
