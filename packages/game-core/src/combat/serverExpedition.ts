/** Server-only expedition transition; PostgreSQL owns revision/idempotency.
 * Reuse the exact audited local reducer with a fresh in-memory journal for
 * one transition. Its local receipt list is never written into the online save.
 */
import {prepareRewardJournal,applyRewardEvent} from '../legacy/rewardEvents.js';
import {KANTO_REGIONS} from '../map/kantoRegions.js';
import {EXPEDITION_CYCLE_MS,MAX_EXPEDITION_CYCLES} from '../rewards/expedition.js';
import {inspectKantoBallPocket} from '../capture/kantoBallPocket.js';

export function applyOnlineExpedition(raw:string,kind:'start'|'claim'|'stop',nowMs:number,regionId?:number){
 if(!Number.isSafeInteger(nowMs)||nowMs<0)return null;
 let state;
 try{state=JSON.parse(raw);}catch{return null;}
 if(state?.mode!=='normal'||state.pendingBattle!=null||state.gymSession!=null||
   state.lastBattle?.captureStatus==='available'||inspectKantoBallPocket(state.ballPocket).status!=='valid')return null;
 if(kind==='start'){
  if(typeof regionId!=='number'||!Number.isSafeInteger(regionId)||regionId<1||regionId>10||state.expedition!==null)return null;
 }else if(kind==='claim'||kind==='stop'){
  const e=state.expedition;
  if(regionId!==undefined||!e||!Number.isSafeInteger(e.regionId)||e.regionId<1||e.regionId>10||
    !Array.isArray(e.teamUids)||e.teamUids.length!==1||e.teamUids[0]!==state.team?.[0]||
    !Number.isSafeInteger(e.lastClaimAt)||nowMs<e.lastClaimAt)return null;
 }else return null;
 const journal=prepareRewardJournal(raw);
 if(!journal)return null;
 const base={id:'server-expedition',expectedRevision:0,nowMs};
 const result=applyRewardEvent(journal,kind==='start'?{...base,type:'start-expedition',regionId:regionId!}:
  kind==='claim'?{...base,type:'claim-expedition'}:{...base,type:'stop-expedition'});
 return result.status==='applied'?result.journal.raw:null;
}

export function onlineExpeditionProjection(raw:string,nowMs:number){
 if(!Number.isSafeInteger(nowMs)||nowMs<0||!prepareRewardJournal(raw))return null;
 const state=JSON.parse(raw);
 if(state.mode!=='normal'||inspectKantoBallPocket(state.ballPocket).status!=='valid')return null;
 const leader=state.roster.find((p:{uid:number})=>p.uid===state.team[0]);
 if(!leader)return null;
 const regions=KANTO_REGIONS.map(r=>({id:r.id,name:r.name,levelMin:r.levelMin,levelMax:r.levelMax,
  trainerUnlockLevel:r.trainerUnlockLevel,unlocked:state.trainer.level>=r.trainerUnlockLevel&&leader.level>=r.levelMin}));
 const e=state.expedition;
 let expedition=null;
 if(e){
  if(!Number.isSafeInteger(e.regionId)||!regions.some(r=>r.id===e.regionId)||
   e.teamUids.length!==1||e.teamUids[0]!==leader.uid||e.lastClaimAt>nowMs)return null;
  const cycles=Math.min(MAX_EXPEDITION_CYCLES,Math.floor((nowMs-e.lastClaimAt)/EXPEDITION_CYCLE_MS));
  let preview=null;
  if(cycles>0){
   const candidate=applyOnlineExpedition(raw,'claim',nowMs);
   if(!candidate)return null;
   const claim=JSON.parse(candidate).lastClaim;
   preview={cycles:claim.cycles,coins:claim.coins,trainerXP:claim.trainerXP,pokemonXP:claim.pokemonXP,ballDrops:claim.ballDrops??{}};
  }
  expedition={regionId:e.regionId,startedAt:e.startedAt,lastClaimAt:e.lastClaimAt,leaderUid:leader.uid,cycles,preview};
 }
 return {serverNowMs:nowMs,cycleMs:EXPEDITION_CYCLE_MS,maxCycles:MAX_EXPEDITION_CYCLES,
  leader:{uid:leader.uid,speciesId:leader.pokemonId,level:leader.level},regions,expedition};
}
