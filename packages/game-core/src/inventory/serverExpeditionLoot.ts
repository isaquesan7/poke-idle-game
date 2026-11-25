/** Bounded expedition overflow; one claim plus an optional final stop.
 * No new reward rates: preserve the exact canonical cycle computation.
 */
import {onlineInventoryProjection} from './serverInventory.js';
import {expeditionRewards} from '../rewards/expedition.js';
import type {ExpeditionBallKind} from '../rewards/expedition.js';
const kinds=['poke-ball','great-ball','ultra-ball'] as const;
const limits:Record<ExpeditionBallKind,number>={'poke-ball':4,'great-ball':2,'ultra-ball':2};
const rec=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export interface PendingExpeditionLoot{
 readonly claimAt:number;readonly quantities:Readonly<Partial<Record<ExpeditionBallKind,number>>>;
}
export function inspectPendingExpeditionLoot(value:unknown):PendingExpeditionLoot|null{
 if(!rec(value)||Object.keys(value).sort().join(',')!=='claimAt,quantities'||typeof value.claimAt!=='number'||!Number.isSafeInteger(value.claimAt)||value.claimAt<0||!rec(value.quantities))return null;
 const entries=Object.entries(value.quantities);
 if(!entries.length||entries.some(([k,n])=>!kinds.includes(k as ExpeditionBallKind)||typeof n!=='number'||!Number.isSafeInteger(n)||n<1||n>limits[k as ExpeditionBallKind]))return null;
 return {claimAt:value.claimAt,quantities:Object.fromEntries(entries)};
}
/** Compare before and canonical reducer output. Restore the old ball pocket,
 * place exactly the earned quantity (including overflow at the technical
 * stack limit), while leaving XP, coins, cursor and stop untouched.
 */
export function placeExpeditionLoot(raw:string,paidRaw:string,nowMs:number){
 try{
  const before=JSON.parse(raw),after=JSON.parse(paidRaw),exp=before.expedition;
  if(!exp||before.pendingRegionalLoot!=null||!onlineInventoryProjection(raw)||!onlineInventoryProjection(paidRaw))return null;
  const prior=before.pendingExpeditionLoot==null?null:inspectPendingExpeditionLoot(before.pendingExpeditionLoot);
  if(before.pendingExpeditionLoot!=null&&!prior)return null;
  const leader=before.roster.find((p:{uid:number})=>p.uid===exp.teamUids[0]);
  if(!leader)return null;
  const reward=expeditionRewards(nowMs-exp.lastClaimAt,{regionId:exp.regionId,pokemon:[leader],ballProgress:before.expeditionBallProgress});
  if(!reward.cycles)return paidRaw;
  if(after.lastClaim?.cycles!==reward.cycles||after.lastClaim.coins!==reward.coins||after.lastClaim.trainerXP!==reward.trainerXp||after.lastClaim.pokemonXP!==reward.pokemonXpPerMember)return null;
  const pending={...prior?.quantities},stored:Partial<Record<ExpeditionBallKind,number>>={};
  after.ballPocket=structuredClone(before.ballPocket);
  for(const kind of kinds){
   const earned=reward.ballDrops?.[kind]??0,old=after.ballPocket.quantities[kind]??0;
   const view=onlineInventoryProjection(JSON.stringify(after));if(!view)return null;
   const amount=old>0||view.bag.available>0?Math.min(earned,100000-old):0;
   if(amount>0)after.ballPocket.quantities[kind]=old+amount;
   stored[kind]=amount;
   if(earned>amount)pending[kind]=(pending[kind]??0)+earned-amount;
  }
  if(Object.keys(pending).length){
   const checked=inspectPendingExpeditionLoot({claimAt:nowMs,quantities:pending});if(!checked)return null;
   after.pendingExpeditionLoot=checked;
  }else delete after.pendingExpeditionLoot;
  after.lastClaim={...after.lastClaim,ballDrops:stored,pendingBallDrops:pending};
  return JSON.stringify(after);
 }catch{return null;}
}
/** Only existing pending quantities can be stored or explicitly discarded.
 * Can resolve during an expedition, never modifies its team or stats.
 */
export function resolvePendingExpeditionLoot(raw:string,command:unknown){
 if(!rec(command)||Object.keys(command).sort().join(',')!=='claimAt,itemId,kind'||!['expedition-loot-store','expedition-loot-discard'].includes(String(command.kind))||!kinds.includes(command.itemId as ExpeditionBallKind))return {status:'invalid'} as const;
 try{
  const state=JSON.parse(raw),p=inspectPendingExpeditionLoot(state.pendingExpeditionLoot),view=onlineInventoryProjection(raw);
  if(!view)return {status:'invalid-save'} as const;
  if(state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available')return {status:'busy'} as const;
  const id=command.itemId as ExpeditionBallKind,n=p?.quantities[id]??0;
  if(!p||p.claimAt!==command.claimAt||!n)return {status:'unavailable'} as const;
  const remaining={...p.quantities};
  if(command.kind==='expedition-loot-store'){
   const old=state.ballPocket.quantities[id]??0,amount=old>0||view.bag.available>0?Math.min(n,100000-old):0;
   if(!amount)return {status:'bag-full'} as const;
   state.ballPocket.quantities[id]=old+amount;
   if(amount<n)remaining[id]=n-amount;else delete remaining[id];
  }else delete remaining[id];
  if(Object.keys(remaining).length)state.pendingExpeditionLoot={claimAt:p.claimAt,quantities:remaining};else delete state.pendingExpeditionLoot;
  const next=JSON.stringify(state),projection=onlineInventoryProjection(next);
  return projection?{status:'ok',raw:next,totals:projection.totals} as const:{status:'invalid-save'} as const;
 }catch{return {status:'invalid-save'} as const;}
}
