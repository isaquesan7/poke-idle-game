/**
 * GYM-02C2b: efeitos de status próprios da equipe 3x3.
 *
 * Estados permanecem na INSTÂNCIA ao recolher o Pokémon, sem curar HP.
 * O motor regional não é alterado. Efeitos ainda não contemplados (sono,
 * confusão e acerto secundário por impacto) devem ser recusados no turno.
 */
import type {GymBattleState,GymFighterState,GymSide} from './gymBattleState.js';
import type {KantoBattleStatus} from '../combat/kantoStatusEffects.js';

export type GymStage='attackDrops'|'defenseDrops'|'speedDrops'|'specialDefenseDrops';
export interface GymEffects {
  readonly attackDrops:number;
  readonly defenseDrops:number;
  readonly speedDrops:number;
  readonly specialDefenseDrops:number;
  readonly attackBoosts?:number;
  readonly defenseBoosts?:number;
  readonly specialAttackDrops?:number;
  readonly specialAttackBoosts?:number;
  readonly specialDefenseBoosts?:number;
}
export const GYM_EMPTY_EFFECTS:GymEffects=Object.freeze({
  attackDrops:0,defenseDrops:0,speedDrops:0,specialDefenseDrops:0
});

export function gymStatusAllowed(status:KantoBattleStatus,types:readonly string[]):boolean{
  if(status==='burn')return !types.includes('fire');
  if(status==='poison')return !types.includes('poison')&&!types.includes('steel');
  return true;
}
export function gymReplaceFighter(
  state:GymBattleState,side:GymSide,
  change:(fighter:GymFighterState)=>GymFighterState
):GymBattleState{
  if(state.outcome!=='ongoing'||state[side].needsReplacement)
    throw new RangeError('Combatente indisponível.');
  const party=state[side],idx=party.activeIndex,old=party.fighters[idx]!;
  if(old.hp<=0)throw new RangeError('Combatente desmaiado.');
  const replacement=change(old);
  if(replacement.combatant!==old.combatant||replacement.uid!==old.uid
    ||replacement.hp!==old.hp||replacement.sp!==old.sp
    ||replacement.retreatRecoveriesUsed!==old.retreatRecoveriesUsed)
    throw new RangeError('Mutação de HP/SP ou identidade não permitida.');
  const fighters=[...party.fighters] as [
    GymFighterState,GymFighterState,GymFighterState
  ];
  fighters[idx]=replacement;
  return {...state,[side]:{...party,fighters}};
}
export type GymBarrier='reflect'|'light-screen'|'safeguard';
export function gymBarrierActive(state:GymBattleState,side:GymSide,barrier:GymBarrier):boolean{
 return (state[side].barriers?.[barrier]??0)>state.turn;
}
export function gymSetBarrier(state:GymBattleState,side:GymSide,barrier:GymBarrier):GymBattleState{
 if(gymBarrierActive(state,side,barrier))return state;
 return {...state,[side]:{...state[side],barriers:{...state[side].barriers,[barrier]:state.turn+5}}};
}
export function gymBreakScreens(state:GymBattleState,side:GymSide):GymBattleState{
 if(!gymBarrierActive(state,side,'reflect')&&!gymBarrierActive(state,side,'light-screen'))return state;
 return {...state,[side]:{...state[side],barriers:{...state[side].barriers,reflect:0,'light-screen':0}}};
}
export function gymProtectedDamage(state:GymBattleState,side:GymSide,category:string,name:string,damage:number,critical:boolean):number{
 if(damage<=0||critical||name==='night-shade')return damage;
 if((category==='physical'&&gymBarrierActive(state,side,'reflect'))||
    (category==='special'&&gymBarrierActive(state,side,'light-screen')))return Math.max(1,Math.floor(damage/2));
 return damage;
}
export function gymProtectAttempt(state:GymBattleState,side:GymSide,roll:()=>number):{state:GymBattleState;success:boolean}{
 const party=state[side],old=party.protectChain;
 const repeats=old?.index===party.activeIndex&&old.lastTurn===state.turn-1?old.uses:0;
 const success=repeats===0||roll()<2**(-Math.min(8,repeats));
 return {success,state:{...state,[side]:{...party,protectChain:{index:party.activeIndex,lastTurn:state.turn,uses:success?Math.min(8,repeats+1):0}}}};
}
/** Set/clear the next forced action without modifying HP/SP or move slots. */
export function gymPendingAction(state:GymBattleState,side:GymSide,pending:GymFighterState['pendingAction']):GymBattleState{
 return gymReplaceFighter(state,side,old=>{
  const {pendingAction:previous,...rest}=old;
  return pending?{...rest,pendingAction:pending}:rest;
 });
}
/** Rest replaces the primary condition, including toxic's counter.
 * Self-induced sleep is independent of Safeguard; confusion is not a primary status.
 */
export function gymRestSleep(state:GymBattleState,side:GymSide):GymBattleState{
 return gymReplaceFighter(state,side,old=>{
  const {toxicStage,...rest}=old;
  return {...rest,status:'sleep',sleepActions:2};
 });
}
export function gymApplyStatus(
  state:GymBattleState,side:GymSide,status:KantoBattleStatus
):GymBattleState{
  const current=state[side].fighters[state[side].activeIndex]!;
  if(gymBarrierActive(state,side,'safeguard')||current.status!==null||!gymStatusAllowed(status,current.combatant.types))
    return state;
  return gymReplaceFighter(state,side,old=>({...old,status}));
}
/** Toxic occupies the ordinary poison slot but tracks its own residual counter. */
export function gymApplyToxic(state:GymBattleState,side:GymSide):GymBattleState{
 const poisoned=gymApplyStatus(state,side,'poison');
 return poisoned===state?state:gymReplaceFighter(poisoned,side,old=>({...old,toxicStage:1}));
}
export function gymTickToxic(state:GymBattleState,side:GymSide):GymBattleState{
 return gymReplaceFighter(state,side,old=>old.toxicStage===undefined?old:{...old,toxicStage:Math.min(15,old.toxicStage+1)});
}
/** Positive stages persist per instance, as existing Gym debuffs do. */
export function gymCalmMind(state:GymBattleState,side:GymSide):GymBattleState{
 return gymReplaceFighter(state,side,old=>{
  const effects=old.effects??GYM_EMPTY_EFFECTS;
  const a=effects.specialAttackBoosts??0,d=effects.specialDefenseBoosts??0;
  return a>=6&&d>=6?old:{...old,effects:{...effects,specialAttackBoosts:Math.min(6,a+1),specialDefenseBoosts:Math.min(6,d+1)}};
 });
}
/** Same individual stages/caps as Calm Mind; no permanent training change. */
export function gymBulkUp(state:GymBattleState,side:GymSide):GymBattleState{
 return gymReplaceFighter(state,side,old=>{
  const e=old.effects??GYM_EMPTY_EFFECTS;
  return {...old,effects:{...e,attackBoosts:Math.min(6,(e.attackBoosts??0)+1),defenseBoosts:Math.min(6,(e.defenseBoosts??0)+1)}};
 });
}
export function gymSteelWingBoost(state:GymBattleState,side:GymSide):GymBattleState{
 return gymReplaceFighter(state,side,old=>{
  const e=old.effects??GYM_EMPTY_EFFECTS;
  return {...old,effects:{...e,defenseBoosts:Math.min(6,(e.defenseBoosts??0)+1)}};
 });
}
export function gymOverheatDrop(state:GymBattleState,side:GymSide):GymBattleState{
 return gymReplaceFighter(state,side,old=>{
  const e=old.effects??GYM_EMPTY_EFFECTS;
  return {...old,effects:{...e,specialAttackDrops:Math.min(6,(e.specialAttackDrops??0)+2)}};
 });
}
export function gymSpecialStat(value:number,boosts:number,drops=0):number{
 const stage=boosts-drops;
 return stage>=0?Math.max(1,Math.floor(value*(2+stage)/2)):gymDamageStat(value,-stage);
}
export function gymDropStat(
  state:GymBattleState,side:GymSide,stage:GymStage
):GymBattleState{
  return gymReplaceFighter(state,side,old=>{
    const effects=old.effects??GYM_EMPTY_EFFECTS;
    if(effects[stage]>=6)return old;
    return {...old,effects:{...effects,[stage]:effects[stage]+1}};
  });
}
export function gymDamageStat(value:number,drops:number):number{
  return Math.max(1,Math.floor(value*2/(2+drops)));
}

/** Confusão não ocupa o slot de burn/poison/paralysis/sleep.
 * Duração entre 2 e 5 AÇÕES DO PRÓPRIO Pokémon, congelada na reserva.
 * Não substituir duração existente com novos acertos; válido nos dois lados.
 */
export function gymApplyConfusion(
  state:GymBattleState,side:GymSide,actions:number
):GymBattleState{
  if(!Number.isSafeInteger(actions)||actions<2||actions>5)
    throw new RangeError('Duração de confusão inválida.');
  if(gymBarrierActive(state,side,'safeguard'))return state;
  return gymReplaceFighter(state,side,old=>
    (old.confusionTurns??0)>0?old:{...old,confusionTurns:actions});
}
export function gymTickConfusion(state:GymBattleState,side:GymSide):GymBattleState{
  return gymReplaceFighter(state,side,old=>{
    const remaining=old.confusionTurns??0;
    if(remaining===0)return old;
    return {...old,confusionTurns:remaining-1};
  });
}
/** Autodano de confusão: poder40, físico, sem STAB, crítico nem vantagem
 * de tipo, fórmula base Kanto. Não é um golpe equipável e não gasta SP.
 */
export function gymConfusionSelfDamage(
  stats:Readonly<{level:number;attack:number;defense:number}>
):number{
  if(!Number.isSafeInteger(stats.level)||stats.level<1||stats.level>100
    ||!Number.isSafeInteger(stats.attack)||stats.attack<1
    ||!Number.isSafeInteger(stats.defense)||stats.defense<1)
    throw new RangeError('Atributos de confusão inválidos.');
  return Math.max(1,Math.floor(
    ((2*stats.level/5+2)*40*stats.attack/Math.max(1,stats.defense))/50+2));
}

/** Sono do motor Kanto: 1 a 3 AÇÕES próprias perdidas, preservadas ao
 * recolher Pokémon. O alvo acorda antes da próxima ação após chegar a zero.
 * Um status principal já existente não pode ser sobrescrito por sono.
 */
export function gymApplySleep(
  state:GymBattleState,side:GymSide,actions:number
):GymBattleState{
  if(!Number.isSafeInteger(actions)||actions<1||actions>3)
    throw new RangeError('Duração de sono inválida.');
  const actor=state[side].fighters[state[side].activeIndex]!;
  // Não gerar sequer uma cópia de estado quando o status já está ocupado.
  if(actor.status!==null||gymBarrierActive(state,side,'safeguard'))return state;
  return gymReplaceFighter(state,side,old=>({
    ...old,status:'sleep',sleepActions:actions
  }));
}
export function gymTickSleep(state:GymBattleState,side:GymSide):GymBattleState{
  return gymReplaceFighter(state,side,old=>{
    if(old.status!=='sleep')return old;
    const remaining=old.sleepActions??0;
    return remaining>0?{...old,sleepActions:remaining-1}:
      {...old,status:null,sleepActions:0};
  });
}
