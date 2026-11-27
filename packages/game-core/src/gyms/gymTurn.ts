/**
 * GYM-02C1: resolvedor puro de rodadas 3x3 para dano, ataques e trocas.
 *
 * Deliberadamente NÃO conecta save/UI, recompensas ou ataques de status.
 * O catálogo de suporte, drenagem, efeitos secundários, Concentrar e duração
 * de condições exigem o próximo recorte antes dos Ginásios jogáveis.
 */
import type {Combatant,KantoMove,KantoBattleVisualFrame} from '../combat/kantoBattle.js';
import {kantoDamage,kantoTypeMultiplier} from '../combat/kantoBattle.js';
import {gymApplyStatus,gymDropStat,gymDamageStat,GYM_EMPTY_EFFECTS,
  gymApplyConfusion,gymTickConfusion,gymConfusionSelfDamage,
  gymApplySleep,gymTickSleep,gymApplyToxic,gymTickToxic,gymCalmMind,gymSpecialStat,gymBulkUp,gymSteelWingBoost,gymOverheatDrop,gymBarrierActive,gymSetBarrier,gymBreakScreens,gymProtectedDamage,gymProtectAttempt} from './gymEffects.js';
import {gymWeatherMove,gymActiveWeather,gymSetWeather,gymWeatherAccuracy,gymWeatherDamage,gymWeatherResidual} from './gymWeather.js';
import {gymSignatureSupport} from './gymSignatureTms.js';
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
      readonly log:readonly string[];readonly frames:readonly KantoBattleVisualFrame[];
      readonly snapshots:readonly GymBattleState[];
      readonly seedAfter:number}
  | {readonly status:'blocked';readonly state:GymBattleState;readonly reason:string};

const other=(side:GymSide):GymSide=>side==='player'?'leader':'player';
/** O mesmo contrato de frames usado pelo BattleStage regional.
 * Cada quadro corresponde a UMA linha do log, derivado de estados
 * já resolvidos pelo core (sem rolls ou efeitos adicionais).
 */
function gymLogFrame(
  before:GymBattleState,after:GymBattleState,line:string,
  override:Partial<KantoBattleVisualFrame>={}
):KantoBattleVisualFrame{
  const previous=(side:GymSide)=>before[side].fighters[before[side].activeIndex]!;
  const next=(side:GymSide)=>after[side].fighters[after[side].activeIndex]!;
  const changed=(side:GymSide)=>before[side].activeIndex===after[side].activeIndex;
  const pLost=changed('player')?Math.max(0,previous('player').hp-next('player').hp):0;
  const lLost=changed('leader')?Math.max(0,previous('leader').hp-next('leader').hp):0;
  const pGain=changed('player')?Math.max(0,next('player').hp-previous('player').hp):0;
  const lGain=changed('leader')?Math.max(0,next('leader').hp-previous('leader').hp):0;
  const pSp=changed('player')?Math.max(0,next('player').sp-previous('player').sp):0;
  const lSp=changed('leader')?Math.max(0,next('leader').sp-previous('leader').sp):0;
  const statusChanged=(side:GymSide)=>changed(side)&&(
    previous(side).status!==next(side).status||
    previous(side).confusionTurns!==next(side).confusionTurns||
    previous(side).sleepActions!==next(side).sleepActions||
    previous(side).effects!==next(side).effects);
  const pStatus=statusChanged('player'),lStatus=statusChanged('leader');
  const target=pLost?'player':lLost?'wild':pGain?'player':lGain?'wild':
    pSp?'player':lSp?'wild':pStatus?'player':lStatus?'wild':null;
  const amount=pLost||lLost||pGain||lGain;
  const kind=pLost||lLost?line.includes('residual')?'residual':'attack':
    pGain||lGain?'heal':pSp||lSp?'focus':
      pStatus||lStatus?'status':line.includes('errou')?'miss':'info';
  return {
    playerHp:next('player').hp,wildHp:next('leader').hp,
    playerSp:next('player').sp,wildSp:next('leader').sp,
    kind,target,amount,
    spRecovery:pSp||lSp,
    ...override
  };
}

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
    if(!support&&!gymSignatureSupport(move.name))return null;
    if(support?.kind==='heal'&&active.hp===active.combatant.stats.hp)return null;
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
    const frames:KantoBattleVisualFrame[]=[];
    const snapshots:GymBattleState[]=[];
    let observed=input;
    const record=(line:string,meta:Partial<KantoBattleVisualFrame>={})=>{
      log.push(line);frames.push(gymLogFrame(observed,state,line,meta));
      snapshots.push(state);observed=state;
    };
    for(const side of ['player','leader'] as const){
      if(!state[side].needsReplacement)continue;
      const action=side==='player'?playerAction:leaderAction;
      if(action.kind!=='switch')return failure(input,'Substituição obrigatória inválida.');
      const result=switchGymPokemon(state,side,action.toIndex);
      if(result.status!=='applied')return failure(input,result.reason);
      state=result.state;
      record(side+' substituiu após KO, sem restaurar HP ou SP.');
    }
    return {status:'applied',state,log,frames,snapshots,seedAfter:seed>>>0};
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
  const frames:KantoBattleVisualFrame[]=[];
  const snapshots:GymBattleState[]=[];
  let observed=input;
  const record=(line:string,meta:Partial<KantoBattleVisualFrame>={})=>{
    log.push(line);frames.push(gymLogFrame(observed,state,line,meta));
      snapshots.push(state);observed=state;
  };
  const protectedSides=new Set<GymSide>();
  for(const side of [first,other(first)]){
    if(state.outcome!=='ongoing')break;
    // Depois de KO, o derrotado perde sua ação pendente nesta rodada.
    if(state[side].needsReplacement)continue;
    const chosen=side==='player'?p:l;
    if(chosen.action.kind==='switch'){
      const changed=switchGymPokemon(state,side,chosen.action.toIndex);
      if(changed.status!=='applied')return failure(input,changed.reason);
      state=changed.state;
      record(side+' trocou Pokémon (ação consumida), +'+changed.recoveredSp+
        ' SP no recolhido; HP preservado.');
      continue;
    }
    const active=state[side].fighters[state[side].activeIndex]!;
    if(active.hp<=0)continue;
    // Sono: 1–3 ações próprias; recolhimento congela a duração.
    if(active.status==='sleep'){
      state=gymTickSleep(state,side);
      if((active.sleepActions??0)>0){
        record(side+' está dormindo e perdeu a ação.');
        continue;
      }
      record(side+' acordou.');
    }
    // Paralisia: 25% de não agir, antes de gastar SP ou executar Concentrar.
    // Recolher não é ataque: troca continua possível com as regras normais.
    if(active.status==='paralysis'&&roll()<.25){
      record(side+' ficou paralisado e perdeu a ação.');
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
          attack:gymSpecialStat(active.combatant.stats.attack,drops.attackBoosts??0,drops.attackDrops),
          defense:gymSpecialStat(active.combatant.stats.defense,drops.defenseBoosts??0,drops.defenseDrops)
        });
        state=applyGymDamage(state,side,damage);
        record(side+' se feriu na confusão: '+damage+' HP.');
        continue;
      }
    }
    if(chosen.action.kind==='focus'){
      const before=active.sp;
      state=focusGymSp(state,side);
      record(side+' usou Concentrar e recuperou '+
        (state[side].fighters[state[side].activeIndex]!.sp-before)+' SP.');
      continue;
    }
    const defendingSide=other(side);
    if(state[defendingSide].needsReplacement)break;
    const target=state[defendingSide].fighters[state[defendingSide].activeIndex]!;
    const move=chosen.move!;
    const cost=kantoMoveSpCost(move);
    state=spendGymSp(state,side,cost);
    if(roll()*100>=gymWeatherAccuracy(gymActiveWeather(state),move)){
      record(side+' errou '+move.name+' (-'+cost+' SP).');
      continue;
    }
    const supportEffect=kantoSupportEffect(move.name);
    const selfDirected=!!gymWeatherMove(move.name)||supportEffect?.kind==='heal'||['bulk-up','calm-mind','reflect','light-screen','safeguard','protect'].includes(move.name);
    if(!selfDirected&&protectedSides.has(defendingSide)){
      record(defendingSide+' bloqueou '+move.name+' com Protect (-'+cost+' SP).');
      continue;
    }
    if(move.category==='status'){
      const support=supportEffect;
      const signature=gymSignatureSupport(move.name);
      const weather=gymWeatherMove(move.name);
      if(weather){
        const next=gymSetWeather(state,weather);
        record(side+' usou '+move.name+(next===state?': clima já ativo.':' por cinco turnos.'));
        state=next;
        continue;
      }
      if(signature==='protect'){
        const attempt=gymProtectAttempt(state,side,roll);
        state=attempt.state;
        if(attempt.success)protectedSides.add(side);
        record(side+' usou protect'+(attempt.success?' e ficou protegido.':', mas falhou.'));
        continue;
      }
      if(signature==='reflect'||signature==='light-screen'||signature==='safeguard'){
        const next=gymSetBarrier(state,side,signature);
        record(side+' usou '+signature+(next===state?': barreira já ativa.':' por cinco turnos.'));
        state=next;
        continue;
      }
      if(signature==='toxic'){
        const next=gymApplyToxic(state,defendingSide);
        const applied=next!==state;
        state=next;
        record(side+' usou toxic'+(applied?' e aplicou veneno crescente.':': sem efeito.'));
        continue;
      }
      if(signature==='bulk-up'){
        state=gymBulkUp(state,side);
        record(side+' usou bulk-up e elevou Ataque e Defesa.');
        continue;
      }
      if(signature==='calm-mind'){
        const capped=(active.effects?.specialAttackBoosts??0)>=6&&(active.effects?.specialDefenseBoosts??0)>=6;
        state=gymCalmMind(state,side);
        record(side+' usou calm-mind'+(capped?': limite de estágios atingido.':' e elevou Ataque Especial e Defesa Especial.'));
        continue;
      }
      if(!support)throw new RangeError('Suporte não resolvido.');
      if(support.kind==='heal'){
        const healing=Math.max(1,Math.floor(active.combatant.stats.hp*.5));
        state=healGymHp(state,side,healing);
        record(side+' usou '+move.name+' e recuperou HP (-'+cost+' SP).');
      }else if(kantoTypeMultiplier(move.type,target.combatant.types)===0){
        record(side+' usou '+move.name+', mas o alvo é imune.');
      }else if(support.kind==='status'){
        const previous=state[defendingSide].fighters[state[defendingSide].activeIndex]!.status;
        if(support.status==='sleep'){
          if(previous===null)state=gymApplySleep(state,defendingSide,1+Math.floor(roll()*3));
        }else state=gymApplyStatus(state,defendingSide,support.status);
        record(side+' usou '+move.name+(previous===null&&
          state[defendingSide].fighters[state[defendingSide].activeIndex]!.status!==null
          ?' e aplicou '+support.status:': sem efeito')+'.');
      }else{
        state=gymDropStat(state,defendingSide,
          support.kind==='lower-attack'?'attackDrops':'defenseDrops');
        record(side+' usou '+move.name+' e reduziu '+support.kind+'.');
      }
      continue;
    }
    if(move.name==='brick-break'&&kantoTypeMultiplier(move.type,target.combatant.types)>0){
      const next=gymBreakScreens(state,defendingSide);
      if(next!==state){state=next;record(side+' quebrou Reflect/Light Screen com brick-break.');}
    }
    const ownDrops=active.effects??GYM_EMPTY_EFFECTS;
    const foeDrops=target.effects??GYM_EMPTY_EFFECTS;
    const cleanAttacker=combatantUsing(active,move);
    const attacker={...cleanAttacker,stats:{...cleanAttacker.stats,
      attack:gymSpecialStat(cleanAttacker.stats.attack,ownDrops.attackBoosts??0,ownDrops.attackDrops),
      specialAttack:gymSpecialStat(cleanAttacker.stats.specialAttack,ownDrops.specialAttackBoosts??0,ownDrops.specialAttackDrops??0)}};
    const defender={...target.combatant,stats:{...target.combatant.stats,
      defense:gymSpecialStat(target.combatant.stats.defense,foeDrops.defenseBoosts??0,foeDrops.defenseDrops),
      specialDefense:gymSpecialStat(target.combatant.stats.specialDefense,
        foeDrops.specialDefenseBoosts??0,foeDrops.specialDefenseDrops??0)}};
    const hits=kantoRollHitCount(move.name,roll);
    for(let hit=1;hit<=hits;hit++){
      if(state[defendingSide].needsReplacement||state.outcome!=='ongoing')break;
      const actual=state[defendingSide].fighters[state[defendingSide].activeIndex]!;
      if(actual.hp===0)break;
      const damage=kantoDamage(attacker,defender,roll(),roll(),
        active.status==='burn'&&move.category==='physical'?.5:1);
      const inflicted=gymProtectedDamage(state,defendingSide,move.category,move.name,gymWeatherDamage(gymActiveWeather(state),move,damage.damage),damage.critical);
      state=applyGymDamage(state,defendingSide,inflicted);
      record(side+' usou '+move.name+' ('+hit+'/'+hits+'), causando '+
        inflicted+' de dano'+(hit===1?' (-'+cost+' SP)':'')+'.',{
          moveName:move.name,moveType:move.type,critical:damage.critical,
          effectiveness:damage.effectiveness,hitIndex:hit,hitTotal:hits
        });
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
          record(defendingSide+' recebeu '+onHit.status+
            ' pelo impacto '+hit+'/'+hits+' de '+move.name+'.');
      }
      if(damage.damage===0)break;
    }
    // Self effects occur even if this attack KOs a target with reserves.
    if(state.outcome==='ongoing'&&state[defendingSide].fighters[state[defendingSide].activeIndex]!.hp<target.hp){
      if(move.name==='overheat'){
        state=gymOverheatDrop(state,side);
        record(side+' perdeu dois estágios de Ataque Especial.');
      }
      if(move.name==='steel-wing'&&roll()*100<10){
        state=gymSteelWingBoost(state,side);
        record(side+' elevou Defesa.');
      }
    }
    if(state[defendingSide].needsReplacement){
      record(defendingSide+' sofreu KO: aguarda substituição grátis.');
    }else if(state.outcome==='ongoing'){
      const effect=move.name==='thunder'&&kantoTypeMultiplier(move.type,target.combatant.types)>0?{kind:'status' as const,status:'paralysis' as const,chance:30}:kantoMoveSecondaryEffect(move.name);
      if(effect?.kind==='drain'){
        const afterHp=state[defendingSide].fighters[state[defendingSide].activeIndex]!.hp;
        const inflicted=target.hp-afterHp;
        const restored=Math.min(
          state[side].fighters[state[side].activeIndex]!.combatant.stats.hp-
          state[side].fighters[state[side].activeIndex]!.hp,
          Math.max(0,Math.floor(inflicted*effect.percent/100)));
        if(restored>0){
          state=healGymHp(state,side,restored);
          record(side+' drenou '+restored+' HP com '+move.name+'.');
        }
      }else if(effect?.kind==='status'&&roll()*100<effect.chance){
        const old=state[defendingSide].fighters[state[defendingSide].activeIndex]!.status;
        state=gymApplyStatus(state,defendingSide,effect.status);
        if(old===null&&state[defendingSide].fighters[
          state[defendingSide].activeIndex]!.status!==null)
          record(defendingSide+' recebeu '+effect.status+' de '+move.name+'.');
      }else if(effect?.kind==='speed-drop'&&roll()*100<effect.chance){
        state=gymDropStat(state,defendingSide,'speedDrops');
        record(defendingSide+' perdeu velocidade.');
      }
      // TM-only effects reuse the existing stage machinery, with no extra
      // roll against an immune target. Keep existing signature RNG unchanged.
      const effective=kantoTypeMultiplier(move.type,target.combatant.types)>0;
      if(effective&&move.name==='iron-tail'&&roll()*100<30){
        state=gymDropStat(state,defendingSide,'defenseDrops');
        record(defendingSide+' perdeu Defense.');
      }
      const psychic=move.name==='shadow-ball'
        ?(effective?{kind:'special-defense-drop' as const,chance:20}:null)
        :move.name==='water-pulse'?{kind:'confusion' as const,chance:20}:gymPsychicSecondary(move.name);
      if(psychic&&roll()*100<psychic.chance){
        if(psychic.kind==='confusion'){
          const duration=2+Math.floor(roll()*4);
          const next=gymApplyConfusion(state,defendingSide,duration);
          if(next!==state){state=next;record(defendingSide+' ficou confuso por '+duration+' ações.');}
        }else{
          state=gymDropStat(state,defendingSide,'specialDefenseDrops');
          record(defendingSide+' perdeu Special Defense.');
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
      if(fighter.status==='poison'&&fighter.toxicStage!==undefined)
        return Math.max(1,Math.floor(fighter.combatant.stats.hp*fighter.toxicStage/16));
      return fighter.status==='poison'||fighter.status==='burn'
        ?Math.max(1,Math.floor(fighter.combatant.stats.hp/8)):0;
    };
    const weather=gymActiveWeather(state);
    const climate=(side:GymSide)=>{
      const fighter=state[side].fighters[state[side].activeIndex]!;
      return gymWeatherResidual(weather,fighter.combatant.types,fighter.combatant.stats.hp);
    };
    const weatherAmounts={player:climate('player'),leader:climate('leader')};
    const amounts={player:amount('player')+weatherAmounts.player,leader:amount('leader')+weatherAmounts.leader};
    if(amounts.player>0||amounts.leader>0){
      const residuals=(['player','leader'] as const).flatMap(side=>{
        if(amounts[side]<=0)return [];
        const fighter=state[side].fighters[state[side].activeIndex]!;
        return [{side,amount:Math.min(fighter.hp,amounts[side]),
          text:side+' sofreu '+Math.min(fighter.hp,amounts[side])+
            ' dano residual ('+[...(amount(side)>0?[fighter.toxicStage!==undefined?'toxic':fighter.status]:[]),...(weatherAmounts[side]>0?[weather]:[])].join(' + ')+').'}];
      });
      for(const event of residuals){
        if(state[event.side].fighters[state[event.side].activeIndex]!.toxicStage!==undefined)
          state=gymTickToxic(state,event.side);
      }
      state=applyGymResidual(state,amounts);
      for(const event of residuals)
        record(event.text,{kind:'residual',
          target:event.side==='player'?'player':'wild',amount:event.amount});
      if(state.outcome==='draw')record('Empate: ambos os times desmaiaram.');
    }
  }
  if(gymActiveWeather(state)&&state.weather?.expiresAt===state.turn+1)record('O clima terminou.');
  const finished={...state,turn:state.turn+1};
  // Empate técnico igual para jogador e líder. Sem bônus por HP restante
  // e sem concessão de insígnias em combate sem vencedor.
  if(finished.turn>=GYM_MAX_TURNS&&finished.outcome==='ongoing'){
    record('Empate técnico: limite de '+GYM_MAX_TURNS+' rodadas.');
    return {status:'applied',state:{...finished,outcome:'draw'},log,frames,snapshots,seedAfter:current};
  }
  return {status:'applied',state:finished,log,frames,snapshots,seedAfter:current};
}
