/** Canonical permanent lessons; no client permission list. Only already
 * executable player moves are eligible in this candidate. Unsupported new
 * techniques (including historical TM09) remain unavailable until implemented.
 */
import {KANTO_BATTLE_MOVES} from './kantoBattle.js';
import type {KantoMove} from './kantoBattle.js';
import {KANTO_SUPPORT_MOVES} from '../catalog/kantoSupportMoves.js';
import {kantoMachine} from '../catalog/kantoMachines.js';
import {compatibleMachineSpecies} from '../catalog/kantoMachineCompatibility.js';
import {inheritedOnlineMoves,regionalNativeMoves} from './serverInheritedMoves.js';
import {planMachineTeaching} from '../progression/kantoMachineTeaching.js';
import type {MachineLesson} from '../progression/kantoMachineTeaching.js';
import {prepareRewardJournal} from '../legacy/rewardEvents.js';

export function executableMachineMove(name:string):KantoMove|null{
 return KANTO_BATTLE_MOVES[name]??KANTO_SUPPORT_MOVES[name]??null;
}
/** Caller must use the actual validated evolution chain, never all family members.
 * A lesson from an earlier real species stays learned after evolution. */
export function validatedMachineLessons(speciesId:number,level:number,history:unknown,lessons:unknown):Map<string,KantoMove>|null{
 if(!inheritedOnlineMoves(speciesId,level,history))return null;
 if(lessons===undefined)return new Map();
 if(!Array.isArray(lessons)||lessons.length>50)return null;
 const ancestry=new Set<number>([speciesId]);
 if(Array.isArray(history))for(const step of history)ancestry.add(step.from);
 const result=new Map<string,KantoMove>();
 for(const entry of lessons){
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).sort().join(',')!=='speciesId,tmId')return null;
  const tm=kantoMachine(entry.tmId);
  if(!tm||!ancestry.has(entry.speciesId)||!compatibleMachineSpecies(tm.id).includes(entry.speciesId))return null;
  const move=executableMachineMove(tm.moveName);
  if(!move||result.has(move.name))return null;
  result.set(move.name,move);
 }
 return result;
}
/** Pure server-owned candidate: stock and lesson update together; no SQL or
 * HTTP exposure until equip, ranks, evolution and battle validators are wired. */
export function applyOnlineMachineTeaching(raw:string,command:unknown){
 if(!command||typeof command!=='object'||Array.isArray(command)||Object.keys(command).sort().join(',')!=='tmId,uid')return {status:'invalid'} as const;
 const {uid,tmId}=command as {uid:unknown;tmId:unknown};
 if(typeof uid!=='number'||!Number.isSafeInteger(uid)||uid<1||!kantoMachine(tmId))return {status:'invalid'} as const;
 if(!prepareRewardJournal(raw))return {status:'invalid-save'} as const;
 const state=JSON.parse(raw);
 if(state.mode!=='normal')return {status:'invalid-save'} as const;
 if(state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available'||state.pendingRegionalLoot!=null||state.pendingExpeditionLoot!=null)return {status:'busy'} as const;
 const p=state.roster.find((x:{uid:number})=>x.uid===uid);
 if(!p)return {status:'missing-pokemon'} as const;
 const inherited=inheritedOnlineMoves(p.pokemonId,p.level,p.evolutionHistory);
 const lessons=validatedMachineLessons(p.pokemonId,p.level,p.evolutionHistory,p.machineLessons);
 if(!inherited||!lessons)return {status:'invalid-save'} as const;
 const known=new Set([...regionalNativeMoves(p.pokemonId,p.level).keys(),...inherited.keys(),...lessons.keys()]);
 const result=planMachineTeaching({stock:state.machineStock,student:{uid,speciesId:p.pokemonId,lessons:p.machineLessons as MachineLesson[]|undefined,knownMoveNames:[...known]},busy:false,tmId},{compatibleSpecies:compatibleMachineSpecies,executableMove:name=>!!executableMachineMove(name)});
 if(result.status!=='ok')return result;
 state.machineStock=result.stock;p.machineLessons=result.lessons;
 const {stock,lessons:nextLessons,...details}=result;
 return {...details,raw:JSON.stringify(state)} as const;
}
