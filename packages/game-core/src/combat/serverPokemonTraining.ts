/** 23F12A — pure manual investment, same D-056 reducer as /play. */
import {STATS} from '../stats/types.js';
import {zeroStats} from '../stats/types.js';
import type {Stat} from '../stats/types.js';
import {legacyPokemonManualBudget,reduceLegacyPokemonTeamJson} from '../legacy/pokemonTeamReducer.js';
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
export function applyOnlinePokemonTraining(raw:string,uid:number,increments:unknown,reset=false){
 if(typeof reset!=='boolean'||!Number.isSafeInteger(uid)||uid<1||!increments||typeof increments!=='object'||Array.isArray(increments))
  return {status:'invalid'} as const;
 const entries=Object.entries(increments);
 if((entries.length<1&&!reset)||entries.length>6||entries.some(([stat,n])=>!STATS.includes(stat as Stat)||typeof n!=='number'||!Number.isSafeInteger(n)||n<1||n>198))
  return {status:'invalid'} as const;
 if(!prepareRewardJournal(raw))return {status:'invalid-save'} as const;
 const state=JSON.parse(raw);
 if(state.mode!=='normal')return {status:'invalid-save'} as const;
 if(state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available')
  return {status:'busy'} as const;
 const member=state.roster.find((p:{uid:number})=>p.uid===uid);
 if(!member)return {status:'missing-pokemon'} as const;
 const budget=legacyPokemonManualBudget(member.level);
 if(!member.manual||typeof member.manual!=='object'||Array.isArray(member.manual)||Object.keys(member.manual).length!==STATS.length||
   !STATS.every(s=>Number.isSafeInteger(member.manual[s])&&member.manual[s]>=0&&member.manual[s]<=budget))
  return {status:'invalid-save'} as const;
 const spent=STATS.reduce((sum,s)=>sum+member.manual[s],0);
 if(spent>budget)return {status:'invalid-save'} as const;
 if(reset&&(entries.length!==0||spent===0))return {status:'unavailable'} as const;
 if(entries.reduce((sum,[,n])=>sum+(n as number),0)>budget-spent)return {status:'unavailable'} as const;
 let candidate=raw;
 if(reset){
  const result=reduceLegacyPokemonTeamJson(candidate,{type:'reset-pokemon',uid});
  if(result.status!=='ok')return {status:'invalid-save'} as const;
  candidate=result.json;
 }
 for(const [stat,n] of entries){
  for(let i=0;i<(n as number);i++){
   const result=reduceLegacyPokemonTeamJson(candidate,{type:'invest-pokemon',uid,stat:stat as Stat});
   if(result.status!=='ok')return {status:'invalid-save'} as const;
   candidate=result.json;
  }
 }
 const after=JSON.parse(candidate).roster.find((p:{uid:number})=>p.uid===uid);
 return {status:'ok',raw:candidate,manual:after.manual,remaining:budget-STATS.reduce((sum,s)=>sum+after.manual[s],0)} as const;
}

/** Strict projection of manual points, not a client-supplied combat preview. */
export function onlinePokemonTrainingProjection(raw:string){
 if(!prepareRewardJournal(raw))return null;
 const state=JSON.parse(raw);
 if(state.mode!=='normal')return null;
 const busy=state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available';
 const pokemon=state.roster.map((p:{uid:number,pokemonId:number,level:number,manual:Record<Stat,number>})=>{
  const budget=legacyPokemonManualBudget(p.level);
  if(!p.manual||typeof p.manual!=='object'||Array.isArray(p.manual)||Object.keys(p.manual).length!==STATS.length||
   !STATS.every(s=>Number.isSafeInteger(p.manual[s])&&p.manual[s]>=0&&p.manual[s]<=budget))return null;
  const spent=STATS.reduce((sum,s)=>sum+p.manual[s],0);
  if(spent>budget)return null;
  return {uid:p.uid,speciesId:p.pokemonId,level:p.level,budget,spent,remaining:budget-spent,manual:{...zeroStats(),...p.manual}};
 });
 if(pokemon.some((p:unknown)=>p===null))return null;
 return {busy,pokemon};
}
