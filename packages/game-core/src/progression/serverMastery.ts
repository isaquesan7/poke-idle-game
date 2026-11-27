/** Server-only research transition. The caller locks the authoritative save
 * and commits the returned JSON plus action receipt in one transaction. */
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
import {KANTO_MASTERY_FAMILIES,KANTO_MASTERY_CAP,kantoMasteryFamily,kantoMasteryRank,kantoResearchValue,quoteKantoResearch,masteryAchievements} from './kantoMastery.js';
import type {ResearchSnapshot} from './kantoMastery.js';
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const natural=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const families=new Set(KANTO_MASTERY_FAMILIES.map(f=>f.id));
const HISTORY_LIMIT=50;
interface ResearchItem {uid:number;speciesId:number;familyId:number;points:number}
interface ResearchEntry {at:number;items:ResearchItem[]}
interface ResearchState {points:Record<string,number>;favorites:number[];totalSent:number;history:ResearchEntry[]}
function parse(raw:string){
 if(!prepareRewardJournal(raw))return null;
 const state=JSON.parse(raw);
 if(state.mode!=='normal')return null;
 const owned=new Set<number>(state.roster.map((p:{uid:number})=>p.uid));
 const research:unknown=state.research===undefined?{points:{},favorites:[],totalSent:0,history:[]}:state.research;
 if(!record(research)||Object.keys(research).sort().join(',')!=='favorites,history,points,totalSent'||!record(research.points)||
 !Array.isArray(research.favorites)||!research.favorites.every(id=>positive(id)&&owned.has(id))||new Set(research.favorites).size!==research.favorites.length||
 !natural(research.totalSent)||!Array.isArray(research.history)||research.history.length>HISTORY_LIMIT)return null;
 for(const [id,points] of Object.entries(research.points)){
  if(String(Number(id))!==id||!families.has(Number(id))||!natural(points)||points>KANTO_MASTERY_CAP)return null;
 }
 const recent=new Set<number>(),credited:Record<string,number>={};
 for(const entry of research.history){
  if(!record(entry)||Object.keys(entry).sort().join(',')!=='at,items'||!natural(entry.at)||!Array.isArray(entry.items)||entry.items.length<1||entry.items.length>100)return null;
  for(const item of entry.items){
   if(!record(item)||Object.keys(item).sort().join(',')!=='familyId,points,speciesId,uid'||!positive(item.uid)||owned.has(item.uid)||recent.has(item.uid)||item.uid>=state.nextUid||
    !positive(item.speciesId)||!positive(item.familyId)||kantoMasteryFamily(item.speciesId)?.id!==item.familyId||
    !positive(item.points)||item.points>(kantoResearchValue(item.speciesId)??0))return null;
   recent.add(item.uid);const key=String(item.familyId);credited[key]=(credited[key]??0)+item.points;
  }
 }
 if(recent.size>research.totalSent||research.totalSent>state.nextUid-1-owned.size||
 Object.entries(credited).some(([id,n])=>n>Number((research.points as Record<string,unknown>)[id]??0)))return null;
 const data=research as unknown as ResearchState;
 const busy=state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available'||state.pendingRegionalLoot!=null||state.pendingExpeditionLoot!=null;
 const snapshot:ResearchSnapshot={roster:state.roster,team:state.team,favorites:data.favorites,points:data.points,busy};
 return {state,data,snapshot};
}
export function onlineMasteryProjection(raw:string){
 const parsed=parse(raw);if(!parsed)return null;
 const {state,data,snapshot}=parsed;
 const counts=new Map<number,number>();
 for(const p of snapshot.roster)counts.set(p.pokemonId,(counts.get(p.pokemonId)??0)+1);
 const discovered=new Set<number>([...snapshot.roster.map(p=>kantoMasteryFamily(p.pokemonId)!.id),...Object.keys(data.points).map(Number)]);
 return {busy:snapshot.busy,totalSent:data.totalSent,totalFamilies:KANTO_MASTERY_FAMILIES.length,mastered:Object.values(data.points).filter(n=>n===100).length,achievements:masteryAchievements(data.points),
  families:KANTO_MASTERY_FAMILIES.filter(f=>discovered.has(f.id)).map(f=>({...f,...kantoMasteryRank(data.points[String(f.id)]??0)!})),
  pokemon:(state.roster as {uid:number;pokemonId:number;level:number;megaForm?:unknown}[]).map(p=>{
   const familyId=kantoMasteryFamily(p.pokemonId)!.id;
   const favorite=data.favorites.includes(p.uid),inTeam=snapshot.team.includes(p.uid);
   const blocked=p.megaForm!==undefined?'mega':inTeam?'team':favorite?'favorite':(counts.get(p.pokemonId)??0)<2?'last-specimen':(data.points[String(familyId)]??0)>=100?'mastered':null;
   return {uid:p.uid,speciesId:p.pokemonId,level:p.level,megaForm:p.megaForm,familyId,favorite,inTeam,blocked,points:kantoResearchValue(p.pokemonId)};
  }),history:data.history};
}
export function applyOnlineResearch(raw:string,command:unknown,nowMs:number){
 if(!record(command)||!natural(nowMs))return {status:'invalid'} as const;
 const parsed=parse(raw);if(!parsed)return {status:'invalid-save'} as const;
 const {state,data,snapshot}=parsed;
 if(snapshot.busy)return {status:'busy'} as const;
 if(command.kind==='favorite'){
  if(Object.keys(command).sort().join(',')!=='favorite,kind,uid'||!positive(command.uid)||typeof command.favorite!=='boolean')return {status:'invalid'} as const;
  const uid=command.uid;
  if(!snapshot.roster.some(p=>p.uid===uid))return {status:'missing-pokemon'} as const;
  if(data.favorites.includes(uid)===command.favorite)return {status:'unavailable'} as const;
  data.favorites=command.favorite?[...data.favorites,uid]:data.favorites.filter(n=>n!==uid);
  state.research=data;
  return {status:'ok',raw:JSON.stringify(state),kind:'favorite',uid,favorite:command.favorite} as const;
 }
 if(command.kind!=='send'||Object.keys(command).sort().join(',')!=='kind,uids')return {status:'invalid'} as const;
 const quote=quoteKantoResearch(snapshot,command.uids);
 if(quote.status!=='ok')return {status:quote.status} as const;
 const removed=new Set(quote.items.map(p=>p.uid));
 // All individual training, moves, history and affinity live inside roster rows.
 // Do not rewrite historical battle receipts or recycle nextUid.
 state.roster=state.roster.filter((p:{uid:number})=>!removed.has(p.uid));
 for(const f of quote.families)data.points[String(f.id)]=f.after;
 data.totalSent+=removed.size;
 if(!Number.isSafeInteger(data.totalSent))return {status:'invalid-save'} as const;
 data.history=[{at:nowMs,items:quote.items},...data.history].slice(0,HISTORY_LIMIT);
 state.research=data;
 const next=JSON.stringify(state);
 if(!parse(next))return {status:'invalid-save'} as const;
 return {status:'ok',raw:next,kind:'send',items:quote.items,families:quote.families,totalPoints:quote.totalPoints} as const;
}
