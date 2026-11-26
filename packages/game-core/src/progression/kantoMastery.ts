/** Research foundation: deterministic policy and atomic batch preview.
 * No save mutation, external calls, randomness or client-supplied rewards.
 * The writer must source roster, team, favorites and points from its locked save.
 */
import {KANTO_POKEDEX,kantoSpecies} from '../catalog/kantoSpecies.js';
import {KANTO_EVOLUTION_RULES} from '../catalog/kantoEvolution.js';

export const KANTO_MASTERY_CAP=100;
export const KANTO_MASTERY_RANKS=[
 {rank:0,points:0,xpPercent:0,statPercent:0},
 {rank:1,points:5,xpPercent:2,statPercent:0},
 {rank:2,points:15,xpPercent:5,statPercent:0},
 {rank:3,points:30,xpPercent:10,statPercent:0},
 {rank:4,points:60,xpPercent:10,statPercent:1},
 {rank:5,points:100,xpPercent:10,statPercent:3}
] as const;

const parents=new Map(KANTO_EVOLUTION_RULES.map(rule=>[rule.to,rule.from]));
export function kantoMasteryFamily(speciesId:number){
 if(!kantoSpecies(speciesId))return null;
 let root=speciesId,stage=1;
 const seen=new Set<number>();
 while(parents.has(root)){
  if(seen.has(root))throw new RangeError('Cyclic Kanto evolution');
  seen.add(root);root=parents.get(root)!;stage++;
 }
 return {id:root,stage};
}
export const KANTO_MASTERY_FAMILIES=KANTO_POKEDEX.filter(p=>kantoMasteryFamily(p.id)?.id===p.id)
 .map(p=>({id:p.id,name:p.name,speciesIds:KANTO_POKEDEX.filter(s=>kantoMasteryFamily(s.id)?.id===p.id).map(s=>s.id)}));
const roots=new Set(KANTO_MASTERY_FAMILIES.map(f=>f.id));
const safePoints=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=KANTO_MASTERY_CAP;
const positive=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0;

export function kantoMasteryRank(points:number){
 if(!safePoints(points))return null;
 const current=[...KANTO_MASTERY_RANKS].reverse().find(r=>r.points<=points)!;
 const next=KANTO_MASTERY_RANKS.find(r=>r.points>points)??null;
 return {current,next,points,remaining:next?next.points-points:0};
}
/** Non-overlapping precedence. Rare normal species: catalog catch rate <= 45.
 * This is an initial balancing choice, not the region's rare-spawn label.
 */
export function kantoResearchValue(speciesId:number):number|null{
 const species=kantoSpecies(speciesId),family=kantoMasteryFamily(speciesId);
 if(!species||!family)return null;
 if(species.mythical)return 15;
 if(species.legendary)return 10;
 return Math.max(family.stage,species.captureRate<=45?3:1);
}
export interface ResearchPokemon {readonly uid:number;readonly pokemonId:number}
export interface ResearchSnapshot {
 readonly roster:readonly ResearchPokemon[];
 readonly team:readonly number[];
 readonly favorites:readonly number[];
 readonly points:Readonly<Record<string,number>>;
 readonly busy:boolean;
}
function inspect(snapshot:ResearchSnapshot){
 if(!snapshot||!Array.isArray(snapshot.roster)||!snapshot.roster.length||!Array.isArray(snapshot.team)||!snapshot.team.length||
 !Array.isArray(snapshot.favorites)||!snapshot.points||typeof snapshot.points!=='object'||Array.isArray(snapshot.points)||typeof snapshot.busy!=='boolean')return null;
 const roster=new Map<number,ResearchPokemon>(),counts=new Map<number,number>();
 for(const p of snapshot.roster){
  if(!p||!positive(p.uid)||roster.has(p.uid)||!kantoSpecies(p.pokemonId))return null;
  roster.set(p.uid,p);counts.set(p.pokemonId,(counts.get(p.pokemonId)??0)+1);
 }
 const validUids=(ids:readonly number[])=>new Set(ids).size===ids.length&&ids.every(id=>positive(id)&&roster.has(id));
 if(snapshot.team.length>3||!validUids(snapshot.team)||!validUids(snapshot.favorites))return null;
 for(const [key,n] of Object.entries(snapshot.points)){
  const id=Number(key);if(String(id)!==key||!roots.has(id)||!safePoints(n))return null;
 }
 return {roster,counts,protectedIds:new Set([...snapshot.team,...snapshot.favorites])};
}
/** Reject whole batch if any UID is missing/protected or would consume last
 * specimen of the exact species. No specimen can be sent to an already saturated family;
 * the final specimen may receive partial credit up to the cap.
 */
export function quoteKantoResearch(snapshot:ResearchSnapshot,selected:unknown){
 const state=inspect(snapshot);
 if(!state)return {status:'invalid-state'} as const;
 if(!Array.isArray(selected)||selected.length<1||selected.length>100||!selected.every(positive)||new Set(selected).size!==selected.length)return {status:'invalid-selection'} as const;
 if(snapshot.busy)return {status:'busy'} as const;
 const removed=new Map<number,number>(),byFamily=new Map<number,number>(),items:{uid:number;speciesId:number;familyId:number;points:number}[]=[];
 for(const uid of selected as number[]){
  const p=state.roster.get(uid);
  if(!p)return {status:'missing-pokemon'} as const;
  if(state.protectedIds.has(uid))return {status:'protected'} as const;
  const n=(removed.get(p.pokemonId)??0)+1;
  if(n>=(state.counts.get(p.pokemonId)??0))return {status:'last-specimen'} as const;
  removed.set(p.pokemonId,n);
  const familyId=kantoMasteryFamily(p.pokemonId)!.id,points=kantoResearchValue(p.pokemonId)!;
  const old=(snapshot.points[String(familyId)]??0)+(byFamily.get(familyId)??0);
  if(old>=KANTO_MASTERY_CAP)return {status:'mastered'} as const;
  const credit=Math.min(points,KANTO_MASTERY_CAP-old);
  byFamily.set(familyId,(byFamily.get(familyId)??0)+credit);
  items.push({uid,speciesId:p.pokemonId,familyId,points:credit});
 }
 const families=[...byFamily].map(([id,credit])=>{
  const before=snapshot.points[String(id)]??0;
  return {id,before,after:before+credit,credit,rank:kantoMasteryRank(before+credit)!.current.rank};
 });
 return {status:'ok',items,families,totalPoints:families.reduce((sum,f)=>sum+f.credit,0)} as const;
}

/** Canonical mastery bonus lookup. Missing data means zero; malformed
 * data is rejected. Only server-owned saves and frozen snapshots supply points.
 */
export function masteryBonusFromPoints(points:unknown,speciesId:number){
 const family=kantoMasteryFamily(speciesId);
 if(!family)return null;
 if(points===undefined)return kantoMasteryRank(0)!.current;
 if(!points||typeof points!=='object'||Array.isArray(points))return null;
 const values=points as Record<string,unknown>;
 for(const [id,n] of Object.entries(values)){
  if(String(Number(id))!==id||!roots.has(Number(id))||!safePoints(n))return null;
 }
 const value=values[String(family.id)]??0;
 return safePoints(value)?kantoMasteryRank(value)!.current:null;
}
export function masteryBonusFromSave(research:unknown,speciesId:number){
 if(research===undefined)return masteryBonusFromPoints(undefined,speciesId);
 if(!research||typeof research!=='object'||Array.isArray(research)||!Object.hasOwn(research,'points'))return null;
 const points=(research as {points:unknown}).points;
 return points===undefined?null:masteryBonusFromPoints(points,speciesId);
}
export function masteryPokemonXp(base:number,percent:number){
 if(!Number.isSafeInteger(base)||base<0||![0,2,5,10].includes(percent))throw new RangeError('Invalid mastery XP');
 return Math.floor(base*(100+percent)/100);
}

/** Cosmetic research titles: permanent milestones, independent of equipped combat titles. */
export function masteryAchievements(points:Readonly<Record<string,number>>){
 const mastered=KANTO_MASTERY_FAMILIES.filter(f=>points[String(f.id)]===KANTO_MASTERY_CAP).length;
 return [
  {id:'researcher-kanto',name:'Pesquisador de Kanto',target:5},
  {id:'pokemon-specialist',name:'Especialista Pokémon',target:15},
  {id:'pokemon-professor',name:'Professor Pokémon',target:30},
  {id:'species-master',name:'Mestre das Espécies',target:KANTO_MASTERY_FAMILIES.length}
 ].map(a=>({...a,progress:Math.min(mastered,a.target),unlocked:mastered>=a.target}));
}
