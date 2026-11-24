/** Read-only learned move catalogue, using the same validator as combat. */
import {KANTO_BATTLE_SPECIES} from './kantoBattle.js';
import {kantoLevelMoves} from '../catalog/kantoLevelMoves.js';
import {kantoSupportMoves} from '../catalog/kantoSupportMoves.js';
import {frozenValidatedEquippedMoves} from './serverFrozenBattle.js';
import {inheritedOnlineMoves} from './serverInheritedMoves.js';
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
export function onlineMoveProjection(raw:string){
 if(!prepareRewardJournal(raw))return null;
 const state=JSON.parse(raw);
 if(state.mode!=='normal')return null;
 const busy=state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available';
 const pokemon=state.roster.map((p:{uid:number,pokemonId:number,level:number,moveName:string,equippedMoveNames?:string[],evolutionHistory?:unknown})=>{
  const species=KANTO_BATTLE_SPECIES[p.pokemonId];
  const names=new Set([...kantoLevelMoves(p.pokemonId,p.level),...kantoSupportMoves(p.pokemonId,p.level)].map(x=>x.move.name));
  const inherited=inheritedOnlineMoves(p.pokemonId,p.level,p.evolutionHistory);
  if(!inherited)return null;
  for(const name of inherited.keys())names.add(name);
  if(species)names.add(species.move.name);
  const learned=[...names].flatMap(name=>{
   const move=frozenValidatedEquippedMoves(p.pokemonId,p.level,[name],p.evolutionHistory)?.[0];
   return move?[{name:move.name,type:move.type,category:move.category,power:move.power,accuracy:move.accuracy}]:[];
  });
  const equipped=p.equippedMoveNames??[p.moveName];
  return {uid:p.uid,speciesId:p.pokemonId,level:p.level,learned,equipped,
   valid:Boolean(frozenValidatedEquippedMoves(p.pokemonId,p.level,equipped,p.evolutionHistory)?.some(move=>move.category!=='status'))};
 });
 if(pokemon.some((p:unknown)=>p===null))return null;
 return {busy,pokemon};
}
