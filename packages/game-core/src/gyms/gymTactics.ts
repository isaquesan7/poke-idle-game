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
import {gymPsychicLevelMoves} from './gymPsychicMoves.js';
import {pokemonFinalStats} from '../stats/pokemon.js';
import {trainerTotals,MANUAL_TRAINER_CAP} from '../stats/trainer.js';
import {gymSignatureTm} from './gymSignatureTms.js';
import {LEGACY_ITEMS} from '../legacy/catalog.js';
import {legacyMoveRankLimits} from '../legacy/pokemonMoveReducer.js';
import {KANTO_GYMS} from './kantoGyms.js';
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
    ...gymPsychicLevelMoves(speciesId,level),
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
  if(!options.length)throw new RangeError('Espécie '+speciesId+' nível '+level+' sem golpe executável: ampliar motor antes de liberar ginásio.');
  return options;
}

/** Integer proportional allocation with legal cap; reallocate capped excess. */
function allocateTraining(budget:number,weights:Readonly<Partial<Record<Stat,number>>>,cap:number):StatValues{
 const points=zeroStats();
 for(let i=0;i<budget;i++){
  const choices=STATS.filter(s=>points[s]<cap);
  const stat=choices.sort((a,b)=>(weights[b]??0)/(points[b]+1)-(weights[a]??0)/(points[a]+1)||STATS.indexOf(a)-STATS.indexOf(b))[0];
  if(!stat)throw new RangeError('Orçamento incompatível com teto.');
  points[stat]++;
 }
 return points;
}
/** Recommendation uses species base stats AND the actual offensive categories.
 * No special-attack investment for a physical-only loadout, and vice versa.
 */
export function gymPokemonTraining(speciesId:number,level:number,moves:readonly KantoMove[]):StatValues{
 const species=kantoSpecies(speciesId);
 if(!species||!Number.isSafeInteger(level)||level<1||level>100)throw new RangeError('Espécie/nível inválido.');
 const b=species.base;
 return allocateTraining(2*(level-1),{
  hp:b.hp*1.2,defense:b.defense*1.4,specialDefense:b.specialDefense,
  speed:b.speed*1.2,
  attack:moves.some(m=>m.category==='physical'&&m.power>0)?b.attack*1.5:0,
  specialAttack:moves.some(m=>m.category==='special'&&m.power>0)?b.specialAttack*1.5:0
 },198);
}
/** NPC equipment is an explicit legal loadout, not a grant to the player.
 * Early leaders have fewer slots; later leaders have more. Prior badges only,
 * exclusive NPC title, never exposed in player catalogue.
 */
const LEADER_ITEMS:readonly (readonly string[])[]=[
 ['cap','coat'],
 ['gloves-tech','shoes','necklace'],
 ['visor','gloves-tech','shoes','necklace'],
 ['battle-jacket','gloves-tech','pants','necklace','ring-b'],
 ['visor','coat','pants','shoes','ring-d'],
 ['visor','gloves-tech','shoes','necklace','earrings','ring-d'],
 ['battle-jacket','gloves','shoes','necklace','earrings','ring-a','ring-d'],
 ['cap','coat','gloves','pants','shoes','ring-a','ring-c','earrings']
];
export const GYM_LEADER_TITLE=Object.freeze({id:'gym-leader',name:'Líder de Ginásio',stats:Object.freeze({hp:6,attack:6,defense:6,specialAttack:6,specialDefense:6,speed:6})});
export function prepareGymLeader(gym:KantoGymDefinition){
 const level=gym.trainerLevel;
 if(!Number.isSafeInteger(level)||level<1||level>100||!Number.isSafeInteger(gym.order)||gym.order<1||gym.order>8)throw new RangeError('Líder inválido.');
 // Give even low-priority attributes a weight so late leaders redistribute
 // excess beyond 40 across all six attributes rather than lose points.
 const weights=Object.fromEntries(STATS.map(s=>[s,(PROFILE_WEIGHTS[gym.order-1]![s]??0)+1]));
 const manual=allocateTraining(2*(level-1),weights,MANUAL_TRAINER_CAP);
 const equipment=LEADER_ITEMS[gym.order-1]!.map(id=>{
  const item=LEGACY_ITEMS.find(item=>item.id===id);
  if(!item)throw new RangeError('Equipamento inválido.');
  return {itemId:id,slot:item.slot,stats:item.stats};
 });
 const title=GYM_LEADER_TITLE;
 const badges=KANTO_GYMS.slice(0,gym.order-1).map(g=>({id:g.id,stats:g.badgeStats}));
 const totals=trainerTotals({manual,equipment,activeTitle:title.stats,badges});
 return {level,manual,equipment,activeTitle:title.id,badges:badges.map(b=>b.id),totals,affinity:100};
}
/** Prioritize strong, accurate STAB attacks aligned with the species.
 * Spend every feasible point without exceeding per-move caps.
 * Never rank support, basic or fixed-damage attacks with zero power.
 */
export function gymOpponentRanks(speciesId:number,level:number,moves:readonly KantoMove[]):Record<string,number>{
 const species=kantoSpecies(speciesId)!;
 const limits=legacyMoveRankLimits(level);
 const attacks=moves.filter(m=>m.category!=='status'&&m.power>0);
 const score=(m:KantoMove)=>m.power*m.accuracy/100*
  (species.types.includes(m.type)?1.5:1)*(m.category==='physical'?species.base.attack:species.base.specialAttack);
 const ordered=[...attacks].sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name));
 const ranks:Record<string,number>=Object.fromEntries(moves.map(m=>[m.name,0]));
 let remaining=limits.skillPoints;
 for(const move of ordered){
  const rank=Math.min(remaining,limits.maxRankPerMove);
  ranks[move.name]=rank;remaining-=rank;
 }
 return ranks;
}
/** Preserve the normal loadout unless more legal attacks are needed to spend
 * the rank budget. Replace the least recent support first, never invent TM.
 */
export function gymTrainedMoves(speciesId:number,level:number,gymId?:string):readonly KantoMove[]{
 const signature=gymId?gymSignatureTm(gymId,speciesId)?.move:undefined;
 const moves=[...(signature?[signature]:[]),...gymLegalMoves(speciesId,level).filter(m=>m.name!==signature?.name)].slice(0,4);
 const {skillPoints,maxRankPerMove}=legacyMoveRankLimits(level);
 const offensive=(m:KantoMove)=>m.category!=='status'&&m.power>0;
 const required=Math.min(4,Math.max(1,Math.ceil(skillPoints/maxRankPerMove)));
 const candidates=[...kantoLevelMoves(speciesId,level),...gymPsychicLevelMoves(speciesId,level)]
  .sort((a,b)=>b.learnedAt-a.learnedAt||a.move.name.localeCompare(b.move.name));
 for(const {move} of candidates){
  if(moves.filter(offensive).length>=required)break;
  if(!offensive(move)||moves.some(m=>m.name===move.name))continue;
  if(moves.length<4)moves.push(move);
  else {
   let index=moves.length-1;
   while(index>=0&&offensive(moves[index]!))index--;
   if(index<0)break;
   moves[index]=move;
  }
 }
 return moves;
}
export interface GymPreparedOpponent {
  readonly gymId:string;
  readonly trainer:ReturnType<typeof prepareGymLeader>;
  readonly team:readonly [Combatant,Combatant,Combatant];
}
export function prepareGymOpponent(gym:KantoGymDefinition):GymPreparedOpponent{
  if(!Number.isSafeInteger(gym.order)||gym.order<1||gym.order>8||gym.team.length!==3)
    throw new RangeError('Definição de ginásio inválida.');
  const trainer=prepareGymLeader(gym);
  const team=gym.team.map(({speciesId,level})=>{
    const species=kantoSpecies(speciesId);
    if(!species)throw new RangeError('Espécie inválida.');
    const moves=gymTrainedMoves(speciesId,level,gym.id);
    const manual=gymPokemonTraining(speciesId,level,moves);
    const ranks=gymOpponentRanks(speciesId,level,moves);
    return {
      speciesId,name:species.name,level,types:species.types,
      stats:pokemonFinalStats(species.base,level,manual,trainer.totals,trainer.affinity),
      move:moves[0]!,moves,rank:ranks[moves[0]!.name]??0,ranks
    } satisfies Combatant;
  });
  return {gymId:gym.id,trainer,team:team as unknown as [Combatant,Combatant,Combatant]};
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
  /** False quando Concentrar esgotou quotas ou cooldown no motor 3×3. */
  readonly allowConcentrate?:boolean;
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
    {...combatantWithoutSlots,move,rank:move.name===KANTO_BASIC_ATTACK.name?0:actor.ranks?.[move.name]??(move.name===actor.move.name?actor.rank:0)},defender,.5,.5);
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
  if(actorSp<maxSp&&args.allowConcentrate!==false){
    decisions.push({action:'concentrate',score:actorSp<15?28:actorSp<30?12:-25});
  }
  const sorted=decisions.sort((a,b)=>b.score-a.score||
    (a.action==='move'?0:a.action==='concentrate'?1:2)-
    (b.action==='move'?0:b.action==='concentrate'?1:2));
  return sorted[0]!;
}
