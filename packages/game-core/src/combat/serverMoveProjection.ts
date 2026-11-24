/** Read-only learned move catalogue, using the same validator as combat. */
import {KANTO_BATTLE_SPECIES} from './kantoBattle.js';
import {kantoLevelMoves} from '../catalog/kantoLevelMoves.js';
import {kantoSupportMoves} from '../catalog/kantoSupportMoves.js';
import {frozenValidatedEquippedMoves} from './serverFrozenBattle.js';
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
export function onlineMoveProjection(raw:string){
 if(!prepareRewardJournal(raw))return null;
 const state=JSON.parse(raw);
 if(state.mode!=='normal')return null;
 const busy=state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available';
 const pokemon=state.roster.map((p:{uid:number,pokemonId:number,level:number,moveName:string,equippedMoveNames?:string[]})=>{
  const species=KANTO_BATTLE_SPECIES[p.pokemonId];
  const names=new Set([...kantoLevelMoves(p.pokemonId,p.level),...kantoSupportMoves(p.pokemonId,p.level)].map(x=>x.move.name));
  if(species)names.add(species.move.name);
  const learned=[...names].flatMap(name=>{
   const move=frozenValidatedEquippedMoves(p.pokemonId,p.level,[name])?.[0];
   return move?[{name:move.name,type:move.type,category:move.category,power:move.power,accuracy:move.accuracy}]:[];
  });
  const equipped=p.equippedMoveNames??[p.moveName];
  return {uid:p.uid,speciesId:p.pokemonId,level:p.level,learned,equipped,
   valid:Boolean(frozenValidatedEquippedMoves(p.pokemonId,p.level,equipped)?.some(move=>move.category!=='status'))};
 });
 return {busy,pokemon};
}
