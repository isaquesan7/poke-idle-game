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
export function gymApplyStatus(
  state:GymBattleState,side:GymSide,status:KantoBattleStatus
):GymBattleState{
  const current=state[side].fighters[state[side].activeIndex]!;
  if(current.status!==null||!gymStatusAllowed(status,current.combatant.types))
    return state;
  return gymReplaceFighter(state,side,old=>({...old,status}));
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
