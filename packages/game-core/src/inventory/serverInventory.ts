/** 23F12D1: authoritative inventory projection and private trainer loadout transition.
 * Ownership is not an acquisition mechanism. No item grants, purchases or capacity changes.
 */
import {BASE_BAG_SLOTS,inventorySlotsUsed,inventorySlotsAvailable} from './ownership.js';
import {inspectOnlineInventory,onlineGearForSlot} from './onlineOwnership.js';
import {applyReforgeInventory,reforgeInventoryProjection} from './serverReforge.js';
import {reforgeStats} from './reforgeRules.js';
import {inspectKantoBallPocket} from '../capture/kantoBallPocket.js';
import {KANTO_BALLS} from '../capture/kantoBalls.js';
import {KANTO_EVOLUTION_STONES} from '../catalog/kantoEvolution.js';
import {arenaLegendaryTemplate} from '../shop/arenaGearCatalog.js';
import {LEGACY_ITEMS,LEGACY_TITLES,legacyTitleIsUnlocked} from '../legacy/catalog.js';
import {KANTO_GYMS} from '../gyms/kantoGyms.js';
import {canonicalOnlineGymTrainerBonuses} from '../combat/serverGymPreparation.js';
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
import type {EquipmentSlot} from '../stats/trainer.js';
const SLOTS:readonly EquipmentSlot[]=['hat','jacket','gloves','pants','shoes','necklace','ring1','ring2','earrings'];
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function checked(raw:string){
 if(typeof raw!=='string'||!prepareRewardJournal(raw))return null;
 const state=JSON.parse(raw);
 const ownership=inspectOnlineInventory(state.inventory),balls=inspectKantoBallPocket(state.ballPocket);
 const bonuses=canonicalOnlineGymTrainerBonuses(state);
 if(!ownership||balls.status!=='valid'||!bonuses||!record(state.evolutionStones))return null;
 const stones=state.evolutionStones as Record<string,unknown>;
 if(Object.entries(stones).some(([id,n])=>!KANTO_EVOLUTION_STONES.some(s=>s.id===id)||typeof n!=='number'||!Number.isSafeInteger(n)||n<0))return null;
 const busy=state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available';
 return {state,inventory:ownership,balls:balls.pocket,bonuses,stones:stones as Record<string,number>,busy};
}
export function onlineInventoryProjection(raw:string){
 const c=checked(raw);if(!c)return null;
 const {state,inventory,balls,bonuses,stones,busy}=c;
 const stacks=[
  ...Object.values(KANTO_BALLS).map(b=>({id:b.id,name:b.name,kind:'ball' as const,quantity:balls.quantities[b.id]??0})),
  ...KANTO_EVOLUTION_STONES.map(s=>({id:s.id,name:s.name,kind:'stone' as const,quantity:stones[s.id]??0}))
 ].filter(s=>s.quantity>0);
 const equippedIds=new Set(bonuses.equipment.map(e=>e.itemId));
 const used=inventorySlotsUsed(Object.fromEntries(stacks.map(s=>[s.id,s.quantity])))+inventory.gear.filter(i=>!equippedIds.has(i.id)).length;
 return {busy,bag:{capacity:BASE_BAG_SLOTS+inventory.extraBagSlots,used,available:inventorySlotsAvailable(used,inventory.extraBagSlots),stacks},
  equipment:inventory.gear.map(i=>({...i,effectiveStats:reforgeStats(i.stats,i.enhancement??0),name:(arenaLegendaryTemplate(i.templateId)??LEGACY_ITEMS.find(m=>m.id===i.templateId))!.name,quantity:1,equipped:equippedIds.has(i.id),canEquip:i.requiredLevel<=state.trainer.level})),
  slots:SLOTS.map(slot=>({slot,itemId:bonuses.equipment.find(e=>e.slot===slot)?.itemId??null})),
  titles:LEGACY_TITLES.map(t=>({...t,unlocked:legacyTitleIsUnlocked(t.id,state.wins,state.seen.length,state.badges.length),active:t.id===bonuses.activeTitle})),
  badges:KANTO_GYMS.map(g=>({id:g.id,name:g.name,stats:g.badgeStats,earned:bonuses.badges.includes(g.id)})),
  totals:bonuses.totals,arenaSet:bonuses.arenaSet,
  reforge:{...reforgeInventoryProjection(inventory,[...equippedIds])!,busy}};
}
export function applyOnlineTrainerLoadout(raw:string,command:unknown){
 if(!record(command)||typeof command.kind!=='string')return {status:'invalid'} as const;
 const keys=Object.keys(command).sort().join(',');
 if(command.kind==='equipment'){
  if(keys!=='itemId,kind,slot'||!SLOTS.includes(command.slot as EquipmentSlot)||!(command.itemId===null||typeof command.itemId==='string'))return {status:'invalid'} as const;
 }else if(command.kind==='title'){
  if(keys!=='kind,titleId'||typeof command.titleId!=='string'||!LEGACY_TITLES.some(t=>t.id===command.titleId))return {status:'invalid'} as const;
 }else return {status:'invalid'} as const;
 const c=checked(raw);if(!c)return {status:'invalid-save'} as const;
 if(c.busy)return {status:'busy'} as const;
 const {state,inventory}=c;
 if(command.kind==='equipment'){
  const slot=command.slot as EquipmentSlot,itemId=command.itemId;
  const current=state.trainer.equipped[slot]||null;
  if(itemId===current)return {status:'unavailable'} as const;
  if(itemId===null){
   const projection=onlineInventoryProjection(raw);
   if(!projection||projection.bag.available===0)return {status:'bag-full'} as const;
   delete state.trainer.equipped[slot];
  }
  else{
   if(typeof itemId!=='string'||!onlineGearForSlot(inventory,itemId,slot,state.trainer.level))return {status:'unavailable'} as const;
   state.trainer.equipped[slot]=itemId;
  }
 }else{
  const id=command.titleId as string;
  if(id===state.trainer.title||!legacyTitleIsUnlocked(id,state.wins,state.seen.length,state.badges.length))return {status:'unavailable'} as const;
  state.trainer.title=id;
 }
 const next=JSON.stringify(state),projection=onlineInventoryProjection(next);
 if(!projection)return {status:'invalid-save'} as const;
 return {status:'ok',raw:next,totals:projection.totals} as const;
}

/** REF02: private save adapter. Derive ownership and equipped IDs from the
 * validated authoritative save; callers cannot supply inventory or equipment. */
export function onlineReforgeProjection(raw:string){
 const c=checked(raw);if(!c)return null;
 const view=reforgeInventoryProjection(c.inventory,c.bonuses.equipment.map(e=>e.itemId));
 return view?{...view,busy:c.busy}:null;
}
export function applyOnlineReforge(raw:string,command:unknown,privateRoll?:number){
 const c=checked(raw);if(!c)return {status:'invalid-save'} as const;
 if(c.busy)return {status:'busy'} as const;
 const result=applyReforgeInventory(c.inventory,c.bonuses.equipment.map(e=>e.itemId),command,privateRoll);
 if(result.status!=='ok')return result;
 c.state.inventory=result.inventory;
 const next=JSON.stringify(c.state);
 if(!onlineInventoryProjection(next))return {status:'invalid-save'} as const;
 const {inventory,status,...details}=result;
 return {status:'ok',raw:next,details} as const;
}
