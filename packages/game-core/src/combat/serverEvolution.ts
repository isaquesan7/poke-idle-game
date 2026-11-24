/** 23F11B — private evolution adapter. Reuses D-033 without granting test items. */
import {kantoEvolutionOptions,KANTO_EVOLUTION_STONES} from '../catalog/kantoEvolution.js';
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
 const equipped=member.equippedMoveNames===undefined?[member.moveName]:member.equippedMoveNames;
 const legal=frozenValidatedEquippedMoves(member.pokemonId,member.level,equipped,member.evolutionHistory);
 if(!legal?.some(m=>m.category!=='status')||equipped[0]!==member.moveName)return {status:'loadout-incompatible'} as const;
 const history=[...(member.evolutionHistory??[]),{from:member.pokemonId,to:targetSpeciesId,level:member.level,moves:[...equipped]}];
 const region=frozenValidatedEquippedMoves(targetSpeciesId,evolved.level,equipped,history);
 const gym=canonicalOnlineGymEquippedMoves(targetSpeciesId,evolved.level,equipped,history);
 if(!region?.some(m=>m.category!=='status')||!gym?.some(m=>m.category!=='status'))return {status:'loadout-incompatible'} as const;
 evolved.evolutionHistory=history;
 return {status:'ok',raw:JSON.stringify(after),fromSpeciesId:member.pokemonId,targetSpeciesId} as const;
}

/** Requirements derived only from canonical catalog and persisted account save. */
export function onlineEvolutionProjection(raw:string){
 if(!prepareRewardJournal(raw))return null;
 const state=JSON.parse(raw);
 if(state.mode!=='normal'||state.evolutionTestKitClaimed===true)return null;
 const busy=state.expedition!==null||state.pendingBattle!=null||state.gymSession!=null||state.lastBattle?.captureStatus==='available';
 const pokemon=state.roster.map((p:{uid:number,pokemonId:number,level:number})=>({
  uid:p.uid,speciesId:p.pokemonId,level:p.level,
  options:kantoEvolutionOptions(p.pokemonId).map(rule=>{
   const stock=rule.trigger==='stone'?(state.evolutionStones?.[rule.stone]??0):0;
   const requirement=rule.trigger==='level'?'Nível '+rule.minLevel:rule.trigger==='trade'?'Troca (indisponível)':KANTO_EVOLUTION_STONES.find(s=>s.id===rule.stone)?.name??rule.stone;
   const available=!busy&&rule.trigger!=='trade'&&applyOnlineEvolution(raw,p.uid,rule.to).status==='ok';
   return {targetSpeciesId:rule.to,trigger:rule.trigger,requirement,stock,available};
  })
 }));
 return {busy,pokemon};
}
