/** ARENA02 candidate: public, versioned opponent schedule, no RNG from client.
 * A week uses a fixed schedule, repeated on every run by every account.
 * This is a balance proposal, not a battle writer. No environmental modifiers.
 */
import {arenaWeek,ARENA_FLOORS,ARENA_WEEK_MS} from './weeklyArena.js';
import {KANTO_POKEDEX} from '../catalog/kantoSpecies.js';
import type {KantoCatalogSpecies} from '../catalog/kantoSpecies.js';
import {kantoCaptureStartingLevel} from '../catalog/kantoEvolution.js';
import {compatibleSpeciesMachines} from '../catalog/kantoMachineCompatibility.js';
import type {KantoMachineId} from '../catalog/kantoMachines.js';
import {executableMachineMove} from '../combat/machineLessonCatalog.js';
import {gymTrainedMoves,gymOpponentRanks} from '../gyms/gymTactics.js';
import type {KantoMove} from '../combat/kantoBattle.js';
import {STATS} from '../stats/types.js';

export const ARENA_ROTATION_VERSION=1;
const ranges:readonly (readonly [number,number])[]=[[5,25],[26,50],[51,75],[76,100]];
const finalIds=new Set(KANTO_POKEDEX.filter(p=>!KANTO_POKEDEX.some(child=>child.evolvesFrom===p.id)).map(p=>p.id));
const totalBase=(p:KantoCatalogSpecies)=>STATS.reduce((n,s)=>n+p.base[s],0);
const offensive=(m:KantoMove)=>m.category!=='status'&&m.power>0;
// Stable integer mix, only for catalogue scheduling, not private battle RNG.
function mix(n:number){
 n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return (n^(n>>>16))>>>0;
}
const pick=<T>(values:readonly T[],seed:number)=>values[mix(seed)%values.length];
export function arenaOpponentLevel(floor:number){
 if(!Number.isSafeInteger(floor)||floor<1||floor>ARENA_FLOORS)return null;
 const [min,max]=ranges[Math.floor((floor-1)/10)]!;
 return min+Math.floor(((floor-1)%10)*(max-min)/9);
}
function eligibleSpecies(p:KantoCatalogSpecies,floor:number,level:number){
 if(p.legendary||p.mythical||kantoCaptureStartingLevel(p.id)>level)return false;
 const total=totalBase(p);
 if(floor<=10)return total<=390&&(floor>5||p.evolvesFrom===null);
 if(floor<=20)return total>=280&&total<=470;
 if(floor<=30)return total>=390&&finalIds.has(p.id);
 return total>=(floor===40?500:470)&&finalIds.has(p.id);
}
type Lesson={id:KantoMachineId;move:KantoMove};
function loadout(speciesId:number,level:number,floor:number,seed:number){
 let native:KantoMove[];
 try{native=[...gymTrainedMoves(speciesId,level)];}catch{return null;}
 if(!native.some(offensive))return null;
 // Advanced opponents use the same compatible, executable TM moves as players.
 // Do not introduce terrain/weather rules; omit forced switching and
 // context-dependent terrain moves in this initial 1v1 schedule.
 const excluded=new Set(['roar','secret-power','sunny-day','rain-dance','sandstorm','hail']);
 const compatible:Lesson[]=compatibleSpeciesMachines(speciesId).flatMap(tm=>{
  const move=executableMachineMove(tm.moveName);
  return move&&!excluded.has(tm.moveName)&&!native.some(m=>m.name===move.name)?[{id:tm.id,move}]:[];
 });
 const chosen:Lesson[]=[];
 const budget=floor>=40?3:floor>=31?2:floor>=21?1:0;
 for(let i=0;i<budget;i++){
  const remaining=compatible.filter(x=>!chosen.some(y=>y.move.name===x.move.name));
  const preferred=remaining.filter(x=>i===0?x.move.category==='status':offensive(x.move));
  const tm=pick(preferred.length?preferred:remaining,seed+i*101);
  if(!tm)break;
  chosen.push(tm);
 }
 if(budget&&chosen.length===0)return null;
 const moves=[...chosen.map(x=>x.move),...native.filter(m=>!chosen.some(x=>x.move.name===m.name))].slice(0,4);
 if(!moves.some(offensive)){
  const attack=native.find(offensive)!;
  moves[moves.length-1]=attack;
 }
 const maxRanks=gymOpponentRanks(speciesId,level,moves);
 const scale=floor<=10?0:floor<=20?.5:floor<=30?.75:1;
 const ranks=Object.fromEntries(Object.entries(maxRanks).map(([name,rank])=>[name,Math.floor(rank*scale)]));
 return {moves,tmIds:chosen.filter(x=>moves.some(m=>m.name===x.move.name)).map(x=>x.id),ranks};
}
export function weeklyArenaRotation(weekStartMs:number){
 if(arenaWeek(weekStartMs)?.startMs!==weekStartMs)return null;
 const week=Math.floor(weekStartMs/ARENA_WEEK_MS),used=new Set<number>();
 const schedule=[];
 for(let floor=1;floor<=ARENA_FLOORS;floor++){
  const level=arenaOpponentLevel(floor)!;
  const seed=mix(week^Math.imul(floor,0x9e3779b9)^ARENA_ROTATION_VERSION);
  const options=KANTO_POKEDEX.filter(p=>eligibleSpecies(p,floor,level)).flatMap(p=>{
   const kit=loadout(p.id,level,floor,mix(seed^p.id));
   return kit?[{speciesId:p.id,name:p.name,types:p.types,...kit}]:[];
  });
  const fresh=options.filter(p=>!used.has(p.speciesId));
  const selected=pick(fresh.length?fresh:options,seed);
  if(!selected)return null;
  used.add(selected.speciesId);
  schedule.push({floor,level,guardian:floor%10===0,...selected});
 }
 return {version:ARENA_ROTATION_VERSION,weekStartMs,opponents:schedule};
}
