/** Candidate endgame economy. Independent roll, no XP or affinity gate.
 * R9 0.4%, R10 1% total per certified victory; four equally weighted stones.
 * No expedition/shop/early region grants. */
import {KANTO_MEGA_FORMS} from '../catalog/kantoMegaForms.js';
import type {KantoMegaStoneId} from '../catalog/kantoMegaForms.js';
import {kantoRegion,kantoRegionalSpeciesPool} from '../map/kantoRegions.js';
import type {RegionalLootInput} from './regionalLoot.js';
export const MEGA_STONE_DROP_BPS=Object.freeze({9:40,10:100});
export function regionalMegaStoneRate(regionId:number):number{
 return regionId===9?MEGA_STONE_DROP_BPS[9]:regionId===10?MEGA_STONE_DROP_BPS[10]:0;
}
export function regionalMegaStonePool(regionId:number):readonly KantoMegaStoneId[]{
 return regionalMegaStoneRate(regionId)>0?KANTO_MEGA_FORMS.map(f=>f.stoneId):[];
}
export function rollRegionalMegaStone(input:RegionalLootInput,rng:(max:number)=>number):{megaStoneId:KantoMegaStoneId|null}|null{
 const region=kantoRegion(input.regionId);
 if(!region||typeof input.won!=='boolean'||!Number.isSafeInteger(input.trainerLevel)||input.trainerLevel<region.trainerUnlockLevel||input.trainerLevel>100||!Number.isSafeInteger(input.pokemonLevel)||input.pokemonLevel<1||input.pokemonLevel>100||!kantoRegionalSpeciesPool(region,input.wildLevel).some(p=>p.speciesId===input.speciesId)||typeof rng!=='function')return null;
 const rate=regionalMegaStoneRate(input.regionId);
 if(!rate||!input.won)return {megaStoneId:null};
 try{
  const roll=rng(10000);
  if(!Number.isSafeInteger(roll)||roll<0||roll>=10000)return null;
  if(roll>=rate)return {megaStoneId:null};
  const pool=regionalMegaStonePool(input.regionId),index=rng(pool.length);
  if(!Number.isSafeInteger(index)||index<0||index>=pool.length)return null;
  return {megaStoneId:pool[index]!};
 }catch{return null;}
}
