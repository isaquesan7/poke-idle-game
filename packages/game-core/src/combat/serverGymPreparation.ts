/** ONLINE-01C-23B2B — PURE, server-owned Kanto Gym roster and bonus quote.
 *
 * No browser-supplied combatants/stats or arbitrary bonus totals. Equipment
 * bonuses require a valid ownership ledger, unlike legacy /play previews.
 * Badge order, title unlocks, level-up move legality and upgrade permissions
 * are checked using the SAME catalogs as the already shipped game.
 *
 * This does not start a Gym, issue seeds, add badges, XP or write any save.
 * Region (1v1) snapshots share the same canonical trainer bonuses.
 */
import {KANTO_GYMS,kantoNextGym} from '../gyms/kantoGyms.js';
import {prepareGymOpponent,prepareGymLeader} from '../gyms/gymTactics.js';
import {createGymBattleState} from '../gyms/gymBattleState.js';
import {validatedOnlineMoveRanks,equippedOnlineRanks} from './serverMoveRanks.js';
import {validatedMachineLessons} from './serverMachineLessons.js';
import {inheritedOnlineMoves,regionalNativeMoves} from './serverInheritedMoves.js';
import {gymPsychicLevelMoves} from '../gyms/gymPsychicMoves.js';
import {LEGACY_TITLES,legacyTitleIsUnlocked}
  from '../legacy/catalog.js';
import {inspectOnlineInventory,onlineGearForSlot} from '../inventory/onlineOwnership.js';
import {KANTO_BATTLE_SPECIES} from './kantoBattle.js';
import {kantoPokemonFormProfile,validKantoMegaEntitlement} from '../catalog/kantoMegaForms.js';
import {trainerTotals} from '../stats/trainer.js';
import {masteryBonusFromSave} from '../progression/kantoMastery.js';
import {pokemonMasteryStats,pokemonFinalStats} from '../stats/pokemon.js';
import {STATS,zeroStats} from '../stats/types.js';
import type {StatValues,StatBonus} from '../stats/types.js';
import type {KantoMove,Combatant} from './kantoBattle.js';
import type {EquipmentSlot} from '../stats/trainer.js';
import type {GymBattleState} from '../gyms/gymBattleState.js';

type RecordValue=Record<string,unknown>;
const isRecord=(value:unknown):value is RecordValue=>
  !!value&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,min:number,max:number):value is number=>
  typeof value==='number'&&Number.isSafeInteger(value)&&
  value>=min&&value<=max;
const MOVE=/^[a-z][a-z-]{1,63}$/;
const SLOTS=['hat','jacket','gloves','pants','shoes',
  'necklace','ring1','ring2','earrings'] as const;

function manualStats(value:unknown,level:number,maxPerStat=40):StatValues|null{
  if(!isRecord(value)||Object.keys(value).length!==STATS.length||
     Object.keys(value).some(key=>!(STATS as readonly string[]).includes(key)))
    return null;
  const points=zeroStats();
  for(const stat of STATS){
    const n=value[stat];
    if(!integer(n,0,maxPerStat))return null;
    points[stat]=n;
  }
  return STATS.reduce((n,stat)=>n+points[stat],0)<=
    (level-1)*2?points:null;
}
/** The server's Gym can implement extra FRLG psychic level-up effects.
 * That permission is Gym-only, not a leak into Region 1v1 move lists.
 */
export function canonicalOnlineGymEquippedMoves(
  speciesId:number,level:number,moveNames:unknown,history?:unknown,lessons?:unknown
):readonly KantoMove[]|null{
  if(!integer(speciesId,1,151)||!integer(level,1,100)||
     !Array.isArray(moveNames)||moveNames.length<1||moveNames.length>4||
     !moveNames.every(name=>typeof name==='string'&&MOVE.test(name))||
     new Set(moveNames).size!==moveNames.length)return null;
  const species=KANTO_BATTLE_SPECIES[speciesId];
  if(!species)return null;
  const inherited=inheritedOnlineMoves(speciesId,level,history,lessons);
  const machine=validatedMachineLessons(speciesId,level,history,lessons);
  if(!inherited||!machine)return null;
  // The Collection/Region contract determines fallback eligibility.
  // Gym-only psychic effects must never suppress a legal shared attack.
  // Preserve the existing Gym-only level-up allowance, but shared moves
  // (including verified inherited moves) keep their canonical definitions.
  const legal=new Map<string,KantoMove>(
    gymPsychicLevelMoves(speciesId,level).map(entry=>[entry.move.name,entry.move]));
  for(const [name,move] of inherited)legal.set(name,move);
  for(const [name,move] of regionalNativeMoves(speciesId,level))legal.set(name,move);
  for(const [name,move] of machine)legal.set(name,move);
  const result=moveNames.map(name=>legal.get(name));
  return result.every((move):move is KantoMove=>!!move)?
    result as KantoMove[]:null;
}

export interface OnlineGymTrainerBonuses {
  readonly manual:Readonly<StatValues>;
  readonly equipment:readonly {readonly slot:EquipmentSlot;readonly itemId:string}[];
  readonly activeTitle:string;
  readonly badges:readonly string[];
  readonly totals:Readonly<StatValues>;
}
/** Pure quote: never fabricate item ownership from equipped item IDs.
 * A legacy-untracked inventory is NOT evidence of possession.
 */
export function canonicalOnlineGymTrainerBonuses(source:unknown):
 OnlineGymTrainerBonuses|null{
  if(!isRecord(source)||source.version!==1||source.mode!=='normal'||
     !isRecord(source.trainer)||!integer(source.trainer.level,1,100)||
     !integer(source.wins,0,1_000_000_000)||
     !Array.isArray(source.seen)||
     !source.seen.every(id=>integer(id,1,151))||
     new Set(source.seen).size!==source.seen.length||
     !Array.isArray(source.badges)||
     source.badges.length>KANTO_GYMS.length||
     source.badges.some((id,i)=>id!==KANTO_GYMS[i]?.id))
    return null;
  const trainer=source.trainer;
  if(!integer(trainer.level,1,100))return null;
  const manual=manualStats(trainer.manual,trainer.level);
  if(!manual||!isRecord(trainer.equipped)||
     Object.keys(trainer.equipped).some(slot=>
       !(SLOTS as readonly string[]).includes(slot)))
    return null;
  const inventory=inspectOnlineInventory(source.inventory);
  if(!inventory)return null;
  const items:{slot:EquipmentSlot;itemId:string;stats:StatBonus}[]=[];
  for(const slot of SLOTS){
    const itemId=trainer.equipped[slot];
    if(itemId===undefined||itemId==='')continue;
    if(typeof itemId!=='string')return null;
    const item=onlineGearForSlot(inventory,itemId,slot,trainer.level);
    if(!item)return null;
    items.push({slot,itemId,stats:item.stats});
  }
  const badgeDefs=KANTO_GYMS.slice(0,source.badges.length);
  const title=LEGACY_TITLES.find(t=>t.id===trainer.title);
  if(!title||!legacyTitleIsUnlocked(
      title.id,source.wins,source.seen.length,badgeDefs.length))
    return null; // Fail closed, never silently upgrade or downgrade titles.
  const totals=trainerTotals({
    manual,
    equipment:items.map(item=>({slot:item.slot,stats:item.stats})),
    activeTitle:title.stats,
    badges:badgeDefs.map(b=>({id:b.id,stats:b.badgeStats}))
  });
  return {
    manual,equipment:items.map(({slot,itemId})=>({slot,itemId})),
    activeTitle:title.id,badges:badgeDefs.map(g=>g.id),totals
  };
}
/** Shared canonical owned fighter for Gym and Santuário; caller selects a real UID. */
export function canonicalOnlineOwnedCombatant(source:RecordValue,p:unknown,bonuses:OnlineGymTrainerBonuses):Combatant|null{
    if(!isRecord(p)||!integer(p.pokemonId,1,151)||
       !integer(p.level,1,100)||!integer(p.affinity,0,100)||
       typeof p.moveName!=='string'||!MOVE.test(p.moveName))
      return null;
    const pokemonManual=manualStats(p.manual,p.level,(p.level-1)*2);
    if(!pokemonManual)return null;
    const names=p.equippedMoveNames===undefined?
      [p.moveName]:p.equippedMoveNames;
    if(!Array.isArray(names)||names[0]!==p.moveName)return null;
    const moves=canonicalOnlineGymEquippedMoves(p.pokemonId,p.level,names,p.evolutionHistory,p.machineLessons);
    if(!moves)return null;
    const validated=validatedOnlineMoveRanks(p.pokemonId,p.level,p.evolutionHistory,p.upgrades,p.machineLessons);
    if(!validated)return null;
    const ranks=Object.keys(validated).length?equippedOnlineRanks(moves,validated):{};
    const species=kantoPokemonFormProfile(p.pokemonId,p.megaForm);
    if(!species||!validKantoMegaEntitlement(p.pokemonId,p.megaForm,p.megaTrialForm))return null;
    const mastery=masteryBonusFromSave(source.research,p.pokemonId);
    if(!mastery)return null;
    const combatant:Combatant={
      speciesId:species.speciesId,name:species.name,level:p.level,
      types:species.types,
      ...(species.formId?{megaForm:species.formId}:{}),
      ...(moves.some(m=>m.name==='return'||m.name==='frustration')?{affinity:p.affinity}:{}),
      stats:pokemonMasteryStats(pokemonFinalStats(species.base,p.level,pokemonManual,
        bonuses.totals,p.affinity),mastery.statPercent),
      move:moves[0]!,moves,rank:ranks[moves[0]!.name]??0,ranks
    };
    return combatant;
}
export interface OnlineGymPreparationV1 {
  readonly version:1;
  readonly gymId:string;
  readonly leader:string;
  readonly teamUids:readonly [number,number,number];
  readonly trainer:OnlineGymTrainerBonuses;
  readonly player:readonly [
    {readonly uid:number;readonly combatant:Combatant},
    {readonly uid:number;readonly combatant:Combatant},
    {readonly uid:number;readonly combatant:Combatant}
  ];
  readonly leaderTeam:readonly [Combatant,Combatant,Combatant];
  readonly leaderTrainer:ReturnType<typeof prepareGymLeader>;
}
/** Three real members ONLY from the already-selected Collection team.
 * Not a wild battle, not the local Gym session, and not yet an online writer.
 */
export function canonicalOnlineGymPreparation(source:unknown):
 OnlineGymPreparationV1|null{
  const bonuses=canonicalOnlineGymTrainerBonuses(source);
  if(!bonuses||!isRecord(source)||!Array.isArray(source.team)||
     source.team.length!==3||
     !source.team.every(uid=>integer(uid,1,Number.MAX_SAFE_INTEGER))||
     new Set(source.team).size!==3||
     !Array.isArray(source.roster)||source.roster.length<3||
     !integer(source.nextUid,4,Number.MAX_SAFE_INTEGER)||
     !source.roster.every(p=>isRecord(p)&&
       integer(p.uid,1,Number(source.nextUid)-1))||
     new Set(source.roster.map(p=>(p as RecordValue).uid)).size!==
       source.roster.length||
     source.expedition!==null||
     (source.gymSession!==undefined&&source.gymSession!==null)||
     (source.pendingBattle!==undefined&&source.pendingBattle!==null)||
     (isRecord(source.lastBattle)&&source.lastBattle.captureStatus==='available'))
    return null;
  const gym=kantoNextGym(bonuses.badges);
  if(!gym)return null; // All eight badges: no next gym.
  const players:{uid:number;combatant:Combatant}[]=[];
  for(const uid of source.team){
    const p=source.roster.find(entry=>isRecord(entry)&&entry.uid===uid);
    const combatant=canonicalOnlineOwnedCombatant(source,p,bonuses);
    if(!combatant)return null;
    players.push({uid,combatant});
  }
  const opponent=prepareGymOpponent(gym);
  return {
    version:1,gymId:gym.id,leader:gym.leader,
    teamUids:[source.team[0]!,source.team[1]!,source.team[2]!],
    trainer:bonuses,
    player:players as unknown as OnlineGymPreparationV1['player'],
    leaderTeam:opponent.team,leaderTrainer:opponent.trainer
  };
}

/** Server-only start-of-fight fixture, NOT a stored or resolved Gym match.
 * A future authenticated writer must lock the save, freeze the trio and sign
 * turns/settlement before exposing this to any player-facing online route.
 */
export function canonicalOnlineGymOpeningState(source:unknown):
 {readonly preparation:OnlineGymPreparationV1;
  readonly battle:GymBattleState}|null{
  const preparation=canonicalOnlineGymPreparation(source);
  if(!preparation)return null;
  return {preparation,battle:createGymBattleState(
    preparation.player,preparation.leaderTeam)};
}
