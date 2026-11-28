/** REF01 pure private transition. The future writer must lock the save,
 * derive equipped IDs and private RNG itself, and atomically commit receipts.
 * No browser-facing route or client-selected roll. */
import {inspectOnlineInventory} from './onlineOwnership.js';
import {REFORGE_FRAGMENT_CAP,reforgeQuote,reforgeRoll,reforgeSalvage,reforgeStats} from './reforgeRules.js';
const rec=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function reforgeInventoryProjection(raw:unknown,equippedIds:readonly string[]){
 const inventory=inspectOnlineInventory(raw);if(!inventory)return null;
 const equipped=new Set(equippedIds);
 return {fragments:inventory.reforgeFragments??0,gear:inventory.gear.map(item=>({
  ...item,rank:item.enhancement??0,effectiveStats:reforgeStats(item.stats,item.enhancement??0),
  next:reforgeQuote(item.rarity,item.enhancement??0),salvage:reforgeSalvage(item.rarity,item.enhancement??0),
  equipped:equipped.has(item.id),canSalvage:!equipped.has(item.id)&&!item.favorite
 }))};
}
export function applyReforgeInventory(raw:unknown,equippedIds:readonly string[],command:unknown,privateRoll?:number){
 const inventory=inspectOnlineInventory(raw);
 if(!inventory)return {status:'invalid-inventory'} as const;
 if(!rec(command)||typeof command.kind!=='string'||typeof command.itemId!=='string')return {status:'invalid'} as const;
 const keys=Object.keys(command).sort().join(',');
 if(command.kind==='favorite'?keys!=='favorite,itemId,kind'||typeof command.favorite!=='boolean':keys!=='itemId,kind'||!['salvage','upgrade'].includes(command.kind))return {status:'invalid'} as const;
 const item=inventory.gear.find(g=>g.id===command.itemId);
 if(!item)return {status:'unavailable'} as const;
 const fragments=inventory.reforgeFragments??0,rank=item.enhancement??0;
 const replace=(patch:{enhancement?:number;favorite?:boolean})=>inventory.gear.map(g=>g.id===item.id?{...g,...patch}:g);
 if(command.kind==='favorite'){
  if((item.favorite??false)===command.favorite)return {status:'unavailable'} as const;
  const next=inspectOnlineInventory({...inventory,gear:replace({favorite:command.favorite as boolean})});
  return next?{status:'ok',kind:'favorite',inventory:next,itemId:item.id} as const:{status:'invalid-inventory'} as const;
 }
 if(command.kind==='salvage'){
  if(equippedIds.includes(item.id)||item.favorite)return {status:'protected'} as const;
  const gain=reforgeSalvage(item.rarity,rank)!;
  if(fragments+gain>REFORGE_FRAGMENT_CAP)return {status:'fragment-cap'} as const;
  const next=inspectOnlineInventory({...inventory,reforgeFragments:fragments+gain,gear:inventory.gear.filter(g=>g.id!==item.id)});
  return next?{status:'ok',kind:'salvage',inventory:next,itemId:item.id,gain} as const:{status:'invalid-inventory'} as const;
 }
 const quote=reforgeQuote(item.rarity,rank);
 if(!quote)return {status:'max-rank'} as const;
 if(fragments<quote.cost)return {status:'insufficient-fragments'} as const;
 const result=reforgeRoll(item.rarity,rank,privateRoll??-1);
 if(!result)return {status:'invalid-roll'} as const;
 const next=inspectOnlineInventory({...inventory,reforgeFragments:fragments-quote.cost,gear:replace({enhancement:result.rank})});
 return next?{status:'ok',kind:'upgrade',inventory:next,itemId:item.id,cost:quote.cost,previousRank:rank,...result} as const:{status:'invalid-inventory'} as const;
}
