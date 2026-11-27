/** Canonical permanent lessons; no client permission list. Only already
 * executable player moves are eligible in this candidate. Unsupported new
 * techniques (including historical TM09) remain unavailable until implemented.
 */
import type {KantoMove} from './kantoBattle.js';
import {KANTO_MACHINES,kantoMachine,inspectMachineStock} from '../catalog/kantoMachines.js';
import {compatibleMachineSpecies,compatibleSpeciesMachines} from '../catalog/kantoMachineCompatibility.js';
import {inheritedOnlineMoves,regionalNativeMoves} from './serverInheritedMoves.js';
import {planMachineTeaching} from '../progression/kantoMachineTeaching.js';
import type {MachineLesson} from '../progression/kantoMachineTeaching.js';
import {machineRarity,TM_DROP_TIERS} from '../inventory/machineLoot.js';
import {prepareRewardJournal} from '../legacy/rewardEvents.js';

export {executableMachineMove} from './machineLessonCatalog.js';
import {executableMachineMove,machineLessonEntries} from './machineLessonCatalog.js';
/** Lessons may originate only in the actual validated chain. */
export function validatedMachineLessons(speciesId:number,level:number,history:unknown,lessons:unknown):Map<string,KantoMove>|null{
 if(!inheritedOnlineMoves(speciesId,level,history,lessons))return null;
 const entries=machineLessonEntries(lessons);
 return entries?new Map(entries.map(e=>[e.move.name,e.move])):null;
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
 const inherited=inheritedOnlineMoves(p.pokemonId,p.level,p.evolutionHistory,p.machineLessons);
 const lessons=validatedMachineLessons(p.pokemonId,p.level,p.evolutionHistory,p.machineLessons);
 if(!inherited||!lessons)return {status:'invalid-save'} as const;
 const known=new Set([...regionalNativeMoves(p.pokemonId,p.level).keys(),...inherited.keys(),...lessons.keys()]);
 const result=planMachineTeaching({stock:state.machineStock,student:{uid,speciesId:p.pokemonId,lessons:(p.machineLessons??[]) as MachineLesson[],knownMoveNames:[...known]},busy:false,tmId},{compatibleSpecies:compatibleMachineSpecies,executableMove:name=>!!executableMachineMove(name)});
 if(result.status!=='ok')return result;
 state.machineStock=result.stock;p.machineLessons=result.lessons;
 const {stock,lessons:nextLessons,...details}=result;
 return {...details,raw:JSON.stringify(state)} as const;
}

/** Positive compatibility only. Separate stock from per-UID learned state. */
export function onlineMachineProjection(raw:string){
 if(!prepareRewardJournal(raw))return null;
 const state=JSON.parse(raw);
 const stock=inspectMachineStock(state.machineStock);
 if(!stock||state.mode!=='normal')return null;
 const busy=state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available'||state.pendingRegionalLoot!=null||state.pendingExpeditionLoot!=null;
 const machines=KANTO_MACHINES.map(tm=>{
  const move=executableMachineMove(tm.moveName);
  const rarity=machineRarity(tm.id);
  return {...tm,rarity,minRegion:TM_DROP_TIERS.find(t=>t.rarity===rarity)?.minRegion??null,quantity:stock[tm.id]??0,implemented:!!move,move,compatibleSpeciesIds:compatibleMachineSpecies(tm.id)};
 });
 const pokemon=(state.roster as {uid:number;pokemonId:number;level:number;evolutionHistory?:unknown;machineLessons?:unknown}[]).map(p=>{
  const inherited=inheritedOnlineMoves(p.pokemonId,p.level,p.evolutionHistory,p.machineLessons);
  const lessons=validatedMachineLessons(p.pokemonId,p.level,p.evolutionHistory,p.machineLessons);
  if(!inherited||!lessons)return null;
  const natural=regionalNativeMoves(p.pokemonId,p.level);
  const compatible=compatibleSpeciesMachines(p.pokemonId).map(tm=>{
   const origin=lessons.has(tm.moveName)?'tm':natural.has(tm.moveName)?'level':inherited.has(tm.moveName)?'inherited':null;
   const quantity=stock[tm.id]??0,implemented=!!executableMachineMove(tm.moveName);
   return {tmId:tm.id,origin,canTeach:!busy&&!origin&&quantity>0&&implemented};
  });
  return {uid:p.uid,speciesId:p.pokemonId,compatible,learnedMachineMoves:[...lessons.values()]};
 });
 if(pokemon.some(p=>p===null))return null;
 return {busy,machines,pokemon:pokemon.filter(p=>p!==null)};
}
