import {describe,expect,it} from 'vitest';
import {
 KANTO_SUPPORT_SOURCE_COMMIT,kantoSupportMoves,KANTO_SUPPORT_MOVES,
 reducePokemonMoveSlotsJson,pokemonMoveSlots,KANTO_BATTLE_MOVES,simulateKantoBattle
} from '../src/index.js';
import type {Combatant} from '../src/index.js';

const initial=()=>({version:1,coins:500,trainer:{level:20},
  badges:[],team:[11,12],roster:[
    {uid:11,pokemonId:4,level:20,xp:37,affinity:66,moveName:'scratch',upgrades:{scratch:2}},
    {uid:12,pokemonId:4,level:20,xp:50,affinity:20,moveName:'scratch',upgrades:{}}
  ]});
const edit=(game:unknown,uid:number,moveName:string,operation:'add'|'remove'|'primary'|'replace-primary')=>
  reducePokemonMoveSlotsJson(JSON.stringify(game),{uid,moveName,operation});
const value=(r:ReturnType<typeof edit>)=>r.status==='ok'?JSON.parse(r.json):null;
const stats={hp:300,attack:75,defense:85,specialAttack:75,specialDefense:85,speed:60};
const p:Combatant={speciesId:4,name:'Charmander',level:20,types:['fire'],stats,
  move:KANTO_SUPPORT_MOVES.growl!,moves:[KANTO_SUPPORT_MOVES.growl!,KANTO_BATTLE_MOVES.scratch!],
  rank:0,ranks:{scratch:2}};
const w:Combatant={speciesId:7,name:'Squirtle',level:20,types:['water'],
  stats:{...stats,speed:30},move:KANTO_BATTLE_MOVES.tackle!,rank:0};

describe('slots de golpe por UID e IA determinística',()=>{
 it('suporte FRLG: nível, espécie, metadados e ausência de golpe inventado',()=>{
   expect(KANTO_SUPPORT_SOURCE_COMMIT).toBe('ac2f1acb055026e3dff1e0aca743bb46256a810a');
   expect(kantoSupportMoves(4,1).map(x=>x.move.name)).toEqual(['growl']);
   expect(kantoSupportMoves(7,4).map(x=>x.move.name)).toEqual(['tail-whip']);
   expect(kantoSupportMoves(1,15).map(x=>x.move.name)).toEqual(['growl','poison-powder','sleep-powder']);
   expect(kantoSupportMoves(25,8).map(x=>x.move.name)).toEqual(['growl','tail-whip','thunder-wave']);
   expect(kantoSupportMoves(0,1)).toEqual([]);
 });
 it('migra lazy moveName, mantém UID, XP, afinidade, ranks e o segundo Pokémon',()=>{
   const game=initial();
   expect(pokemonMoveSlots(game.roster[0],'tackle')).toEqual(['scratch']);
   const a=value(edit(game,11,'growl','add'));
   expect(a.roster[0].moveNames).toEqual(['scratch','growl']);
   expect(a.roster[0].upgrades).toEqual({scratch:2});
   expect(a.roster[1]).toEqual(game.roster[1]);
   const b=value(edit(a,11,'growl','primary'));
   expect(b.roster[0].moveNames).toEqual(['growl','scratch']);
   expect(b.roster[0].moveName).toBe('growl');
   expect(b.roster[0].xp).toBe(37);
   expect(b.coins).toBe(500);
   expect(edit(b,11,'scratch','remove').status).toBe('invalid');
   expect(value(edit(b,11,'growl','remove')).roster[0].moveNames).toEqual(['scratch']);
 });
 it('rejeita nível, UID, duplicidade, remoção única e slots forjados',()=>{
   const base=initial();
   expect(edit(base,13,'growl','add').status).toBe('invalid');
   expect(edit(base,11,'thunder-wave','add').status).toBe('invalid');
   expect(edit(base,11,'growl','remove').status).toBe('invalid');
   const added=value(edit(base,11,'growl','add'));
   expect(edit(added,11,'growl','add').status).toBe('invalid');
   expect(edit(added,11,'poison-powder','add').status).toBe('invalid');
   const wrong={...base,roster:[{...base.roster[0],moveNames:['scratch','scratch']}]};
   expect(edit(wrong,11,'growl','add').status).toBe('invalid');
 });
 it('suporte não causa dano, IA usa Growl uma vez e depois Scratch',()=>{
   const a=simulateKantoBattle(p,w,333);
   expect(a.log.some(line=>line.includes('usou growl'))).toBe(true);
   expect(a.log.some(line=>line.includes('usou scratch'))).toBe(true);
   expect(a.log.some(line=>line.includes('Ataque de Squirtle diminuiu'))).toBe(true);
   expect(a.log.filter(x=>x.includes('usou growl')).length).toBeLessThanOrEqual(1);
   expect(simulateKantoBattle(p,w,333)).toEqual(a);
   expect(a.turns).toBeLessThanOrEqual(30);
 });
 it('não aceita suporte forjado ou conjunto repetido',()=>{
   expect(()=>simulateKantoBattle({...p,moves:[p.move,p.move]},w,2)).toThrow();
   expect(()=>simulateKantoBattle({...p,move:{...p.move,accuracy:30}},w,2)).toThrow();
 });
});
