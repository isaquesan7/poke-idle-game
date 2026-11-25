/**
 * GYM-02D — adaptador da IA tática ao mesmo contrato de ações do treinador.
 * Sem RNG/visão futura: somente equipe, HP, SP, status e golpes atuais.
 * Nenhuma escrita em saves, badges, trainer stats ou inventário.
 */
import type {GymBattleState,GymSide} from './gymBattleState.js';
import type {GymTurnAction,GymTurnResult} from './gymTurn.js';
import {gymLegalTurnActions,resolveGymTurn} from './gymTurn.js';
import {gymAiDecision} from './gymTactics.js';
import {kantoTypeMultiplier} from '../combat/kantoBattle.js';

function isLegal(action:GymTurnAction,legal:readonly GymTurnAction[]):boolean{
  return legal.some(candidate=>
    candidate.kind===action.kind&&(
      candidate.kind==='switch'
        ?action.kind==='switch'&&candidate.toIndex===action.toIndex
        :candidate.kind==='move'
          ?action.kind==='move'&&candidate.moveName===action.moveName
          :true
    ));
}

/**
 * Membros nocauteados nunca entram; substituição FORÇADA escolhe a
 * reserva com maior HP proporcional, com desempate pelo slot menor.
 * Reserva conserva HP/SP individual de antes do KO.
 */
export function gymChooseAiAction(
  state:GymBattleState,side:GymSide='leader'
):GymTurnAction{
  const legal=gymLegalTurnActions(state,side);
  if(!legal.length)throw new RangeError('Sem ação legal para este confronto.');
  const party=state[side];
  if(party.needsReplacement){
    const forced=legal.filter((a):a is Extract<GymTurnAction,{kind:'switch'}>=>
      a.kind==='switch');
    if(!forced.length)throw new RangeError('Sem substituto consciente.');
    return [...forced].sort((a,b)=>{
      const x=party.fighters[a.toIndex]!,y=party.fighters[b.toIndex]!;
      return y.hp/y.combatant.stats.hp-x.hp/x.combatant.stats.hp
        ||a.toIndex-b.toIndex;
    })[0]!;
  }
  // Se o adversário ainda precisa substituir, este lado AGUARDA
  // gratuitamente. Não inventar um turno de ataque.
  if(state.player.needsReplacement||state.leader.needsReplacement)
    return {kind:'basic'};

  const actor=party.fighters[party.activeIndex]!;
  const enemySide=side==='player'?'leader':'player';
  const enemy=state[enemySide].fighters[state[enemySide].activeIndex]!;
  const permittedMoves=(actor.combatant.moves??[actor.combatant.move])
    .filter(m=>legal.some(a=>a.kind==='move'&&a.moveName===m.name));
  const bench=legal.flatMap(a=>a.kind==='switch'?[{
    index:a.toIndex,combatant:party.fighters[a.toIndex]!.combatant,
    hp:party.fighters[a.toIndex]!.hp
  }]:[]);
  const proposed=gymAiDecision({
    actor:{...actor.combatant,moves:permittedMoves},
    defender:enemy.combatant,actorHp:actor.hp,actorSp:actor.sp,
    bench,consecutiveSwitches:bench.length?0:1,
    allowConcentrate:legal.some(a=>a.kind==='focus')
  });
  // Troca defensiva: quando o ativo corre risco de KO, avalia reserva
  // CONSCIENTE com HP alto e menor vulnerabilidade ao golpe atualmente
  // conhecido do adversário. Sem prever RNG, HP futuro ou golpes ocultos.
  // Mesma regra para o treinador e para o líder; switch consome ação.
  const hpRatio=actor.hp/actor.combatant.stats.hp;
  const incomingType=enemy.combatant.move.type;
  const currentWeakness=kantoTypeMultiplier(incomingType,actor.combatant.types);
  const defensive=party.voluntarySwitchesUsed<3&&hpRatio<=.3
    ?bench.filter(item=>item.hp/item.combatant.stats.hp>=.65)
      .map(item=>({
        ...item,
        weakness:kantoTypeMultiplier(incomingType,item.combatant.types)
      }))
      .filter(item=>item.weakness<currentWeakness)
      .sort((a,b)=>a.weakness-b.weakness
        ||b.hp/b.combatant.stats.hp-a.hp/a.combatant.stats.hp
        ||a.index-b.index)[0]
    :undefined;
  const action:GymTurnAction=defensive?{kind:'switch',toIndex:defensive.index}
    :proposed.action==='concentrate'
    ?{kind:'focus'}
    :proposed.action==='move'
      ?{kind:'move',moveName:proposed.moveName}
      :proposed.action==='switch'
        ?{kind:'switch',toIndex:proposed.toIndex}
        :{kind:'basic'};
  // Nunca confiar apenas na heurística: o resolvedor é autoridade.
  return isLegal(action,legal)?action:{kind:'basic'};
}

/** O treinador fornece APENAS sua ação. Líder decide pelas mesmas regras
 * antes de resolver a rodada com seed explícita.
 */
export function resolveGymAiTurn(
  state:GymBattleState,playerAction:GymTurnAction,seed:number
):GymTurnResult{
  if(state.outcome!=='ongoing')
    return {status:'blocked',state,reason:'Confronto concluído.'};
  return resolveGymTurn(state,playerAction,gymChooseAiAction(state,'leader'),seed);
}
