/** Server-only expedition transition; PostgreSQL owns revision/idempotency.
 * Reuse the exact audited local reducer with a fresh in-memory journal for
 * one transition. Its local receipt list is never written into the online save.
 */
import {prepareRewardJournal,applyRewardEvent} from '../legacy/rewardEvents.js';
import {inspectKantoBallPocket} from '../capture/kantoBallPocket.js';

export function applyOnlineExpedition(raw:string,kind:'start'|'claim'|'stop',nowMs:number,regionId?:number){
 if(!Number.isSafeInteger(nowMs)||nowMs<0)return null;
 let state;
 try{state=JSON.parse(raw);}catch{return null;}
 if(state?.mode!=='normal'||state.pendingBattle!=null||state.gymSession!=null||
   state.lastBattle?.captureStatus==='available'||inspectKantoBallPocket(state.ballPocket).status!=='valid')return null;
 if(kind==='start'){
  if(!Number.isSafeInteger(regionId)||regionId!<1||regionId!>10||state.expedition!==null)return null;
 }else if(kind==='claim'||kind==='stop'){
  const e=state.expedition;
  if(regionId!==undefined||!e||!Number.isSafeInteger(e.regionId)||e.regionId<1||e.regionId>10||
    !Array.isArray(e.teamUids)||e.teamUids.length!==1||e.teamUids[0]!==state.team?.[0]||
    !Number.isSafeInteger(e.lastClaimAt)||nowMs<e.lastClaimAt)return null;
 }else return null;
 const journal=prepareRewardJournal(raw);
 if(!journal)return null;
 const base={id:'server-expedition',expectedRevision:0,nowMs};
 const result=applyRewardEvent(journal,kind==='start'?{...base,type:'start-expedition',regionId}:
  kind==='claim'?{...base,type:'claim-expedition'}:{...base,type:'stop-expedition'});
 return result.status==='applied'?result.journal.raw:null;
}
