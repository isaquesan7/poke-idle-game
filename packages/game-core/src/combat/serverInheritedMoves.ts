/** Private provenance: only a server-executed evolution can record this chain.
 * No inferred ancestry for wild captures; no TM, trade or future level moves.
 */
import {kantoEvolutionOptions} from '../catalog/kantoEvolution.js';
import {kantoLevelMoves} from '../catalog/kantoLevelMoves.js';
import {kantoSupportMoves} from '../catalog/kantoSupportMoves.js';
import {machineLessonEntries} from './machineLessonCatalog.js';
import {KANTO_BATTLE_SPECIES} from './kantoBattle.js';
import type {KantoMove} from './kantoBattle.js';

export interface OnlineEvolutionStep {
 readonly from:number;readonly to:number;readonly level:number;readonly moves:readonly string[];
}
export function regionalNativeMoves(speciesId:number,level:number):Map<string,KantoMove>{
 const species=KANTO_BATTLE_SPECIES[speciesId];
 if(!species)return new Map();
 const unlocked=[...kantoLevelMoves(speciesId,level),...kantoSupportMoves(speciesId,level)].map(e=>e.move);
 return new Map([...unlocked,...(!unlocked.some(m=>m.category!=='status')?[species.move]:[])].map(m=>[m.name,m]));
}
/** No history = no inherited permission. Malformed history is rejected, not ignored.
 * At each step retain only the actual equipped names validated at that level.
 */
export function inheritedOnlineMoves(speciesId:number,level:number,history:unknown,lessons?:unknown):Map<string,KantoMove>|null{
 const entries=machineLessonEntries(lessons);
 if(!entries)return null;
 if(history===undefined)return entries.every(e=>e.speciesId===speciesId)?new Map():null;
 if(!Array.isArray(history)||history.length<1||history.length>2)return null;
 let previousTo:number|undefined,previousLevel=0;
 let retained=new Map<string,KantoMove>();
 const visited=new Set<number>();
 for(const step of history){
  if(!step||typeof step!=='object'||Array.isArray(step)||Object.keys(step).sort().join(',')!=='from,level,moves,to'||
   !Number.isSafeInteger(step.from)||step.from<1||step.from>151||
   !Number.isSafeInteger(step.to)||step.to<1||step.to>151||
   !Number.isSafeInteger(step.level)||step.level<1||step.level>level||step.level<previousLevel||
   (previousTo!==undefined&&step.from!==previousTo)||
   !Array.isArray(step.moves)||step.moves.length<1||step.moves.length>4||
   !step.moves.every((n:unknown)=>typeof n==='string'&&/^[a-z][a-z-]{1,63}$/.test(n))||
   new Set(step.moves).size!==step.moves.length)return null;
  const rule=kantoEvolutionOptions(step.from).find(r=>r.to===step.to);
  if(!rule||rule.trigger==='trade'||(rule.trigger==='level'&&step.level<rule.minLevel))return null;
  visited.add(step.from);
  const legal=new Map([...retained,...regionalNativeMoves(step.from,step.level),...entries.filter(e=>visited.has(e.speciesId)).map(e=>[e.move.name,e.move] as const)]);
  const next=new Map<string,KantoMove>();
  for(const name of step.moves){const m=legal.get(name);if(!m)return null;next.set(name,m);}
  if(![...next.values()].some(m=>m.category!=='status'))return null;
  retained=next;previousTo=step.to;previousLevel=step.level;
 }
 visited.add(speciesId);
 return previousTo===speciesId&&entries.every(e=>visited.has(e.speciesId))?retained:null;
}
