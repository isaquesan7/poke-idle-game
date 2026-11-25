/** D4D: fixed starter gear, never a randomized shop roll.
 * Provisional coin price, no premium currency. The bag expander has no price
 * or purchase route until the owner approves its economic policy.
 */
import {LEGACY_ITEMS} from '../legacy/catalog.js';
import type {Stat,StatBonus} from '../stats/types.js';
export const BASIC_GEAR_PRICE=1200;
export const BAG_EXPANDER_SLOTS=5;
export const BASIC_GEAR_CATALOG=LEGACY_ITEMS.map(model=>{
 const stat=Object.keys(model.stats)[0] as Stat;
 return {id:model.id,name:model.name,slot:model.slot,stats:{[stat]:1} as StatBonus,
  rarity:'common' as const,requiredLevel:1,regionId:1,unitPrice:BASIC_GEAR_PRICE,currency:'coins' as const};
});
export function basicGearOffer(id:unknown){return BASIC_GEAR_CATALOG.find(i=>i.id===id)??null;}
export function bagExpanderOffer(extraSlots:number){
 return {id:'bag-expander',name:'Expansor de mochila',slots:BAG_EXPANDER_SLOTS,
  available:false,price:null,currency:null,withinLimit:extraSlots+BAG_EXPANDER_SLOTS<=1000};
}
