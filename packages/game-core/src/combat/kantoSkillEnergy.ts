/**
 * D-038: Energia SP COMPARTILHADA do Kanto Idle LAB, distinta do PP oficial
 * INDIVIDUAL de cada movimento. Fonte local versionada dos PP: kantoMovePp.
 * Sem chamadas remotas, tempo ou RNG no combate.
 */
import type {KantoMove} from './kantoBattle.js';
import {KANTO_POKEDEX} from '../catalog/kantoSpecies.js';
import {KANTO_MOVE_PP} from '../catalog/kantoMovePp.js';
import {kantoMoveSecondaryEffect} from './kantoStatusEffects.js';
import {kantoMoveExpectedHits} from './kantoMultiHit.js';

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
  // D-039: piso 50 garante um uso da skill mais cara (40 SP) no nível 1.
  minSp:50,maxSp:100,baseSp:36,
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
  const value=Object.hasOwn(KANTO_MOVE_PP,name)?KANTO_MOVE_PP[name]:undefined;
  return typeof value==='number'?value:null;
}

/**
 * Capacidade por espécie + nível, usando stats BASE da PokéAPI (não soma
 * treino, item ou bônus de treinador, e não usa HP atual de combate).
 * 36 + floor(nível/3) + floor((Sp.Atk+Sp.Def)/14) + floor(HP_base/20),
 * com piso 50 e teto 100 (D-039). Recalcula somente no começo do encontro.
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
 * D-045: Recover com bônus18 (PP5 =>36 SP); Double Kick cobra 2 impactos,
 * 1 custo por ação, e 30×2 em vez de 30 no componente potência.
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
  const pp=kantoMovePp(move.name)??20;
  const scarcity=.45*(45-pp);
  if(move.category==='status'){
    const weights:Readonly<Record<string,number>>={
      growl:10,'tail-whip':10,leer:10,
      'poison-powder':14,'thunder-wave':16,'stun-spore':16,glare:16,
      hypnosis:18,'sleep-powder':18,spore:20,
      // A cura de 50% HP paga escassez de PP + bônus fixo 18 (D-039).
      toxic:18,'calm-mind':14,'bulk-up':14,
      reflect:14,'light-screen':14,safeguard:14,protect:14,
      'sunny-day':14,'rain-dance':14,sandstorm:14,hail:14,
      recover:18
    };
    const weight=weights[move.name];
    if(weight===undefined)throw new RangeError('Suporte sem custo catalogado.');
    return clamp(10,move.name==='recover'?40:36,Math.round(scarcity+weight));
  }
  // D064AS: Night Shade não utiliza power nem STAB; PP15 e efeito fixo.
  if(move.name==='night-shade'){
    if(move.type!=='ghost'||move.category!=='special'||move.power!==0
      ||move.accuracy!==100||move.priority!==0)
      throw new RangeError('Night Shade adulterado.');
    return clamp(8,40,Math.round(scarcity+12));
  }
  if((move.category!=='physical'&&move.category!=='special')
    ||!Number.isFinite(move.power)||move.power<=0||move.power>250)
    throw new RangeError('Golpe ofensivo inválido.');
  // Efeito por acerto usa o mesmo adicional fixo de secundário, uma vez.
  const secondary=(kantoMoveSecondaryEffect(move.name)||['twineedle','shadow-ball','iron-tail','steel-wing','thunder'].includes(move.name))?4:0;
  const priority=move.priority>0?3:0;
  return clamp(KANTO_SP_BALANCE.minMoveSpCost,KANTO_SP_BALANCE.maxMoveSpCost,
    Math.round(scarcity+.18*move.power*kantoMoveExpectedHits(move.name)+secondary+priority));
}

/**
 * D-039: prévia de custo para metadados /move/{id} da PokéAPI (NÃO equipa
 * por si só). D-045 habilitou Recover em catálogo+motor SEPARADOS; Bullet
 * Seed possui ficha histórica separada; esta função continua só prévia. A ausência de power
 * em suportes/cura da API é null; NÃO converter em NaN nem dano fictício.
 * Este tipo é um recorte explícito de /move e NÃO é o KantoMove canônico.
 */
export interface KantoApiMoveSpPreview {
  readonly name:string;
  readonly pp:number|null;
  readonly power:number|null;
  readonly priority:number;
  readonly damage_class:Readonly<{name:string}>;
  readonly meta?:Readonly<{
    readonly category?:Readonly<{name:string}>|null;
    readonly min_hits?:number|null;
    readonly max_hits?:number|null;
    readonly healing?:number|null;
  }>|null;
}

/**
 * Os golpes em gameplay ainda usam kantoMoveSpCost e seu catálogo fixo.
 * 2–5 hits têm expectativa de 2.5 no recorte simplificado (aproximação
 * conservadora, não simulação da distribuição real); hits fixos são exatos.
 * Recover, Soft-Boiled etc. recebem +18 pelo efeito de cura de HP
 * (meta.category.name='heal'), além da escassez de PP.
 * A prévia sozinha não executa cura. Recover foi implementado na D-045
 * via catálogo de suporte, kantoMoveSpCost e simulateKantoBattle, com
 * limite de 1 uso por combate; não aceita payload malformado.
 */
export function kantoPreviewMoveSpCost(move:KantoApiMoveSpPreview):number{
  if(!move||typeof move.name!=='string'||!move.name.trim()
    ||!Number.isSafeInteger(move.pp)||move.pp===null||move.pp<1||move.pp>64
    ||!Number.isSafeInteger(move.priority)||move.priority< -7||move.priority>7
    ||(move.power!==null&&(!Number.isSafeInteger(move.power)
      ||move.power<0||move.power>250))
    ||!move.damage_class||!['status','special','physical'].includes(move.damage_class.name))
    throw new RangeError('Metadados de golpe inválidos.');
  const meta=move.meta;
  const category=meta?.category?.name??'';
  const healing=meta?.healing;
  if(healing!==null&&healing!==undefined
    &&(!Number.isSafeInteger(healing)||healing<0||healing>100))
    throw new RangeError('Porcentagem de cura inválida.');
  const hasMin=meta?.min_hits!==null&&meta?.min_hits!==undefined;
  const hasMax=meta?.max_hits!==null&&meta?.max_hits!==undefined;
  if(hasMin!==hasMax)throw new RangeError('Faixa de acertos incompleta.');
  if(hasMin&&(!Number.isSafeInteger(meta!.min_hits)
    ||!Number.isSafeInteger(meta!.max_hits)
    ||meta!.min_hits!<1||meta!.max_hits!>10
    ||meta!.min_hits!>meta!.max_hits!))
    throw new RangeError('Faixa de acertos inválida.');
  const scarcity=.45*(45-move.pp);
  const priority=move.priority>0?3:0;
  const power=move.power??0;
  if(move.damage_class.name==='status'){
    if(power!==0||hasMin)throw new RangeError('Suporte com dano impossível.');
    if(category==='heal'){
      // 50% de cura: 18 de escassez + 18 do poder de cura = 36 SP.
      // Cura maior de 50% tem custo adicional, sempre teto 40 SP.
      const healingBonus=18+Math.max(0,Math.ceil(((healing??50)-50)/5));
      return clamp(10,KANTO_SP_BALANCE.maxMoveSpCost,
        Math.round(scarcity+healingBonus+priority));
    }
    // Prévia genérica para buff/debuff/ailment: ainda NÃO equipável.
    return clamp(10,36,Math.round(scarcity+12+priority));
  }
  if(power<=0)throw new RangeError('Golpe de dano sem poder.');
  const hits=!hasMin?1
    :meta!.min_hits===2&&meta!.max_hits===5?2.5
      :(meta!.min_hits!+meta!.max_hits!)/2;
  const effect=category&&category!=='damage'?4:0;
  return clamp(KANTO_SP_BALANCE.minMoveSpCost,KANTO_SP_BALANCE.maxMoveSpCost,
    Math.round(scarcity+.18*power*hits+effect+priority));
}
