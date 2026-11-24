/** 23F12B1: pure rank candidate; NOT a production save writer.
 * Only the server may supply current species, level, evolution history and slots.
 * Historical ranks remain spent even when a move is unequipped or lost on evolution.
 */
import {legacyMoveRankLimits,reduceLegacyPokemonMoveJson} from '../legacy/pokemonMoveReducer.js';
import {inheritedOnlineMoves,regionalNativeMoves} from './serverInheritedMoves.js';
import type {OnlineEvolutionStep} from './serverInheritedMoves.js';
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
import type {KantoMove} from './kantoBattle.js';

export function validatedOnlineMoveRanks(speciesId:number,level:number,history:unknown,upgrades:unknown):Record<string,number>|null{
 if(!Number.isSafeInteger(speciesId)||speciesId<1||speciesId>151||!Number.isSafeInteger(level)||level<1||level>100)return null;
 const inherited=inheritedOnlineMoves(speciesId,level,history);
 if(!inherited)return null;
 if(upgrades===undefined)return {};
 if(!upgrades||typeof upgrades!=='object'||Array.isArray(upgrades))return null;
 const known=new Map<string,KantoMove>([...inherited,...regionalNativeMoves(speciesId,level)]);
 // A formerly native move can retain spent ranks without becoming equipable.
 if(Array.isArray(history))for(const step of history as OnlineEvolutionStep[]){
  for(const [name,move] of regionalNativeMoves(step.from,step.level))known.set(name,move);
 }
 const {skillPoints,maxRankPerMove}=legacyMoveRankLimits(level);
 const result:Record<string,number>={};let spent=0;
 for(const [name,rank] of Object.entries(upgrades)){
  const move=known.get(name);
  if(!move||move.category==='status'||move.power<=0||typeof rank!=='number'||!Number.isSafeInteger(rank)||rank<1||rank>maxRankPerMove)return null;
  spent+=rank;if(spent>skillPoints)return null;
  result[name]=rank;
 }
 return result;
}
export function applyOnlineMoveRank(raw:string,uid:number,name:string){
 if(!Number.isSafeInteger(uid)||uid<1||typeof name!=='string'||!/^[a-z][a-z-]{1,63}$/.test(name))return {status:'invalid'} as const;
 if(!prepareRewardJournal(raw))return {status:'invalid-save'} as const;
 const state=JSON.parse(raw);
 if(state.mode!=='normal')return {status:'invalid-save'} as const;
 if(state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available')return {status:'busy'} as const;
 const p=state.roster.find((entry:{uid:number})=>entry.uid===uid);
 if(!p)return {status:'missing-pokemon'} as const;
 const ranks=validatedOnlineMoveRanks(p.pokemonId,p.level,p.evolutionHistory,p.upgrades);
 const inherited=inheritedOnlineMoves(p.pokemonId,p.level,p.evolutionHistory);
 if(!ranks||!inherited)return {status:'invalid-save'} as const;
 const legal=new Map([...inherited,...regionalNativeMoves(p.pokemonId,p.level)]);
 const equipped=p.equippedMoveNames===undefined?[p.moveName]:p.equippedMoveNames;
 if(!Array.isArray(equipped)||equipped.length<1||equipped.length>4||equipped[0]!==p.moveName||
  new Set(equipped).size!==equipped.length||!equipped.every(n=>typeof n==='string'&&legal.has(n)))return {status:'invalid-save'} as const;
 const move=legal.get(name);
 if(!equipped.includes(name)||!move||move.category==='status'||move.power<=0)return {status:'illegal-move'} as const;
 const originalHasSlots=Object.hasOwn(p,'moveNames'),originalSlots=p.moveNames;
 // Adapt the online field only inside the pure legacy reducer. Never persist a second slot source.
 p.moveNames=[...equipped];
 const result=reduceLegacyPokemonMoveJson(JSON.stringify(state),{type:'upgrade-move',uid,moveName:name,movePower:move.power});
 if(result.status!=='ok')return {status:'unavailable'} as const;
 const after=JSON.parse(result.json),target=after.roster.find((entry:{uid:number})=>entry.uid===uid);
 if(originalHasSlots)target.moveNames=originalSlots;else delete target.moveNames;
 const next=validatedOnlineMoveRanks(target.pokemonId,target.level,target.evolutionHistory,target.upgrades);
 if(!next)return {status:'invalid-save'} as const;
 const limits=legacyMoveRankLimits(target.level);
 return {status:'ok',raw:JSON.stringify(after),rank:next[name]!,remaining:limits.skillPoints-Object.values(next).reduce((a,b)=>a+b,0)} as const;
}
