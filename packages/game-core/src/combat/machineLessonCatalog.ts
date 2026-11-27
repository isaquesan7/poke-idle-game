/** Validate TM provenance independently of the evolution-chain validator. */
import {KANTO_BATTLE_MOVES} from './kantoBattle.js';
import type {KantoMove} from './kantoBattle.js';
import {KANTO_SUPPORT_MOVES} from '../catalog/kantoSupportMoves.js';
import {kantoMachine} from '../catalog/kantoMachines.js';
import {compatibleMachineSpecies} from '../catalog/kantoMachineCompatibility.js';
/** Historical Gen III stats already used by the Gym signatures (GYM04).
 * Rock Tomb has its canonical speed drop; Shock Wave always hits in the
 * current engine (accuracy 100, no evasion stages). No native learnset changes.
 */
const MACHINE_ONLY_MOVES:Readonly<Record<string,KantoMove>>=Object.freeze({
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
