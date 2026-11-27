/** Read-only learned move catalogue, using the same validator as combat. */
import {KANTO_BATTLE_SPECIES} from './kantoBattle.js';
import {kantoLevelMoves} from '../catalog/kantoLevelMoves.js';
import {kantoSupportMoves} from '../catalog/kantoSupportMoves.js';
import {frozenValidatedEquippedMoves} from './serverFrozenBattle.js';
import {validatedMachineLessons} from './serverMachineLessons.js';
import {inheritedOnlineMoves} from './serverInheritedMoves.js';
import {validatedOnlineMoveRanks} from './serverMoveRanks.js';
import {legacyMoveRankLimits} from '../legacy/pokemonMoveReducer.js';
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
export function onlineMoveProjection(raw:string){
 if(!prepareRewardJournal(raw))return null;
 const state=JSON.parse(raw);
 if(state.mode!=='normal')return null;
 const busy=state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available';
 const pokemon=state.roster.map((p:{uid:number,pokemonId:number,level:number,moveName:string,equippedMoveNames?:string[],evolutionHistory?:unknown,upgrades?:unknown,machineLessons?:unknown})=>{
  const species=KANTO_BATTLE_SPECIES[p.pokemonId];
  const names=new Set([...kantoLevelMoves(p.pokemonId,p.level),...kantoSupportMoves(p.pokemonId,p.level)].map(x=>x.move.name));
  const inherited=inheritedOnlineMoves(p.pokemonId,p.level,p.evolutionHistory,p.machineLessons);
  const machine=validatedMachineLessons(p.pokemonId,p.level,p.evolutionHistory,p.machineLessons);
  if(!inherited||!machine)return null;
  for(const name of machine.keys())names.add(name);
  for(const name of inherited.keys())names.add(name);
  if(species)names.add(species.move.name);
  const learned=[...names].flatMap(name=>{
   const move=frozenValidatedEquippedMoves(p.pokemonId,p.level,[name],p.evolutionHistory,p.machineLessons)?.[0];
   return move?[{name:move.name,type:move.type,category:move.category,power:move.power,accuracy:move.accuracy}]:[];
  });
  const equipped=p.equippedMoveNames===undefined?[p.moveName]:p.equippedMoveNames;
  const ranks=validatedOnlineMoveRanks(p.pokemonId,p.level,p.evolutionHistory,p.upgrades,p.machineLessons);
  if(!ranks)return null;
  const limits=legacyMoveRankLimits(p.level);
  const remaining=limits.skillPoints-Object.values(ranks).reduce((a,b)=>a+b,0);
  return {uid:p.uid,speciesId:p.pokemonId,level:p.level,learned,equipped,ranks,skillPoints:limits.skillPoints,maxRank:limits.maxRankPerMove,remaining,
   valid:Boolean(frozenValidatedEquippedMoves(p.pokemonId,p.level,equipped,p.evolutionHistory,p.machineLessons)?.some(move=>move.category!=='status'))};
 });
 if(pokemon.some((p:unknown)=>p===null))return null;
 return {busy,pokemon};
}
