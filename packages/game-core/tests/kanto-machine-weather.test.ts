import {describe,it,expect} from 'vitest';
import {executableMachineMove} from '../src/combat/machineLessonCatalog.js';
import {compatibleMachineSpecies} from '../src/catalog/kantoMachineCompatibility.js';
import {frozenValidatedEquippedMoves} from '../src/combat/serverFrozenBattle.js';
import {KANTO_BATTLE_MOVES} from '../src/combat/kantoBattle.js';
import type {Combatant,KantoMove} from '../src/combat/kantoBattle.js';
import {kantoMovePp,kantoMoveSpCost} from '../src/combat/kantoSkillEnergy.js';
import {createGymBattleState,switchGymPokemon} from '../src/gyms/gymBattleState.js';
import {resolveGymTurn} from '../src/gyms/gymTurn.js';
import {gymActiveWeather,gymSetWeather,gymWeatherAccuracy,gymWeatherDamage,gymWeatherResidual} from '../src/gyms/gymWeather.js';
const move=(name:string)=>executableMachineMove(name)!;
const stats={hp:1600,attack:90,defense:60,specialAttack:90,specialDefense:60,speed:90};
const basic={kind:'basic'} as const;
const action=(name:string)=>({kind:'move',moveName:name} as const);
function make(a:KantoMove,b:KantoMove=KANTO_BATTLE_MOVES.tackle!,pTypes=['normal'],lTypes=['normal']){
 const p:Combatant={speciesId:4,name:'Player',types:pTypes,level:50,stats,move:a,rank:0};
 const l:Combatant={speciesId:19,name:'Leader',types:lTypes,level:50,stats:{...stats,speed:10},move:b,rank:0};
 return createGymBattleState([{uid:1,combatant:p},{uid:2,combatant:p},{uid:3,combatant:p}],[l,l,l]);
}
describe('TM09 — weather and Thunder',()=>{
 it('verifies compatible lessons and historical data',()=>{
  for(const [id,name,pp,power] of [['tm07','hail',10,0],['tm11','sunny-day',5,0],['tm18','rain-dance',5,0],['tm25','thunder',10,120],['tm37','sandstorm',10,0]] as const){
   const m=move(name),species=compatibleMachineSpecies(id)[0]!;
   expect(m.power).toBe(power);expect(kantoMovePp(name)).toBe(pp);
   expect(frozenValidatedEquippedMoves(species,10,[name],undefined,[{tmId:id,speciesId:species}])).toEqual([m]);
   expect(frozenValidatedEquippedMoves(species,10,[name])).toBeNull();
  }
 });
 it('weather lasts five turns, persists through switches and is replaced rather than stacked',()=>{
  const s=make(move('sunny-day'),move('protect'));
  const result=resolveGymTurn(s,action('sunny-day'),action('protect'),1234);
  if(result.status!=='applied')throw Error(result.reason);
  expect(gymActiveWeather(result.state)).toBe('sunny-day');
  expect(result.state.player.fighters[0].sp).toBe(s.player.fighters[0].sp-kantoMoveSpCost(move('sunny-day')));
  expect(gymSetWeather(result.state,'sunny-day')).toBe(result.state);
  const switched=switchGymPokemon(result.state,'player',1).state;
  expect(gymActiveWeather(switched)).toBe('sunny-day');
  expect(gymActiveWeather({...switched,turn:4})).toBe('sunny-day');
  expect(gymActiveWeather({...switched,turn:5})).toBeNull();
  const rain=gymSetWeather(switched,'rain-dance');
  expect(gymActiveWeather(rain)).toBe('rain-dance');
  expect(rain.weather?.expiresAt).toBe(6);
  expect(gymWeatherDamage('sunny-day',move('water-pulse'),100)).toBe(50);
  expect(gymWeatherDamage('rain-dance',move('water-pulse'),100)).toBe(150);
  expect(gymWeatherDamage('rain-dance',move('overheat'),100)).toBe(50);
  expect(gymWeatherDamage('sunny-day',move('overheat'),100)).toBe(150);
 });
 it('sand and hail damage active Pokemon only, not reserves or immune types',()=>{
  for(const type of ['rock','ground','steel'])expect(gymWeatherResidual('sandstorm',[type],1600)).toBe(0);
  expect(gymWeatherResidual('hail',['ice'],1600)).toBe(0);
  expect(gymWeatherResidual('hail',['steel'],1600)).toBe(100);
  const s=make(move('sandstorm'),move('protect'),['ground']);
  const r=resolveGymTurn(s,action('sandstorm'),action('protect'),1234);
  if(r.status!=='applied')throw Error(r.reason);
  expect(r.state.player.fighters[0].hp).toBe(1600);
  expect(r.state.leader.fighters[0].hp).toBe(1500);
  expect(r.state.leader.fighters[1].hp).toBe(1600);
  expect(r.log.some(x=>x.includes('dano residual (sandstorm)'))).toBe(true);
 });
 it('Thunder uses rain 100%, sun 50%, normal 70% and paralysis only against nonimmune targets',()=>{
  const m=move('thunder');
  expect(gymWeatherAccuracy(null,m)).toBe(70);
  expect(gymWeatherAccuracy('rain-dance',m)).toBe(100);
  expect(gymWeatherAccuracy('sunny-day',m)).toBe(50);
  const s=gymSetWeather(make(m),'rain-dance');
  let paralysed=0;
  for(let i=0;i<64;i++){
   const seed=Math.imul(i+1,0x9e3779b9)>>>0;
   const r=resolveGymTurn(s,action('thunder'),basic,seed);
   if(r.status!=='applied')throw Error(r.reason);
   expect(r.state.leader.fighters[0].hp).toBeLessThan(1600);
   if(r.state.leader.fighters[0].status==='paralysis')paralysed++;
   const immune=gymSetWeather(make(m,KANTO_BATTLE_MOVES.tackle!,['normal'],['ground']),'rain-dance');
   const q=resolveGymTurn(immune,action('thunder'),basic,seed);
   if(q.status!=='applied')throw Error(q.reason);
   expect(q.state.leader.fighters[0].status).toBeNull();
  }
  expect(paralysed).toBeGreaterThan(0);
 });
});
