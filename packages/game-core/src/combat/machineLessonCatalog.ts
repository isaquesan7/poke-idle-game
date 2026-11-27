/** Validate TM provenance independently of the evolution-chain validator. */
import {KANTO_BATTLE_MOVES} from './kantoBattle.js';
import type {KantoMove} from './kantoBattle.js';
import {KANTO_TM09_COMBAT_MOVE} from '../catalog/kantoMachineCombatMoves.js';
import {GYM_NPC_SUPPORT_MOVES} from '../gyms/gymNpcSupportMoves.js';
import {KANTO_SUPPORT_MOVES} from '../catalog/kantoSupportMoves.js';
import {kantoMachine} from '../catalog/kantoMachines.js';
import {compatibleMachineSpecies} from '../catalog/kantoMachineCompatibility.js';
/** Historical Gen III stats already used by the Gym signatures (GYM04).
 * Rock Tomb has its canonical speed drop; Shock Wave always hits in the
 * current engine (accuracy 100, no evasion stages). No native learnset changes.
 */
const MACHINE_ONLY_MOVES:Readonly<Record<string,KantoMove>>=Object.freeze({
 'bullet-seed':KANTO_TM09_COMBAT_MOVE,
 // Same status definitions and SP costs used by GYM04B. No native grant.
 'toxic':GYM_NPC_SUPPORT_MOVES.toxic!,
 'calm-mind':GYM_NPC_SUPPORT_MOVES['calm-mind']!,
 'bulk-up':GYM_NPC_SUPPORT_MOVES['bulk-up']!,
 'reflect':GYM_NPC_SUPPORT_MOVES.reflect!,
 'light-screen':GYM_NPC_SUPPORT_MOVES['light-screen']!,
 'safeguard':GYM_NPC_SUPPORT_MOVES.safeguard!,
 'protect':GYM_NPC_SUPPORT_MOVES.protect!,
 'sunny-day':GYM_NPC_SUPPORT_MOVES['sunny-day']!,
 'rain-dance':GYM_NPC_SUPPORT_MOVES['rain-dance']!,
 'sandstorm':GYM_NPC_SUPPORT_MOVES.sandstorm!,
 'hail':GYM_NPC_SUPPORT_MOVES.hail!,
 rest:GYM_NPC_SUPPORT_MOVES.rest!,
 // Variable-power moves use their maximum/base for slot identity and SP.
 return:Object.freeze({name:'return',type:'normal',category:'physical',power:102,accuracy:100,priority:0}),
 frustration:Object.freeze({name:'frustration',type:'normal',category:'physical',power:102,accuracy:100,priority:0}),
 facade:Object.freeze({name:'facade',type:'normal',category:'physical',power:70,accuracy:100,priority:0}),
 'focus-punch':Object.freeze({name:'focus-punch',type:'fighting',category:'physical',power:150,accuracy:100,priority:-3}),
 taunt:GYM_NPC_SUPPORT_MOVES.taunt!,
 'double-team':GYM_NPC_SUPPORT_MOVES['double-team']!,
 'ice-beam':Object.freeze({name:'ice-beam',type:'ice',category:'special',power:95,accuracy:100,priority:0}),
 blizzard:Object.freeze({name:'blizzard',type:'ice',category:'special',power:120,accuracy:70,priority:0}),
 'solar-beam':Object.freeze({name:'solar-beam',type:'grass',category:'special',power:120,accuracy:100,priority:0}),
 dig:Object.freeze({name:'dig',type:'ground',category:'physical',power:60,accuracy:100,priority:0}),
 'hyper-beam':Object.freeze({name:'hyper-beam',type:'normal',category:'physical',power:150,accuracy:90,priority:0}),
 'thunder':Object.freeze({name:'thunder',type:'electric',category:'special',power:120,accuracy:70,priority:0}),
 'brick-break':Object.freeze({name:'brick-break',type:'fighting',category:'physical',power:75,accuracy:100,priority:0}),
 // Gen III: https://pokemondb.net/move/steel-wing and /move/overheat.
 'steel-wing':Object.freeze({name:'steel-wing',type:'steel',category:'physical',power:70,accuracy:90,priority:0}),
 'overheat':Object.freeze({name:'overheat',type:'fire',category:'special',power:140,accuracy:90,priority:0}),
 // GYM04 signatures retain the exact published combat values.
 'water-pulse':Object.freeze({name:'water-pulse',type:'water',category:'special',power:60,accuracy:100,priority:0}),
 'earthquake':Object.freeze({name:'earthquake',type:'ground',category:'physical',power:100,accuracy:100,priority:0}),
 'psychic':Object.freeze({name:'psychic',type:'psychic',category:'special',power:90,accuracy:100,priority:0}),
 // New TMs use the explicit historical Gen III category, not modern CSV category.
 // https://pokemondb.net/move/dragon-claw and /move/shadow-ball
 'dragon-claw':Object.freeze({name:'dragon-claw',type:'dragon',category:'special',power:80,accuracy:100,priority:0}),
 'shadow-ball':Object.freeze({name:'shadow-ball',type:'ghost',category:'physical',power:80,accuracy:100,priority:0}),
 'iron-tail':Object.freeze({name:'iron-tail',type:'steel',category:'physical',power:100,accuracy:75,priority:0}),
 'rock-tomb':Object.freeze({name:'rock-tomb',type:'rock',category:'physical',power:50,accuracy:80,priority:0}),
 'shock-wave':Object.freeze({name:'shock-wave',type:'electric',category:'special',power:60,accuracy:100,priority:0})
});
export function executableMachineMove(name:string):KantoMove|null{
 return KANTO_BATTLE_MOVES[name]??KANTO_SUPPORT_MOVES[name]??MACHINE_ONLY_MOVES[name]??null;
}
export function machineLessonEntries(lessons:unknown):readonly {speciesId:number;move:KantoMove}[]|null{
 if(lessons===undefined)return [];
 if(!Array.isArray(lessons)||lessons.length>50)return null;
 const result:{speciesId:number;move:KantoMove}[]=[];
 for(const entry of lessons){
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).sort().join(',')!=='speciesId,tmId')return null;
  const tm=kantoMachine(entry.tmId);
  if(!tm||!compatibleMachineSpecies(tm.id).includes(entry.speciesId))return null;
  const move=executableMachineMove(tm.moveName);
  if(!move||result.some(x=>x.move.name===move.name))return null;
  result.push({speciesId:entry.speciesId,move});
 }
 return result;
}
