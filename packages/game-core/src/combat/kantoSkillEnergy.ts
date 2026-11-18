/**
 * Reserva de Skill Points própria do Kanto Idle LAB (NÃO é PP da PokéAPI).
 * PP da PokéAPI limita usos POR golpe; esta alfa utiliza uma reserva global
 * por Pokémon que começa cheia em cada encontro e NÃO regenera nele.
 *
 * A habilidade sempre paga SP ao ser TENTADA (mesmo que erre/imune).
 * Paralisia que impede a ação NÃO consome SP, pois não houve tentativa.
 */
import type {KantoMove} from './kantoBattle.js';
import {kantoMoveSecondaryEffect} from './kantoStatusEffects.js';

export const KANTO_BASIC_ATTACK:KantoMove=Object.freeze({
  name:'basic-attack',type:'normal',category:'physical',
  power:30,accuracy:100,priority:0
});

export const KANTO_SP_BALANCE=Object.freeze({
  baseSp:40,
  levelDivisor:4,
  skillIntervalTurns:2,
  basicPower:30,
  maxMoveSpCost:30
});

/** Nível 1..100 → 40..65 SP por batalha (50 no nível 40). */
export function kantoMaxSp(level:number):number{
  if(!Number.isSafeInteger(level)||level<1||level>100)
    throw new RangeError('Nível de SP inválido.');
  return KANTO_SP_BALANCE.baseSp+Math.floor(level/KANTO_SP_BALANCE.levelDivisor);
}

/**
 * Suporte: 16 debuff simples, 22 veneno, 24 paralisia.
 * Ofensiva: 10+ceil(power/12), +4 efeito secundário ou +3 prioridade;
 * máximo 30. O ataque básico universal é a única ação gratuita.
 */
export function kantoMoveSpCost(move:KantoMove):number{
  if(!move||typeof move.name!=='string')throw new RangeError('Golpe inválido.');
  if(move.name===KANTO_BASIC_ATTACK.name){
    if(move.type!==KANTO_BASIC_ATTACK.type
      ||move.category!==KANTO_BASIC_ATTACK.category
      ||move.power!==KANTO_BASIC_ATTACK.power
      ||move.accuracy!==KANTO_BASIC_ATTACK.accuracy
      ||move.priority!==KANTO_BASIC_ATTACK.priority)
      throw new RangeError('Ataque básico adulterado.');
    return 0;
  }
  if(move.category==='status'){
    if(move.name==='thunder-wave')return 24;
    if(move.name==='poison-powder')return 22;
    if(move.name==='growl'||move.name==='tail-whip')return 16;
    throw new RangeError('Suporte sem custo catalogado.');
  }
  if((move.category!=='physical'&&move.category!=='special')
    ||!Number.isFinite(move.power)||move.power<=0||move.power>250)
    throw new RangeError('Golpe ofensivo inválido.');
  const effect=kantoMoveSecondaryEffect(move.name);
  const secondary=effect?4:0;
  const priority=move.priority>0?3:0;
  return Math.min(KANTO_SP_BALANCE.maxMoveSpCost,
    10+Math.ceil(move.power/12)+secondary+priority);
}
