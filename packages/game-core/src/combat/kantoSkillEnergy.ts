/**
 * D-038: Energia SP COMPARTILHADA do Kanto Idle LAB, distinta do PP oficial
 * INDIVIDUAL de cada movimento. Fonte local versionada dos PP: kantoMovePp.
 * Sem chamadas remotas, tempo ou RNG no combate.
 */
import type {KantoMove} from './kantoBattle.js';
import {KANTO_POKEDEX} from '../catalog/kantoSpecies.js';
import {KANTO_MOVE_PP} from '../catalog/kantoMovePp.js';
import {kantoMoveSecondaryEffect} from './kantoStatusEffects.js';

export const KANTO_BASIC_ATTACK:KantoMove=Object.freeze({
  name:'basic-attack',type:'normal',category:'physical',
  power:30,accuracy:100,priority:0
});
/** Ação interna, não equipável: abdica do ataque e restaura SP. */
export const KANTO_CONCENTRATE:KantoMove=Object.freeze({
  name:'concentrate',type:'normal',category:'status',
  power:0,accuracy:100,priority:0
});

export const KANTO_SP_BALANCE=Object.freeze({
  minSp:40,maxSp:100,baseSp:30,
  levelDivisor:3,specialDivisor:14,hpDivisor:20,
  skillIntervalTurns:2,basicPower:30,
  minMoveSpCost:8,maxMoveSpCost:40,
  focusPercent:30,maxFocusUses:2,focusCooldownTurns:4
});
const clamp=(min:number,max:number,value:number)=>Math.max(min,Math.min(max,value));

/**
 * PP é preço de RARIDADE do movimento, não a reserva de energia.
 * Todos os movimentos equipáveis do catálogo têm PP validado no snapshot.
 * Retorna null para golpe não catalogado, sem sugerir PP inventado.
 */
export function kantoMovePp(name:string):number|null{
  return KANTO_MOVE_PP[name]??null;
}

/**
 * Capacidade por espécie + nível, usando stats BASE da PokéAPI (não soma
 * treino, item ou bônus de treinador, e não usa HP atual de combate).
 * 30 + floor(nível/3) + floor((Sp.Atk+Sp.Def)/14) + floor(HP_base/20),
 * com piso 40 e teto 100. Recalcula somente no começo do encontro.
 */
export function kantoMaxSp(level:number,speciesId:number):number{
  if(!Number.isSafeInteger(level)||level<1||level>100
    ||!Number.isSafeInteger(speciesId)||speciesId<1||speciesId>151)
    throw new RangeError('Nível ou espécie de SP inválidos.');
  const base=KANTO_POKEDEX[speciesId-1];
  if(!base||base.id!==speciesId)throw new RangeError('Espécie sem stats-base.');
  return clamp(KANTO_SP_BALANCE.minSp,KANTO_SP_BALANCE.maxSp,
    KANTO_SP_BALANCE.baseSp+Math.floor(level/KANTO_SP_BALANCE.levelDivisor)
    +Math.floor((base.base.specialAttack+base.base.specialDefense)/KANTO_SP_BALANCE.specialDivisor)
    +Math.floor(base.base.hp/KANTO_SP_BALANCE.hpDivisor));
}

/** Recupera até 30% do SP máximo, sempre limitada ao SP que falta. */
export function kantoFocusRecovery(maxSp:number,currentSp:number):number{
  if(!Number.isSafeInteger(maxSp)||maxSp<1||maxSp>100
    ||!Number.isSafeInteger(currentSp)||currentSp<0||currentSp>maxSp)
    throw new RangeError('Reserva de SP inválida.');
  return Math.min(maxSp-currentSp,Math.max(1,
    Math.floor(maxSp*KANTO_SP_BALANCE.focusPercent/100)));
}

/**
 * Custo híbrido próprio: potência + escassez de PP na PokéAPI + efeitos.
 * Ofensiva: clamp(8,40,round(0.45*(45-pp)+0.18*poder+4 secundário+3 prioridade)).
 * Suporte: clamp(10,36,round(0.45*(45-pp)+peso de efeito)).
 * PP ausente (somente testes/golpes provisórios) usa 20 como fallback
 * de CÁLCULO, sem afirmar que seja PP oficial.
 * Rank melhora dano sem alterar custo.
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
  const pp=KANTO_MOVE_PP[move.name]??20;
  const scarcity=.45*(45-pp);
  if(move.category==='status'){
    const weights:Readonly<Record<string,number>>={
      growl:10,'tail-whip':10,'poison-powder':14,'thunder-wave':16
    };
    const weight=weights[move.name];
    if(weight===undefined)throw new RangeError('Suporte sem custo catalogado.');
    return clamp(10,36,Math.round(scarcity+weight));
  }
  if((move.category!=='physical'&&move.category!=='special')
    ||!Number.isFinite(move.power)||move.power<=0||move.power>250)
    throw new RangeError('Golpe ofensivo inválido.');
  const secondary=kantoMoveSecondaryEffect(move.name)?4:0;
  const priority=move.priority>0?3:0;
  return clamp(KANTO_SP_BALANCE.minMoveSpCost,KANTO_SP_BALANCE.maxMoveSpCost,
    Math.round(scarcity+.18*move.power+secondary+priority));
}
