/** 23F11B — private evolution adapter. Reuses D-033 without granting test items. */
import {reduceKantoEvolutionJson} from '../legacy/pokemonEvolutionReducer.js';
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
import {frozenValidatedEquippedMoves} from './serverFrozenBattle.js';
import {canonicalOnlineGymEquippedMoves} from './serverGymPreparation.js';

export function applyOnlineEvolution(raw:string,uid:number,targetSpeciesId:number){
 if(!Number.isSafeInteger(uid)||uid<1||!Number.isSafeInteger(targetSpeciesId)||targetSpeciesId<1||targetSpeciesId>151)
  return {status:'invalid'} as const;
 if(!prepareRewardJournal(raw))return {status:'invalid-save'} as const;
 const state=JSON.parse(raw);
 if(state.mode!=='normal'||state.evolutionTestKitClaimed===true)return {status:'invalid-save'} as const;
 if(state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available')
  return {status:'busy'} as const;
 const member=state.roster.find((p:{uid:number})=>p.uid===uid);
 if(!member)return {status:'missing-pokemon'} as const;
 const result=reduceKantoEvolutionJson(raw,{type:'evolve',uid,targetSpeciesId});
 if(result.status!=='ok')return {status:'unavailable'} as const;
 const after=JSON.parse(result.json);
 if(!prepareRewardJournal(result.json))return {status:'invalid-save'} as const;
 const evolved=after.roster.find((p:{uid:number})=>p.uid===uid);
 if(!evolved||evolved.pokemonId!==targetSpeciesId)return {status:'invalid-save'} as const;
 // Temporary compatibility gate: online snapshots currently validate the
 // current species learnset, not historical learned moves. Never silently
 // replace an equipped move, debit a stone, or persist an unusable fighter.
 // Resolve inherited-move provenance before exposing the evolution route.
 const equipped=evolved.equippedMoveNames??[evolved.moveName];
 const region=frozenValidatedEquippedMoves(targetSpeciesId,evolved.level,equipped);
 const gym=canonicalOnlineGymEquippedMoves(targetSpeciesId,evolved.level,equipped);
 if(!region?.some(m=>m.category!=='status')||!gym?.some(m=>m.category!=='status'))
  return {status:'loadout-incompatible'} as const;
 return {status:'ok',raw:result.json,fromSpeciesId:member.pokemonId,targetSpeciesId} as const;
}
