/** ARENA08: only genuine equipped exclusive Arena legendary pieces count.
 * Flat bonuses are applied to the leader's final stats, not trainer totals.
 * Tier amounts are TOTALS, not additive across milestones. */
import {arenaLegendaryTemplate} from '../shop/arenaGearCatalog.js';
import {inspectOnlineInventory,onlineGearForSlot} from '../inventory/onlineOwnership.js';
import {STATS,zeroStats} from './types.js';
import type {StatValues} from './types.js';
export const ARENA_SET_TIERS=Object.freeze([{pieces:3,bonus:5},{pieces:6,bonus:10},{pieces:9,bonus:20}] as const);
export function arenaSetProjection(raw:unknown,equipped:readonly {slot:string;itemId:string}[],trainerLevel:number){
 const inventory=inspectOnlineInventory(raw);
 if(!inventory||!Number.isSafeInteger(trainerLevel)||trainerLevel<1||trainerLevel>100)return null;
 const slots=new Set<string>(),templates=new Set<string>();
 for(const entry of equipped){
  if(slots.has(entry.slot))return null;
  slots.add(entry.slot);
  const item=onlineGearForSlot(inventory,entry.itemId,entry.slot,trainerLevel);
  if(!item)return null;
  if(item.source==='arena'&&item.rarity==='legendary'&&arenaLegendaryTemplate(item.templateId))templates.add(item.templateId);
 }
 const count=templates.size;
 const bonus=count>=9?20:count>=6?10:count>=3?5:0;
 return {count,bonus,next:ARENA_SET_TIERS.find(t=>t.pieces>count)??null};
}
export function applyArenaSetStats(stats:Readonly<StatValues>,bonus:number,isLeader:boolean):StatValues{
 if(![0,5,10,20].includes(bonus))throw new RangeError('Invalid Arena set tier');
 const result=zeroStats();
 for(const stat of STATS)result[stat]=stats[stat]+(isLeader?bonus:0);
 return result;
}
