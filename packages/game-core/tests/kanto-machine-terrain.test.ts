import {describe,it,expect} from 'vitest';
import {executableMachineMove} from '../src/combat/machineLessonCatalog.js';
import {compatibleMachineSpecies} from '../src/catalog/kantoMachineCompatibility.js';
import {frozenValidatedEquippedMoves} from '../src/combat/serverFrozenBattle.js';
import {KANTO_BATTLE_MOVES} from '../src/combat/kantoBattle.js';
import type {Combatant,KantoMove} from '../src/combat/kantoBattle.js';
import {kantoMovePp,kantoMoveSpCost} from '../src/combat/kantoSkillEnergy.js';
import {createGymBattleState} from '../src/gyms/gymBattleState.js';
import {resolveGymTurn} from '../src/gyms/gymTurn.js';
import {gymBarrierActive} from '../src/gyms/gymEffects.js';
import {gymSecretPowerEffect,gymSnatchable} from '../src/gyms/gymTerrain.js';
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
describe('TM14 — terrain and Snatch',()=>{
 it('canonical compatible moves',()=>{
  for(const [id,name,pp,power,priority] of [['tm43','secret-power',20,70,0],['tm49','snatch',10,0,4]] as const){
   const m=move(name),species=compatibleMachineSpecies(id)[0]!;
   expect(m.power).toBe(power);expect(m.priority).toBe(priority);expect(kantoMovePp(name)).toBe(pp);
   expect(frozenValidatedEquippedMoves(species,10,[name],undefined,[{tmId:id,speciesId:species}])).toEqual([m]);
   expect(frozenValidatedEquippedMoves(species,10,[name])).toBeNull();
  }
 });
 it('region terrain maps to fixed effects, with 30% secondary and unchanged type',()=>{
  expect(Array.from({length:10},(_,i)=>gymSecretPowerEffect(i+1))).toEqual(['poison','flinch','flinch','attack-drop','poison','sleep','attack-drop','poison','flinch','paralysis']);
  expect(gymSecretPowerEffect(undefined)).toBe('paralysis');
  const m=move('secret-power'),s=make(m);
  let effects=0;
  for(let i=0;i<64;i++){
   const r=run({...s,regionId:4},action(m.name),basic,Math.imul(i+1,0x9e3779b9)>>>0);
   if(r.state.leader.fighters[0].effects?.attackDrops===1)effects++;
   expect(r.state.player.fighters[0].combatant.move.type).toBe('normal');
   expect(r.state.player.fighters[0].sp).toBe(s.player.fighters[0].sp-kantoMoveSpCost(m));
  }
  expect(effects).toBeGreaterThan(0);expect(effects).toBeLessThan(64);
 });
 it('Snatch steals one eligible support, not an attack, Protect or weather',()=>{
  const m=move('snatch'),s=make(m,move('calm-mind'));
  const r=run(s,action('snatch'),action('calm-mind')).state;
  expect(r.player.fighters[0].effects?.specialAttackBoosts).toBe(1);
  expect(r.leader.fighters[0].effects?.specialAttackBoosts??0).toBe(0);
  expect(r.player.fighters[0].sp).toBe(s.player.fighters[0].sp-kantoMoveSpCost(m));
  expect(r.leader.fighters[0].sp).toBe(s.leader.fighters[0].sp-kantoMoveSpCost(move('calm-mind')));
  const b=run(make(m,move('reflect')),action('snatch'),action('reflect')).state;
  expect(gymBarrierActive(b,'player','reflect')).toBe(true);
  expect(gymBarrierActive(b,'leader','reflect')).toBe(false);
  expect(gymSnatchable('protect')).toBe(false);expect(gymSnatchable('rain-dance')).toBe(false);
  const hit=run(make(m),action('snatch'),basic).state;
  expect(hit.player.fighters[0].hp).toBeLessThan(1600);
 });
});
