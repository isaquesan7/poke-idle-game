/** Private Santuário Mega battle adapter. No HTTP, persistence or award.
 * All fighters are derived from the server-owned save/catalog; a later
 * writer must lock the save and supply private per-turn entropy.
 */
import {quoteOnlineMegaTrial} from './serverMegaEvolution.js';
import {kantoMegaForm} from '../catalog/kantoMegaForms.js';
import type {KantoMegaFormId} from '../catalog/kantoMegaForms.js';
import {kantoMachine} from '../catalog/kantoMachines.js';
import {compatibleMachineSpecies} from '../catalog/kantoMachineCompatibility.js';
import {executableMachineMove} from './machineLessonCatalog.js';
import {canonicalOnlineGymTrainerBonuses,canonicalOnlineOwnedCombatant} from './serverGymPreparation.js';
import {gymPokemonTraining,gymOpponentRanks,prepareGymLeader} from '../gyms/gymTactics.js';
import {KANTO_GYMS} from '../gyms/kantoGyms.js';
import {pokemonFinalStats,pokemonMasteryStats} from '../stats/pokemon.js';
import {createGymBattleState} from '../gyms/gymBattleState.js';
import type {GymSideState,GymBattleState} from '../gyms/gymBattleState.js';
import {gymChooseAiAction} from '../gyms/gymAiTurn.js';
import {resolveGymTurn,GYM_MAX_TURNS} from '../gyms/gymTurn.js';
import type {Combatant,KantoMove,KantoBattleVisualFrame} from './kantoBattle.js';

const TM_LOADOUTS:Readonly<Record<KantoMegaFormId,readonly string[]>>={
 'venusaur-mega':['tm19','tm36','tm06','tm17'],
 'charizard-mega-x':['tm02','tm38','tm26','tm31'],
 'charizard-mega-y':['tm35','tm11','tm40','tm50'],
 'blastoise-mega':['tm03','tm13','tm18','tm31']
};
export function canonicalMegaTrialBoss(formId:unknown):Combatant|null{
 const form=kantoMegaForm(formId);if(!form)return null;
 const moves:KantoMove[]=[];
 for(const id of TM_LOADOUTS[form.id]){
  const tm=kantoMachine(id);
  if(!tm||!compatibleMachineSpecies(id).includes(form.speciesId))return null;
  const move=executableMachineMove(tm.moveName);if(!move)return null;
  moves.push(move);
 }
 // Candidate difficulty: full level 100 training/ranks, final gym's
 // legal trainer equipment and max mastery, no hidden HP multipliers.
 const level=100,manual=gymPokemonTraining(form.speciesId,level,moves);
 const trainer=prepareGymLeader({...KANTO_GYMS[7]!,trainerLevel:level});
 const ranks=gymOpponentRanks(form.speciesId,level,moves);
 return {speciesId:form.speciesId,megaForm:form.id,name:form.name,level,types:form.types,
  stats:pokemonMasteryStats(pokemonFinalStats(form.base,level,manual,trainer.totals,100),3),
  moves,move:moves[0]!,rank:ranks[moves[0]!.name]??0,ranks};
}
const sentinel=(party:GymSideState):GymSideState=>({...party,fighters:[party.fighters[0],{...party.fighters[1],hp:0},{...party.fighters[2],hp:0}]});
export function prepareMegaTrialBattle(raw:string,command:unknown){
 const q=quoteOnlineMegaTrial(raw,command);if(q.status!=='ok')return q;
 const source=JSON.parse(raw);
 const bonuses=canonicalOnlineGymTrainerBonuses(source);
 const student=source.roster.find((p:{uid:number})=>p.uid===q.uid);
 const player=bonuses?canonicalOnlineOwnedCombatant(source,student,bonuses):null;
 const boss=canonicalMegaTrialBoss(q.formId);
 if(!player||!boss||q.uid>=Number.MAX_SAFE_INTEGER-1)return {status:'invalid-combatants'} as const;
 const start=createGymBattleState([{uid:q.uid,combatant:player},
  {uid:Number.MAX_SAFE_INTEGER-1,combatant:player},{uid:Number.MAX_SAFE_INTEGER,combatant:player}],[boss,boss,boss]);
 const battle:GymBattleState={...start,player:sentinel(start.player),leader:sentinel(start.leader)};
 return {...q,battle} as const;
}
/** Deterministic auto battle, suitable for later replay/certification.
 * Never expose seed or accept a claimed result. No regional rewards here. */
export function resolveMegaTrialBattle(raw:string,command:unknown,seedForTurn:(turn:number)=>number){
 const prepared=prepareMegaTrialBattle(raw,command);
 if(prepared.status!=='ok')return prepared;
 if(typeof seedForTurn!=='function')return {status:'invalid-seed'} as const;
 let state=prepared.battle;
 const log:string[]=[],frames:KantoBattleVisualFrame[]=[];
 while(state.outcome==='ongoing'&&state.turn<GYM_MAX_TURNS){
  const seed=seedForTurn(state.turn+1);
  if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)return {status:'invalid-seed'} as const;
  const player=gymChooseAiAction(state,'player'),boss=gymChooseAiAction(state,'leader');
  if(player.kind==='switch'||boss.kind==='switch')return {status:'invalid-turn'} as const;
  const turn=resolveGymTurn(state,player,boss,seed);
  if(turn.status!=='applied'||turn.state.turn<=state.turn)return {status:'invalid-turn'} as const;
  state=turn.state;
  log.push(...turn.log.map(line=>line.replace(/^player\b/,prepared.battle.player.fighters[0].combatant.name).replace(/^leader\b/,prepared.battle.leader.fighters[0].combatant.name)));
  frames.push(...turn.frames);
 }
 return {status:'ok',uid:prepared.uid,formId:prepared.formId,stoneId:prepared.stoneId,
  outcome:state.outcome==='player-win'?'win':state.outcome==='leader-win'?'loss':'draw',
  turns:state.turn,log,frames,final:state} as const;
}
