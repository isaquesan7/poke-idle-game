/**
 * GYM-02A: preparação legal de equipes e escolha tática transparente.
 *
 * Não executa turnos, não altera saves, não concede prêmios e não pode ser
 * ligado diretamente a /play. O motor 3x3 posterior consumirá esses dados.
 */
import type {Combatant,KantoMove} from '../combat/kantoBattle.js';
import {kantoDamage,kantoTypeMultiplier} from '../combat/kantoBattle.js';
import {kantoMaxSp,kantoMoveSpCost,KANTO_BASIC_ATTACK} from '../combat/kantoSkillEnergy.js';
import {kantoLevelMoves} from '../catalog/kantoLevelMoves.js';
import {kantoSupportMoves,kantoSupportEffect} from '../catalog/kantoSupportMoves.js';
import {kantoSpecies} from '../catalog/kantoSpecies.js';
import {pokemonOwnStats} from '../stats/pokemon.js';
import {STATS,zeroStats} from '../stats/types.js';
import type {Stat,StatValues} from '../stats/types.js';
import type {KantoGymDefinition} from './kantoGyms.js';

export type GymTeamSlot={readonly uid:number;readonly combatant:Combatant};
/** Escolha de três UIDs distintos, sem aceitar falsificação do elenco. */
export function selectGymTeam(
  owned:readonly GymTeamSlot[],selectedUids:readonly number[],
  unavailableUids:readonly number[]=[]
):readonly [GymTeamSlot,GymTeamSlot,GymTeamSlot]|null{
  if(!Array.isArray(owned)||!Array.isArray(selectedUids)
    ||selectedUids.length!==3||new Set(selectedUids).size!==3
    ||selectedUids.some(uid=>!Number.isSafeInteger(uid)||uid<1)
    ||new Set(unavailableUids).size!==unavailableUids.length)return null;
  const selected=selectedUids.map(uid=>owned.find(p=>p.uid===uid));
  if(selected.some(p=>!p)||selectedUids.some(uid=>unavailableUids.includes(uid))
    ||new Set(owned.map(p=>p.uid)).size!==owned.length)return null;
  return selected as [GymTeamSlot,GymTeamSlot,GymTeamSlot];
}

/** Investimento legal por nível: orçamento da instância = 2*(nível-1).
 * Distribuição em inteiros pelo maior resto; não há IV/EV clandestinos.
 */
const PROFILE_WEIGHTS:readonly (Readonly<Partial<Record<Stat,number>>>)[]=[
  {defense:35,hp:30,attack:20,specialDefense:15},
  {specialAttack:40,speed:25,hp:20,specialDefense:15},
  {speed:40,specialAttack:35,hp:25},
  {specialAttack:30,specialDefense:25,hp:25,defense:20},
  {speed:40,defense:25,hp:20,specialAttack:15},
  {specialAttack:45,speed:35,hp:20},
  {specialAttack:40,speed:30,hp:20,defense:10},
  {attack:40,defense:30,hp:20,speed:10}
];
export function gymTrainerPoints(gymOrder:number,level:number):StatValues{
  if(!Number.isSafeInteger(gymOrder)||gymOrder<1||gymOrder>8
    ||!Number.isSafeInteger(level)||level<1||level>100)
    throw new RangeError('Ginásio/nível inválido.');
  const budget=2*(level-1),weights=PROFILE_WEIGHTS[gymOrder-1]!;
  const output=zeroStats();
  let spent=0;
  const remnants=STATS.map((stat,i)=>{
    const exact=budget*(weights[stat]??0)/100;
    output[stat]=Math.floor(exact);
    spent+=output[stat];
    return {stat,remainder:exact-Math.floor(exact),order:i};
  }).sort((a,b)=>b.remainder-a.remainder||a.order-b.order);
  for(let i=0;i<budget-spent;i++)output[remnants[i]!.stat]++;
  return output;
}

/** Só golpes de nível FRLG já executáveis no catálogo, nunca TM preview.
 * Prioriza golpes recentes com cobertura e preserva suporte de cura/controle.
 */
export function gymLegalMoves(speciesId:number,level:number):readonly KantoMove[]{
  if(!kantoSpecies(speciesId)||!Number.isSafeInteger(level)||level<1||level>100)
    throw new RangeError('Espécie/nível inválido.');
  const candidates=[...kantoLevelMoves(speciesId,level),
    ...kantoSupportMoves(speciesId,level)]
    .sort((a,b)=>b.learnedAt-a.learnedAt||a.move.name.localeCompare(b.move.name));
  const seen=new Set<string>();
  const options:KantoMove[]=[];
  for(const {move} of candidates){
    if(seen.has(move.name))continue;
    seen.add(move.name);
    options.push(move);
    if(options.length===4)break;
  }
  if(!options.length)throw new RangeError('Espécie sem golpe executável: não equipar substituto fictício.');
  return options;
}

export interface GymPreparedOpponent {
  readonly gymId:string;
  readonly team:readonly [Combatant,Combatant,Combatant];
}
export function prepareGymOpponent(gym:KantoGymDefinition):GymPreparedOpponent{
  if(!Number.isSafeInteger(gym.order)||gym.order<1||gym.order>8||gym.team.length!==3)
    throw new RangeError('Definição de ginásio inválida.');
  const team=gym.team.map(({speciesId,level})=>{
    const species=kantoSpecies(speciesId);
    if(!species)throw new RangeError('Espécie inválida.');
    const moves=gymLegalMoves(speciesId,level);
    return {
      speciesId,name:species.name,level,types:species.types,
      stats:pokemonOwnStats(species.base,level,gymTrainerPoints(gym.order,level)),
      move:moves[0]!,moves,rank:0,ranks:{}
    } satisfies Combatant;
  });
  return {gymId:gym.id,team:team as unknown as [Combatant,Combatant,Combatant]};
}

export type GymAiDecision=
 | {readonly action:'move';readonly moveName:string;readonly score:number}
 | {readonly action:'switch';readonly toIndex:number;readonly score:number}
 | {readonly action:'concentrate';readonly score:number}
 | {readonly action:'basic';readonly score:number};

/** Uma heurística, não um resultado de batalha. Não lê RNG futuro.
 * Precisa receber HP/SP presentes e estado público antes da decisão.
 * Troca é tratada como consumo de turno no motor futuro.
 */
export function gymAiDecision(args:{
  readonly actor:Combatant;readonly defender:Combatant;
  readonly actorHp:number;readonly actorSp:number;
  readonly bench:readonly {readonly index:number;readonly combatant:Combatant;readonly hp:number}[];
  readonly consecutiveSwitches?:number;
}):GymAiDecision{
  const {actor,defender,actorHp,actorSp,bench}=args;
  const maxSp=kantoMaxSp(actor.level,actor.speciesId);
  if(!Number.isSafeInteger(actorHp)||actorHp<1||actorHp>actor.stats.hp
    ||!Number.isSafeInteger(actorSp)||actorSp<0||actorSp>maxSp
    ||!Number.isSafeInteger(args.consecutiveSwitches??0)
    ||(args.consecutiveSwitches??0)<0)throw new RangeError('Estado da IA inválido.');
  const moves=actor.moves??[actor.move];
  // A avaliação muda só o golpe temporário, sem reescrever o loadout.
  // A propriedade opcional 'moves' deve ser OMITIDA (exactOptionalPropertyTypes).
  const {moves: _loadout,...combatantWithoutSlots}=actor;
  const estimate=(move:KantoMove)=>kantoDamage(
    {...combatantWithoutSlots,move},defender,.5,.5);
  // Ataque básico gratuito permanece disponível mesmo com SP esgotado.
  const basicDamage=estimate(KANTO_BASIC_ATTACK).damage;
  const decisions:GymAiDecision[]=[{action:'basic',score:Math.round(
    100*basicDamage/Math.max(1,defender.stats.hp))}];
  for(const move of moves){
    const cost=kantoMoveSpCost(move);
    if(cost>actorSp)continue;
    if(move.category==='status'){
      const support=kantoSupportEffect(move.name);
      if(!support)continue;
      const hpRatio=actorHp/actor.stats.hp;
      let score= support.kind==='heal' ? (hpRatio<=.35?75:hpRatio<=.55?45:-30)
        :support.kind==='status'?25:12;
      if(support.kind==='status'&&move.type==='electric'
        &&kantoTypeMultiplier(move.type,defender.types)===0)score=-100;
      decisions.push({action:'move',moveName:move.name,score});
      continue;
    }
    // Dano previsível com rolls médios fixos, nunca os futuros resultados do RNG.
    const expected=estimate(move);
    const accuracy=move.accuracy/100;
    const damage=expected.damage*accuracy;
    const score=expected.effectiveness===0?-100
      :Math.round(100*damage/Math.max(1,defender.stats.hp))
        +(expected.damage>=defender.stats.hp?30:0)
        -(cost/5);
    decisions.push({action:'move',moveName:move.name,score});
  }
  // A IA não fica em looping de trocas para esquivar sem custo do ataque.
  if((args.consecutiveSwitches??0)===0){
    for(const option of bench){
      if(!Number.isSafeInteger(option.index)||option.index<0
        ||!Number.isSafeInteger(option.hp)||option.hp<0
        ||option.hp>option.combatant.stats.hp)throw new RangeError('Reserva inválida.');
      if(option.hp===0)continue;
      const weakness=kantoTypeMultiplier(defender.move.type,actor.types);
      const replacement=kantoTypeMultiplier(defender.move.type,option.combatant.types);
      const score=Math.round((weakness-replacement)*18)
        +Math.round(12*option.hp/option.combatant.stats.hp)-18;
      decisions.push({action:'switch',toIndex:option.index,score});
    }
  }
  if(actorSp<maxSp){
    decisions.push({action:'concentrate',score:actorSp<15?28:actorSp<30?12:-25});
  }
  const sorted=decisions.sort((a,b)=>b.score-a.score||
    (a.action==='move'?0:a.action==='concentrate'?1:2)-
    (b.action==='move'?0:b.action==='concentrate'?1:2));
  return sorted[0]!;
}
