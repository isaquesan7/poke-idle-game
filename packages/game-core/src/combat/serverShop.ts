/** 23F9A — same versioned local shop policy; no caller-supplied prices. */
import {prepareRewardJournal,applyRewardEvent} from '../legacy/rewardEvents.js';
import {inspectKantoBallPocket} from '../capture/kantoBallPocket.js';
import {KANTO_BALL_SHOP_CATALOG,KANTO_BALL_SHOP_PRICE_POLICY,KANTO_SHOP_BALL_POCKET_CAP} from '../shop/ballShop.js';
export function onlineShopProjection(raw:string){
 if(!prepareRewardJournal(raw))return null;
 const state=JSON.parse(raw);
 if(state.mode!=='normal')return null;
 const inspected=inspectKantoBallPocket(state.ballPocket);
 if(inspected.status!=='valid')return null;
 const busy=state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available';
 const items=Object.values(KANTO_BALL_SHOP_CATALOG).map(item=>{
  const owned=inspected.pocket.quantities[item.id]??0;
  const unitPrice=KANTO_BALL_SHOP_PRICE_POLICY.unitPrices[item.id];
  const unlocked=state.trainer.level>=item.trainerUnlockLevel;
  return {...item,owned,unitPrice,unlocked,maxAffordable:busy||!unlocked?0:Math.min(item.maxPerPurchase,KANTO_SHOP_BALL_POCKET_CAP-owned,Math.floor(state.coins/unitPrice))};
 });
 return {coins:state.coins,priceVersion:KANTO_BALL_SHOP_PRICE_POLICY.version,busy,items};
}
export function applyOnlineShopPurchase(raw:string,actionId:string,ballId:string,quantity:number){
 const projection=onlineShopProjection(raw);
 if(!projection||projection.busy||!['poke-ball','great-ball','ultra-ball'].includes(ballId)||!Number.isSafeInteger(quantity)||quantity<1)return null;
 const journal=prepareRewardJournal(raw);
 if(!journal)return null;
 const result=applyRewardEvent(journal,{id:actionId,expectedRevision:0,type:'shop-purchase',ballId,quantity});
 return result.status==='applied'?result.journal.raw:null;
}
