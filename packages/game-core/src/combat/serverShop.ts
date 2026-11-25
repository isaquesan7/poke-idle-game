import {BASIC_GEAR_CATALOG,basicGearOffer,bagExpanderOffer} from '../shop/basicGearCatalog.js';
import {createOnlineShopGear} from '../inventory/onlineOwnership.js';
import {onlineInventoryProjection} from '../inventory/serverInventory.js';
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
 const inventory=onlineInventoryProjection(raw);if(!inventory)return null;
 const items=Object.values(KANTO_BALL_SHOP_CATALOG).map(item=>{
  const owned=inspected.pocket.quantities[item.id]??0;
  const unitPrice=KANTO_BALL_SHOP_PRICE_POLICY.unitPrices[item.id];
  const unlocked=state.trainer.level>=item.trainerUnlockLevel;
  return {...item,owned,unitPrice,unlocked,maxAffordable:busy||!unlocked||(!owned&&!inventory.bag.available)?0:Math.min(item.maxPerPurchase,KANTO_SHOP_BALL_POCKET_CAP-owned,Math.floor(state.coins/unitPrice))};
 });
 const gearItems=BASIC_GEAR_CATALOG.map(item=>({...item,
  owned:inventory.equipment.filter(i=>i.templateId===item.id).length,
  canBuy:!busy&&(inventory.bag.available??0)>0&&state.coins>=item.unitPrice&&state.trainer.level>=item.requiredLevel}));
 return {coins:state.coins,priceVersion:KANTO_BALL_SHOP_PRICE_POLICY.version,busy,items,gearItems,bagExpander:bagExpanderOffer(inventory.bag.capacity-10)};
}
export function applyOnlineShopPurchase(raw:string,actionId:string,ballId:string,quantity:number){
 const projection=onlineShopProjection(raw);
 if(!projection||projection.busy||!['poke-ball','great-ball','ultra-ball'].includes(ballId)||!Number.isSafeInteger(quantity)||quantity<1)return null;
 const item=projection.items.find(i=>i.id===ballId);if(!item||quantity>item.maxAffordable)return null;
 const journal=prepareRewardJournal(raw);
 if(!journal)return null;
 const result=applyRewardEvent(journal,{id:actionId,expectedRevision:0,type:'shop-purchase',ballId,quantity});
 return result.status==='applied'?result.journal.raw:null;
}

/** Checkout only accepts an offer ID and server-generated unique ID. */
export function applyOnlineGearPurchase(raw:string,templateId:string,serverId:string){
 const projection=onlineShopProjection(raw),offer=basicGearOffer(templateId);
 if(!projection||!offer||!projection.gearItems.find(i=>i.id===templateId)?.canBuy)return null;
 const gear=createOnlineShopGear(serverId,templateId);if(!gear)return null;
 const state=JSON.parse(raw);
 if(state.inventory.gear.some((i:{id:string})=>i.id===gear.id))return null;
 state.coins-=offer.unitPrice;state.inventory.gear.push(gear);
 const purchase={itemId:templateId,instanceId:gear.id,quantity:1,cost:offer.unitPrice,currency:'coins',gear};
 const next=JSON.stringify(state);if(!onlineInventoryProjection(next))return null;
 return {raw:next,purchase};
}
