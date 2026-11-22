/**
 * GYM-02C2b: efeitos de status próprios da equipe 3x3.
 *
 * Estados permanecem na INSTÂNCIA ao recolher o Pokémon, sem curar HP.
 * O motor regional não é alterado. Efeitos ainda não contemplados (sono,
 * confusão e acerto secundário por impacto) devem ser recusados no turno.
 */
import type {GymBattleState,GymFighterState,GymSide} from './gymBattleState.js';
import type {KantoBattleStatus} from '../combat/kantoStatusEffects.js';

export type GymStage='attackDrops'|'defenseDrops'|'speedDrops';
export interface GymEffects {
  readonly attackDrops:number;
  readonly defenseDrops:number;
  readonly speedDrops:number;
}
export const GYM_EMPTY_EFFECTS:GymEffects=Object.freeze({
  attackDrops:0,defenseDrops:0,speedDrops:0
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
