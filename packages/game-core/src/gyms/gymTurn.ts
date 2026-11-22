/**
 * GYM-02C1: resolvedor puro de rodadas 3x3 para dano, ataques e trocas.
 *
 * Deliberadamente NÃO conecta save/UI, recompensas ou ataques de status.
 * O catálogo de suporte, drenagem, efeitos secundários, Concentrar e duração
 * de condições exigem o próximo recorte antes dos Ginásios jogáveis.
 */
import type {Combatant,KantoMove} from '../combat/kantoBattle.js';
import {kantoDamage,kantoTypeMultiplier} from '../combat/kantoBattle.js';
import {gymApplyStatus,gymDropStat,gymDamageStat,GYM_EMPTY_EFFECTS,
  gymApplyConfusion,gymTickConfusion,gymConfusionSelfDamage,
  gymApplySleep,gymTickSleep} from './gymEffects.js';
import {gymPsychicSecondary} from './gymPsychicMoves.js';
import {kantoMoveSecondaryEffect,kantoPerHitSecondaryEffect} from '../combat/kantoStatusEffects.js';
import {kantoRollHitCount} from '../combat/kantoMultiHit.js';
import {kantoSupportEffect} from '../catalog/kantoSupportMoves.js';
import {kantoMoveSpCost,KANTO_BASIC_ATTACK,KANTO_SP_BALANCE} from '../combat/kantoSkillEnergy.js';
import {applyGymDamage,applyGymResidual,spendGymSp,switchGymPokemon,healGymHp,focusGymSp} from './gymBattleState.js';
import type {GymBattleState,GymSide,GymFighterState} from './gymBattleState.js';

export const GYM_MAX_TURNS=120;

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
    ||kantoMoveSpCost(move)>active.sp)return null;
  if(move.category==='status'){
    const support=kantoSupportEffect(move.name);
    if(!support)return null;
    if(support.kind==='heal'&&active.hp===active.combatant.stats.hp)return null;
  }
  return {action,move,priority:move.priority};
}
/** Catálogo de ações efetivamente executáveis. Serve AO MESMO TEMPO
 * aos botões do jogador e à IA; nenhuma decisão pode contornar quotas.
 * Se qualquer ativo caiu, só há substituição obrigatória (ou aguardar).
 */
export function gymLegalTurnActions(
  state:GymBattleState,side:GymSide
):readonly GymTurnAction[]{
  if(state.outcome!=='ongoing')return [];
  if(state.player.needsReplacement||state.leader.needsReplacement){
    if(!state[side].needsReplacement)return [{kind:'basic'}];
    return state[side].fighters.flatMap((f,i)=>
      f.hp>0&&i!==state[side].activeIndex
        ?[{kind:'switch' as const,toIndex:i}]:[]);
  }
  const actor=state[side].fighters[state[side].activeIndex]!;
  const candidates:GymTurnAction[]=[
    {kind:'basic'}, {kind:'focus'},
    ...(actor.combatant.moves??[actor.combatant.move]).map(move=>({
      kind:'move' as const,moveName:move.name
    })),
    ...state[side].fighters.map((_,i)=>({kind:'switch' as const,toIndex:i}))
  ];
  return candidates.filter(action=>validateAction(state,side,action)!==null);
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
  const speedOf=(side:GymSide)=>{
    const f=input[side].fighters[input[side].activeIndex]!;
    const raw=f.status==='paralysis'
      ?Math.max(1,Math.floor(f.combatant.stats.speed/4))
      :f.combatant.stats.speed;
    return gymDamageStat(raw,(f.effects??GYM_EMPTY_EFFECTS).speedDrops);
  };
  const pSpeed=speedOf('player');
  const lSpeed=speedOf('leader');
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
    // Sono: 1–3 ações próprias; recolhimento congela a duração.
    if(active.status==='sleep'){
      state=gymTickSleep(state,side);
      if((active.sleepActions??0)>0){
        log.push(side+' está dormindo e perdeu a ação.');
        continue;
      }
      log.push(side+' acordou.');
    }
    // Paralisia: 25% de não agir, antes de gastar SP ou executar Concentrar.
    // Recolher não é ataque: troca continua possível com as regras normais.
    if(active.status==='paralysis'&&roll()<.25){
      log.push(side+' ficou paralisado e perdeu a ação.');
      continue;
    }
    if((active.confusionTurns??0)>0){
      // Confusão persiste na reserva. Ao agir, dura 2–5 ações próprias;
      // 50% de autodano físico sem STAB e sem custo de SP.
      state=gymTickConfusion(state,side);
      if(roll()<.5){
        const drops=active.effects??GYM_EMPTY_EFFECTS;
        const damage=gymConfusionSelfDamage({
          level:active.combatant.level,
          attack:gymDamageStat(active.combatant.stats.attack,drops.attackDrops),
          defense:gymDamageStat(active.combatant.stats.defense,drops.defenseDrops)
        });
        state=applyGymDamage(state,side,damage);
        log.push(side+' se feriu na confusão: '+damage+' HP.');
        continue;
      }
    }
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
      const support=kantoSupportEffect(move.name);
      if(!support)throw new RangeError('Suporte não resolvido.');
      if(support.kind==='heal'){
        const healing=Math.max(1,Math.floor(active.combatant.stats.hp*.5));
        state=healGymHp(state,side,healing);
        log.push(side+' usou '+move.name+' e recuperou HP (-'+cost+' SP).');
      }else if(kantoTypeMultiplier(move.type,target.combatant.types)===0){
        log.push(side+' usou '+move.name+', mas o alvo é imune.');
      }else if(support.kind==='status'){
        const previous=state[defendingSide].fighters[state[defendingSide].activeIndex]!.status;
        if(support.status==='sleep'){
          if(previous===null)state=gymApplySleep(state,defendingSide,1+Math.floor(roll()*3));
        }else state=gymApplyStatus(state,defendingSide,support.status);
        log.push(side+' usou '+move.name+(previous===null&&
          state[defendingSide].fighters[state[defendingSide].activeIndex]!.status!==null
          ?' e aplicou '+support.status:': sem efeito')+'.');
      }else{
        state=gymDropStat(state,defendingSide,
          support.kind==='lower-attack'?'attackDrops':'defenseDrops');
        log.push(side+' usou '+move.name+' e reduziu '+support.kind+'.');
      }
      continue;
    }
    const ownDrops=active.effects??GYM_EMPTY_EFFECTS;
    const foeDrops=target.effects??GYM_EMPTY_EFFECTS;
    const cleanAttacker=combatantUsing(active,move);
    const attacker={...cleanAttacker,stats:{...cleanAttacker.stats,
      attack:gymDamageStat(cleanAttacker.stats.attack,ownDrops.attackDrops)}};
    const defender={...target.combatant,stats:{...target.combatant.stats,
      defense:gymDamageStat(target.combatant.stats.defense,foeDrops.defenseDrops),
      specialDefense:gymDamageStat(target.combatant.stats.specialDefense,
        foeDrops.specialDefenseDrops??0)}};
    const hits=kantoRollHitCount(move.name,roll);
    for(let hit=1;hit<=hits;hit++){
      if(state[defendingSide].needsReplacement||state.outcome!=='ongoing')break;
      const actual=state[defendingSide].fighters[state[defendingSide].activeIndex]!;
      if(actual.hp===0)break;
      const damage=kantoDamage(attacker,defender,roll(),roll(),
        active.status==='burn'&&move.category==='physical'?.5:1);
      state=applyGymDamage(state,defendingSide,damage.damage);
      log.push(side+' usou '+move.name+' ('+hit+'/'+hits+'), causando '+
        damage.damage+' de dano'+(hit===1?' (-'+cost+' SP)':'')+'.');
      // Twineedle: veneno é testado EM CADA impacto efetivo, com uma
      // precisão e um pagamento de SP por ação. Após KO não há efeito.
      const afterTarget=state[defendingSide].fighters[state[defendingSide].activeIndex]!;
      const onHit=kantoPerHitSecondaryEffect(move.name);
      if(damage.damage>0&&afterTarget.hp>0&&onHit?.kind==='status'
        &&afterTarget.status===null
        &&roll()*100<onHit.chance){
        state=gymApplyStatus(state,defendingSide,onHit.status);
        if(state[defendingSide].fighters[state[defendingSide].activeIndex]!.status
          ===onHit.status)
          log.push(defendingSide+' recebeu '+onHit.status+
            ' pelo impacto '+hit+'/'+hits+' de '+move.name+'.');
      }
      if(damage.damage===0)break;
    }
    if(state[defendingSide].needsReplacement){
      log.push(defendingSide+' sofreu KO: aguarda substituição grátis.');
    }else if(state.outcome==='ongoing'){
      const effect=kantoMoveSecondaryEffect(move.name);
      if(effect?.kind==='drain'){
        const afterHp=state[defendingSide].fighters[state[defendingSide].activeIndex]!.hp;
        const inflicted=target.hp-afterHp;
        const restored=Math.min(
          state[side].fighters[state[side].activeIndex]!.combatant.stats.hp-
          state[side].fighters[state[side].activeIndex]!.hp,
          Math.max(0,Math.floor(inflicted*effect.percent/100)));
        if(restored>0){
          state=healGymHp(state,side,restored);
          log.push(side+' drenou '+restored+' HP com '+move.name+'.');
        }
      }else if(effect?.kind==='status'&&roll()*100<effect.chance){
        const old=state[defendingSide].fighters[state[defendingSide].activeIndex]!.status;
        state=gymApplyStatus(state,defendingSide,effect.status);
        if(old===null&&state[defendingSide].fighters[
          state[defendingSide].activeIndex]!.status!==null)
          log.push(defendingSide+' recebeu '+effect.status+' de '+move.name+'.');
      }else if(effect?.kind==='speed-drop'&&roll()*100<effect.chance){
        state=gymDropStat(state,defendingSide,'speedDrops');
        log.push(defendingSide+' perdeu velocidade.');
      }
      const psychic=gymPsychicSecondary(move.name);
      if(psychic&&roll()*100<psychic.chance){
        if(psychic.kind==='confusion'){
          const duration=2+Math.floor(roll()*4);
          state=gymApplyConfusion(state,defendingSide,duration);
          log.push(defendingSide+' ficou confuso por '+duration+' ações.');
        }else{
          state=gymDropStat(state,defendingSide,'specialDefenseDrops');
          log.push(defendingSide+' perdeu Special Defense.');
        }
      }
    }
  }
  // Resíduo de ambos os lados é calculado sobre o mesmo snapshot de HP.
  // Dois últimos Pokémon caindo juntos => empate, sem vitória falsa.
  // Reservas mantêm condição sem receber dano enquanto recolhidas.
  if(state.outcome==='ongoing'&&!state.player.needsReplacement
    &&!state.leader.needsReplacement){
    const amount=(side:GymSide):number=>{
      const fighter=state[side].fighters[state[side].activeIndex]!;
      return fighter.status==='poison'||fighter.status==='burn'
        ?Math.max(1,Math.floor(fighter.combatant.stats.hp/8)):0;
    };
    const amounts={player:amount('player'),leader:amount('leader')};
    if(amounts.player>0||amounts.leader>0){
      for(const side of ['player','leader'] as const){
        if(amounts[side]>0){
          const hp=state[side].fighters[state[side].activeIndex]!.hp;
          log.push(side+' sofreu '+Math.min(hp,amounts[side])+
            ' dano residual ('+
            state[side].fighters[state[side].activeIndex]!.status+').');
        }
      }
      state=applyGymResidual(state,amounts);
      if(state.outcome==='draw')log.push('Empate: ambos os times desmaiaram.');
    }
  }
  const finished={...state,turn:state.turn+1};
  // Empate técnico igual para jogador e líder. Sem bônus por HP restante
  // e sem concessão de insígnias em combate sem vencedor.
  if(finished.turn>=GYM_MAX_TURNS&&finished.outcome==='ongoing'){
    log.push('Empate técnico: limite de '+GYM_MAX_TURNS+' rodadas.');
    return {status:'applied',state:{...finished,outcome:'draw'},log,seedAfter:current};
  }
  return {status:'applied',state:finished,log,seedAfter:current};
}
