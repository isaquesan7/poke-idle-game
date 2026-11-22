/**
 * GYM-02C1: resolvedor puro de rodadas 3x3 para dano, ataques e trocas.
 *
 * Deliberadamente NÃO conecta save/UI, recompensas ou ataques de status.
 * O catálogo de suporte, drenagem, efeitos secundários, Concentrar e duração
 * de condições exigem o próximo recorte antes dos Ginásios jogáveis.
 */
import type {Combatant,KantoMove} from '../combat/kantoBattle.js';
import {kantoDamage} from '../combat/kantoBattle.js';
import {kantoMoveSecondaryEffect,kantoPerHitSecondaryEffect} from '../combat/kantoStatusEffects.js';
import {kantoRollHitCount} from '../combat/kantoMultiHit.js';
import {kantoSupportEffect} from '../catalog/kantoSupportMoves.js';
import {kantoMoveSpCost,KANTO_BASIC_ATTACK,KANTO_SP_BALANCE} from '../combat/kantoSkillEnergy.js';
import {applyGymDamage,spendGymSp,switchGymPokemon,healGymHp,focusGymSp} from './gymBattleState.js';
import type {GymBattleState,GymSide,GymFighterState} from './gymBattleState.js';

export type GymTurnAction=
  | {readonly kind:'switch';readonly toIndex:number}
  | {readonly kind:'basic'}
  | {readonly kind:'focus'}
  | {readonly kind:'move';readonly moveName:string};

export type GymTurnResult=
  | {readonly status:'applied';readonly state:GymBattleState;
      readonly log:readonly string[];readonly seedAfter:number}
  | {readonly status:'blocked';readonly state:GymBattleState;readonly reason:string};

const other=(side:GymSide):GymSide=>side==='player'?'leader':'player';
const failure=(state:GymBattleState,reason:string):GymTurnResult=>
  ({status:'blocked',state,reason});
type Validated={readonly action:GymTurnAction;readonly move:KantoMove|null;
  readonly priority:number};

function validateAction(
  state:GymBattleState,side:GymSide,action:GymTurnAction
):Validated|null{
  const party=state[side];
  if(!action||typeof action!=='object'||!('kind' in action))return null;
  if(party.needsReplacement){
    if(action.kind!=='switch')return null;
    const target=party.fighters[action.toIndex];
    return target&&action.toIndex!==party.activeIndex&&target.hp>0
      ?{action,move:null,priority:99}:null;
  }
  if(action.kind==='switch'){
    if(!Number.isSafeInteger(action.toIndex)||action.toIndex<0||action.toIndex>2
      ||action.toIndex===party.activeIndex
      ||party.voluntarySwitchesUsed>=3
      ||party.fighters[action.toIndex]?.hp===0)return null;
    return {action,move:null,priority:6};
  }
  const active=party.fighters[party.activeIndex];
  if(!active||active.hp<=0)return null;
  if(action.kind==='basic')
    return {action,move:KANTO_BASIC_ATTACK,priority:KANTO_BASIC_ATTACK.priority};
  if(action.kind==='focus'){
    if(active.sp===active.maxSp
      ||active.focusUses>=KANTO_SP_BALANCE.maxFocusUses
      ||state.turn-active.lastFocusTurn<KANTO_SP_BALANCE.focusCooldownTurns)return null;
    return {action,move:null,priority:0};
  }
  if(action.kind!=='move'||typeof action.moveName!=='string')return null;
  const move=(active.combatant.moves??[active.combatant.move])
    .find(m=>m.name===action.moveName);
  if(!move||move.name===KANTO_BASIC_ATTACK.name
    ||(move.category==='status'&&kantoSupportEffect(move.name)?.kind!=='heal')
    ||(move.category==='status'&&active.hp===active.combatant.stats.hp)
    ||kantoMoveSecondaryEffect(move.name)!==null
    ||kantoPerHitSecondaryEffect(move.name)!==null
    ||kantoMoveSpCost(move)>active.sp)return null;
  return {action,move,priority:move.priority};
}
function combatantUsing(fighter:GymFighterState,move:KantoMove):Combatant{
  const {moves:_unused,...actor}=fighter.combatant;
  return {...actor,move,
    rank:move.name===KANTO_BASIC_ATTACK.name?0:
      fighter.combatant.ranks?.[move.name]??fighter.combatant.rank};
}

/** Cada rodada recebe seed uint32 explícita. Não consulta Date/Math.random.
 * Uma troca VOLUNTÁRIA tem prioridade e substitui a ação de ataque; o
 * oponente pode atingir o Pokémon recém-entrado no mesmo turno.
 * KO só permite substituição FORÇADA em uma etapa de entrada gratuita:
 * ninguém ganha ação extra de ataque enquanto essa escolha é feita.
 */
export function resolveGymTurn(
  input:GymBattleState,playerAction:GymTurnAction,
  leaderAction:GymTurnAction,seed:number
):GymTurnResult{
  if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)
    return failure(input,'Seed inválida.');
  if(input.outcome!=='ongoing')return failure(input,'Confronto concluído.');
  const p=validateAction(input,'player',playerAction);
  const l=validateAction(input,'leader',leaderAction);
  if(!p||!l)return failure(input,'Ação inválida, golpe sem SP ou troca indisponível.');
  const forced=input.player.needsReplacement||input.leader.needsReplacement;
  if(forced){
    // A escolha de substituição depois do KO nunca gera ataque gratuito.
    if(input.player.needsReplacement&&playerAction.kind!=='switch'
      ||input.leader.needsReplacement&&leaderAction.kind!=='switch')
      return failure(input,'Substituição obrigatória pendente.');
    if(!input.player.needsReplacement&&playerAction.kind!=='basic'
      ||!input.leader.needsReplacement&&leaderAction.kind!=='basic')
      return failure(input,'Durante substituição obrigatória o oponente aguarda.');
    let state=input;
    const log:string[]=[];
    for(const side of ['player','leader'] as const){
      if(!state[side].needsReplacement)continue;
      const action=side==='player'?playerAction:leaderAction;
      if(action.kind!=='switch')return failure(input,'Substituição obrigatória inválida.');
      const result=switchGymPokemon(state,side,action.toIndex);
      if(result.status!=='applied')return failure(input,result.reason);
      state=result.state;
      log.push(side+' substituiu após KO, sem restaurar HP ou SP.');
    }
    return {status:'applied',state,log,seedAfter:seed>>>0};
  }
  let current=seed>>>0;
  const roll=()=>{
    current=(Math.imul(1664525,current)+1013904223)>>>0;
    return current/0x100000000;
  };
  const pSpeed=input.player.fighters[input.player.activeIndex]!.combatant.stats.speed;
  const lSpeed=input.leader.fighters[input.leader.activeIndex]!.combatant.stats.speed;
  const first:GymSide= p.priority!==l.priority
    ?p.priority>l.priority?'player':'leader'
    :pSpeed!==lSpeed?pSpeed>lSpeed?'player':'leader'
      :roll()<.5?'player':'leader';
  let state=input;
  const log:string[]=[];
  for(const side of [first,other(first)]){
    if(state.outcome!=='ongoing')break;
    // Depois de KO, o derrotado perde sua ação pendente nesta rodada.
    if(state[side].needsReplacement)continue;
    const chosen=side==='player'?p:l;
    if(chosen.action.kind==='switch'){
      const changed=switchGymPokemon(state,side,chosen.action.toIndex);
      if(changed.status!=='applied')return failure(input,changed.reason);
      state=changed.state;
      log.push(side+' trocou Pokémon (ação consumida), +'+changed.recoveredSp+
        ' SP no recolhido; HP preservado.');
      continue;
    }
    const active=state[side].fighters[state[side].activeIndex]!;
    if(active.hp<=0)continue;
    if(chosen.action.kind==='focus'){
      const before=active.sp;
      state=focusGymSp(state,side);
      log.push(side+' usou Concentrar e recuperou '+
        (state[side].fighters[state[side].activeIndex]!.sp-before)+' SP.');
      continue;
    }
    const defendingSide=other(side);
    if(state[defendingSide].needsReplacement)break;
    const target=state[defendingSide].fighters[state[defendingSide].activeIndex]!;
    const move=chosen.move!;
    const cost=kantoMoveSpCost(move);
    state=spendGymSp(state,side,cost);
    if(roll()*100>=move.accuracy){
      log.push(side+' errou '+move.name+' (-'+cost+' SP).');
      continue;
    }
    if(move.category==='status'){
      const healing=Math.max(1,Math.floor(active.combatant.stats.hp*.5));
      state=healGymHp(state,side,healing);
      log.push(side+' usou '+move.name+' e recuperou HP (-'+cost+' SP).');
      continue;
    }
    const attacker=combatantUsing(active,move);
    const hits=kantoRollHitCount(move.name,roll);
    for(let hit=1;hit<=hits;hit++){
      if(state[defendingSide].needsReplacement||state.outcome!=='ongoing')break;
      const actual=state[defendingSide].fighters[state[defendingSide].activeIndex]!;
      if(actual.hp===0)break;
      const damage=kantoDamage(attacker,actual.combatant,roll(),roll(),
        active.status==='burn'&&move.category==='physical'?.5:1);
      state=applyGymDamage(state,defendingSide,damage.damage);
      log.push(side+' usou '+move.name+' ('+hit+'/'+hits+'), causando '+
        damage.damage+' de dano'+(hit===1?' (-'+cost+' SP)':'')+'.');
      if(damage.damage===0)break;
    }
    if(state[defendingSide].needsReplacement){
      log.push(defendingSide+' sofreu KO: aguarda substituição grátis.');
    }
  }
  return {status:'applied',state:{...state,turn:state.turn+1},log,seedAfter:current};
}
