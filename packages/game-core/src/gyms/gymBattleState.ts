/**
 * GYM-02B — estado imutável dos três Pokémon durante UM confronto.
 *
 * Uma troca/KO não cria um Pokémon novo: HP, SP e condição permanecem
 * vinculados à posição (UID no lado jogador). A recuperação de SP ocorre
 * somente ao RECOLHER voluntariamente um Pokémon ainda consciente.
 * Este módulo é a fronteira de estado; o resolvedor de golpes por turnos
 * e o writer de insígnias serão implementados separadamente.
 */
import type {Combatant} from '../combat/kantoBattle.js';
import type {KantoBattleStatus} from '../combat/kantoStatusEffects.js';
import type {GymEffects} from './gymEffects.js';
import {kantoMaxSp,kantoFocusRecovery,KANTO_SP_BALANCE} from '../combat/kantoSkillEnergy.js';

export const GYM_SWITCH_RULES=Object.freeze({
  maxVoluntarySwitchesPerSide:3,
  maxRetreatRecoveryPerPokemon:1,
  retreatSpRecoveryPercent:20
});

export type GymSide='player'|'leader';
export interface GymFighterState {
  readonly combatant:Combatant;
  readonly uid:number|null;
  readonly hp:number;
  readonly sp:number;
  readonly maxSp:number;
  readonly status:KantoBattleStatus|null;
  readonly effects?:GymEffects;
  readonly confusionTurns?:number;
  readonly retreatRecoveriesUsed:number;
  readonly focusUses:number;
  readonly lastFocusTurn:number;
}
export interface GymSideState {
  readonly fighters:readonly [GymFighterState,GymFighterState,GymFighterState];
  readonly activeIndex:number;
  readonly voluntarySwitchesUsed:number;
  /** True após o Pokémon ativo cair; a substituição é obrigatória e grátis. */
  readonly needsReplacement:boolean;
}
export interface GymBattleState {
  readonly player:GymSideState;
  readonly leader:GymSideState;
  readonly outcome:'ongoing'|'player-win'|'leader-win';
  readonly turn:number;
}
export type GymStateResult=
  | {readonly status:'applied';readonly state:GymBattleState;
     readonly recoveredSp:number}
  | {readonly status:'blocked';readonly state:GymBattleState;
     readonly reason:string};

/** Cria HP/SP máximos APENAS no início de um novo confronto. */
export function createGymBattleState(
  player:readonly [Readonly<{uid:number;combatant:Combatant}>,
    Readonly<{uid:number;combatant:Combatant}>,
    Readonly<{uid:number;combatant:Combatant}>],
  leader:readonly [Combatant,Combatant,Combatant]
):GymBattleState{
  if(player.length!==3||leader.length!==3||
    new Set(player.map(p=>p.uid)).size!==3
    ||player.some(p=>!Number.isSafeInteger(p.uid)||p.uid<1))
    throw new RangeError('Cada jogador precisa de três Pokémon válidos e UIDs únicos.');
  const fighter=(combatant:Combatant,uid:number|null):GymFighterState=>{
    if(!combatant||!Number.isSafeInteger(combatant.stats?.hp)
      ||combatant.stats.hp<1||combatant.stats.hp>100000
      ||!Number.isSafeInteger(combatant.level)
      ||!Number.isSafeInteger(combatant.speciesId))
      throw new RangeError('Combatente inválido.');
    const maxSp=kantoMaxSp(combatant.level,combatant.speciesId);
    return {combatant,uid,hp:combatant.stats.hp,maxSp,sp:maxSp,
      status:null,confusionTurns:0,
      effects:{attackDrops:0,defenseDrops:0,speedDrops:0,specialDefenseDrops:0},
      retreatRecoveriesUsed:0,focusUses:0,lastFocusTurn:-100};
  };
  const p=player.map(p=>fighter(p.combatant,p.uid)) as
    unknown as [GymFighterState,GymFighterState,GymFighterState];
  const l=leader.map(c=>fighter(c,null)) as
    unknown as [GymFighterState,GymFighterState,GymFighterState];
  return {
    player:{fighters:p,activeIndex:0,voluntarySwitchesUsed:0,needsReplacement:false},
    leader:{fighters:l,activeIndex:0,voluntarySwitchesUsed:0,needsReplacement:false},
    outcome:'ongoing',turn:0
  };
}
function blocked(state:GymBattleState,reason:string):GymStateResult{
  return {status:'blocked',state,reason};
}
function sideState(state:GymBattleState,side:GymSide):GymSideState{
  return state[side];
}
function replaceSide(state:GymBattleState,side:GymSide,updated:GymSideState):GymBattleState{
  return {...state,[side]:updated};
}
function updateFighter(
  side:GymSideState,index:number,updated:GymFighterState
):GymSideState{
  const fighters=[...side.fighters] as
    [GymFighterState,GymFighterState,GymFighterState];
  fighters[index]=updated;
  return {...side,fighters};
}
function checkFighter(f:GymFighterState):void{
  if(!f||!Number.isSafeInteger(f.hp)||f.hp<0||f.hp>f.combatant.stats.hp
    ||!Number.isSafeInteger(f.sp)||f.sp<0||f.sp>f.maxSp
    ||!Number.isSafeInteger(f.retreatRecoveriesUsed)||f.retreatRecoveriesUsed<0
    ||f.retreatRecoveriesUsed>GYM_SWITCH_RULES.maxRetreatRecoveryPerPokemon
    ||!Number.isSafeInteger(f.confusionTurns??0)||(f.confusionTurns??0)<0
    ||(f.confusionTurns??0)>5
    ||!Number.isSafeInteger(f.focusUses)||f.focusUses<0
    ||f.focusUses>KANTO_SP_BALANCE.maxFocusUses
    ||!Number.isSafeInteger(f.lastFocusTurn))
    throw new RangeError('Estado individual inválido.');
}
/**
 * Somente o adversário ativo recebe dano; nenhuma restauração automática ao
 * derrotar Pokémon. Quando os três chegam a zero, o confronto acaba.
 * Esta transição recebe dano já calculado pelo motor; não concede prêmio.
 */
export function applyGymDamage(
  state:GymBattleState,side:GymSide,amount:number
):GymBattleState{
  if(state.outcome!=='ongoing'||!Number.isSafeInteger(amount)||amount<0)
    throw new RangeError('Dano ou confronto inválido.');
  const current=sideState(state,side);
  if(current.needsReplacement)throw new RangeError('Troca obrigatória pendente.');
  const active=current.fighters[current.activeIndex]!;
  checkFighter(active);
  if(active.hp===0)throw new RangeError('Pokémon já derrotado.');
  const updated=updateFighter(current,current.activeIndex,{
    ...active,hp:Math.max(0,active.hp-amount)
  });
  if(updated.fighters[current.activeIndex]!.hp>0)
    return replaceSide(state,side,updated);
  const alive=updated.fighters.some(f=>f.hp>0);
  if(!alive)return {
    ...replaceSide(state,side,{...updated,needsReplacement:false}),
    outcome:side==='leader'?'player-win':'leader-win'
  };
  return replaceSide(state,side,{...updated,needsReplacement:true});
}
/**
 * Cobrança de habilidade para o Pokémon ativo sem afetar seus companheiros.
 * A recuperação deliberada por Concentrar terá comando próprio do motor.
 */
export function spendGymSp(
  state:GymBattleState,side:GymSide,amount:number
):GymBattleState{
  if(state.outcome!=='ongoing'||!Number.isSafeInteger(amount)||amount<0)
    throw new RangeError('Custo inválido.');
  const current=sideState(state,side);
  if(current.needsReplacement)throw new RangeError('Substituição pendente.');
  const active=current.fighters[current.activeIndex]!;
  checkFighter(active);
  if(active.hp===0||active.sp<amount)throw new RangeError('SP insuficiente ou KO.');
  return replaceSide(state,side,updateFighter(current,current.activeIndex,{
    ...active,sp:active.sp-amount
  }));
}
/** Recuperação por recolhimento somente em trocas VOLUNTÁRIAS;
 * o adversário tem exatamente o mesmo limite do jogador.
 *
 * Cada lado tem três trocas voluntárias no confronto, cada Pokémon só pode
 * ganhar SP ao ser recolhido uma vez; a troca consome uma ação (motor futuro).
 * Uma substituição obrigatória após KO é grátis, mas não recupera SP.
 */
export function switchGymPokemon(
  state:GymBattleState,side:GymSide,toIndex:number
):GymStateResult{
  if(state.outcome!=='ongoing')return blocked(state,'Confronto concluído.');
  const current=sideState(state,side);
  if(!Number.isSafeInteger(toIndex)||toIndex<0||toIndex>2||
    toIndex===current.activeIndex)return blocked(state,'Destino inválido.');
  const incoming=current.fighters[toIndex]!;
  const outgoing=current.fighters[current.activeIndex]!;
  checkFighter(incoming);checkFighter(outgoing);
  if(incoming.hp===0)return blocked(state,'Não é possível trazer um Pokémon derrotado.');
  const forced=current.needsReplacement;
  if(forced&&outgoing.hp!==0)return blocked(state,'Substituição incoerente.');
  if(!forced&&(outgoing.hp===0||current.voluntarySwitchesUsed>=
    GYM_SWITCH_RULES.maxVoluntarySwitchesPerSide))
    return blocked(state,'Limite de trocas ou Pokémon ativo derrotado.');
  let updated=current;
  let recoveredSp=0;
  if(!forced&&outgoing.retreatRecoveriesUsed<
    GYM_SWITCH_RULES.maxRetreatRecoveryPerPokemon){
    recoveredSp=Math.min(outgoing.maxSp-outgoing.sp,Math.floor(
      outgoing.maxSp*GYM_SWITCH_RULES.retreatSpRecoveryPercent/100));
    updated=updateFighter(updated,current.activeIndex,{
      ...outgoing,
      sp:outgoing.sp+recoveredSp,
      // Marcar a oportunidade mesmo se SP estava cheio: evita ping-pong.
      retreatRecoveriesUsed:outgoing.retreatRecoveriesUsed+1
    });
  }
  updated={
    ...updated,activeIndex:toIndex,needsReplacement:false,
    voluntarySwitchesUsed:current.voluntarySwitchesUsed+(forced?0:1)
  };
  return {status:'applied',state:replaceSide(state,side,updated),recoveredSp};
}

/** Ações de HP legalmente curativas (ex.: Recover) serão resolvidas
 * explicitamente pelo motor, nunca por troca, KO ou substituição.
 * A API abaixo não expõe nenhuma cura implícita.
 */
export function gymTeamIsDefeated(state:GymBattleState,side:GymSide):boolean{
  return state[side].fighters.every(f=>f.hp===0);
}

/** Cura EXPLÍCITA por golpe legal, jamais efeito de troca/KO. */
export function healGymHp(state:GymBattleState,side:GymSide,amount:number):GymBattleState{
  if(state.outcome!=='ongoing'||!Number.isSafeInteger(amount)||amount<0)
    throw new RangeError('Cura inválida.');
  const party=state[side];
  if(party.needsReplacement)throw new RangeError('Substituição pendente.');
  const active=party.fighters[party.activeIndex]!;
  checkFighter(active);
  if(active.hp===0)throw new RangeError('Pokémon derrotado.');
  const healed=Math.min(active.combatant.stats.hp,active.hp+amount);
  return replaceSide(state,side,updateFighter(party,party.activeIndex,{
    ...active,hp:healed
  }));
}

/** Concentrar: até 2 vezes por instância, intervalo >=4 turnos GLOBAIS.
 * Retirar e retornar não reinicia contador/cooldown. Recuperação de troca
 * não consome Concentrar, porque tem sua própria quota de recolhimento.
 */
export function focusGymSp(state:GymBattleState,side:GymSide):GymBattleState{
  if(state.outcome!=='ongoing')throw new RangeError('Confronto concluído.');
  const party=state[side];
  if(party.needsReplacement)throw new RangeError('Substituição pendente.');
  const active=party.fighters[party.activeIndex]!;
  checkFighter(active);
  if(active.hp===0||active.sp===active.maxSp
    ||active.focusUses>=KANTO_SP_BALANCE.maxFocusUses
    ||state.turn-active.lastFocusTurn<KANTO_SP_BALANCE.focusCooldownTurns)
    throw new RangeError('Concentrar indisponível ou intervalo insuficiente.');
  const recovered=kantoFocusRecovery(active.maxSp,active.sp);
  return replaceSide(state,side,updateFighter(party,party.activeIndex,{
    ...active,sp:active.sp+recovered,focusUses:active.focusUses+1,
    lastFocusTurn:state.turn
  }));
}
