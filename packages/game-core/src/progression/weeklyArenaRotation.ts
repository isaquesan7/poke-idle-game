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

export const ARENA_ROTATION_VERSION=2;
/** Legal training grows continuously; all endgame enemies use the full budget. */
export function arenaTrainingFraction(floor:number){return Math.min(1,Math.max(0,(floor-1)/29));}
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
/** Non-overlapping strength bands: basic forms first, then developed forms,
 * fully evolved and powerful standalone species. The last five are reserved
 * for Kanto's three legendary birds and two mythical/legendary bosses. */
const bands=[
 {first:1,last:5,min:195,max:309,stage:'basic'},
 {first:6,last:10,min:310,max:389,stage:'early'},
 {first:11,last:15,min:390,max:449,stage:'developed'},
 {first:16,last:20,min:450,max:489,stage:'final'},
 {first:21,last:25,min:490,max:514,stage:'final'},
 {first:26,last:30,min:515,max:530,stage:'final'},
 {first:31,last:34,min:534,max:555,stage:'final'},
] as const;
function eligibleSpecies(p:KantoCatalogSpecies,band:typeof bands[number],level:number){
 if(p.legendary||p.mythical||kantoCaptureStartingLevel(p.id)>level)return false;
 const total=totalBase(p);
 if(total<band.min||total>band.max)return false;
 if(band.stage==='basic')return p.evolvesFrom===null;
 if(band.stage==='developed')return p.evolvesFrom!==null||finalIds.has(p.id);
 if(band.stage==='final')return finalIds.has(p.id);
 return true;
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
 const budget=floor>=36?3:floor>=31?2:floor>=21?1:0;
 for(let i=0;i<budget;i++){
  const remaining=compatible.filter(x=>!chosen.some(y=>y.move.name===x.move.name));
  const preferred=remaining.filter(x=>i===0?x.move.category==='status':offensive(x.move)&&x.move.power>=60);
  const offensiveFallback=remaining.filter(x=>offensive(x.move));
  const tm=pick(preferred.length?preferred:offensiveFallback.length?offensiveFallback:remaining,seed+i*101);
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
 const scale=arenaTrainingFraction(floor);
 const ranks=Object.fromEntries(Object.entries(maxRanks).map(([name,rank])=>[name,Math.floor(rank*scale)]));
 return {moves,tmIds:chosen.filter(x=>moves.some(m=>m.name===x.move.name)).map(x=>x.id),ranks};
}
export function weeklyArenaRotation(weekStartMs:number){
 if(arenaWeek(weekStartMs)?.startMs!==weekStartMs)return null;
 const week=Math.floor(weekStartMs/ARENA_WEEK_MS);
 const seedFor=(floor:number)=>mix(week^Math.imul(floor,0x9e3779b9)^ARENA_ROTATION_VERSION);
 const schedule=[];
 // Choose the week's species within each band, then order by their base
 // strength. Validate the kit at every possible assigned level in that band,
 // avoiding a random weak basic species late in the rotation.
 for(const band of bands){
  const count=band.last-band.first+1;
  const pool=KANTO_POKEDEX.filter(p=>eligibleSpecies(p,band,arenaOpponentLevel(band.first)!))
   .filter(p=>Array.from({length:count},(_,i)=>band.first+i).every(floor=>!!loadout(p.id,arenaOpponentLevel(floor)!,floor,mix(seedFor(floor)^p.id))));
  const choices=[...pool].sort((x,y)=>mix(seedFor(band.first)^x.id)-mix(seedFor(band.first)^y.id)||x.id-y.id).slice(0,count)
   .sort((x,y)=>totalBase(x)-totalBase(y)||mix(seedFor(band.last)^x.id)-mix(seedFor(band.last)^y.id)||x.id-y.id);
  if(choices.length!==count)return null;
  for(const [index,p] of choices.entries()){
   const floor=band.first+index,level=arenaOpponentLevel(floor)!;
   const kit=loadout(p.id,level,floor,mix(seedFor(floor)^p.id));
   if(!kit)return null;
   schedule.push({floor,level,guardian:floor%10===0,speciesId:p.id,name:p.name,types:p.types,...kit});
  }
 }
 // Dragonite is the strongest ordinary Kanto species; the legendary birds
 // rotate in 36–38. Mew and Mewtwo anchor the two hardest, fully trained floors.
 const birds=[144,145,146].sort((x,y)=>mix(seedFor(36)^x)-mix(seedFor(36)^y)||x-y);
 const end=[149,...birds,151,150];
 for(const [index,id] of end.entries()){
  const floor=35+index,level=arenaOpponentLevel(floor)!;
  const p=KANTO_POKEDEX.find(x=>x.id===id);
  const kit=loadout(id,level,floor,mix(seedFor(floor)^id));
  if(!p||!kit||kantoCaptureStartingLevel(id)>level)return null;
  schedule.push({floor,level,guardian:floor%10===0,speciesId:id,name:p.name,types:p.types,...kit});
 }
 return {version:ARENA_ROTATION_VERSION,weekStartMs,opponents:schedule};
}
