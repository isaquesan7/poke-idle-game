/**
 * ONLINE-01C-11 — offline pure adapter for a frozen SERVER-OWNED snapshot.
 * No database writes, transport, grants, captures, or client-supplied combatants.
 * The API bundles this game-core in its isolated runtime and derives
 * battle seeds exclusively from the persisted encounter's private entropy.
 */
import {KANTO_BATTLE_SPECIES,simulateKantoBattle} from '../combat/kantoBattle.js';
import {validatedOnlineMoveRanks,equippedOnlineRanks} from './serverMoveRanks.js';
import {masteryBonusFromPoints} from '../progression/kantoMastery.js';
import {serverRegionalOpponent} from './serverRegionalPolicy.js';
import {validatedMachineLessons} from './serverMachineLessons.js';
import type {MachineLesson} from '../progression/kantoMachineTeaching.js';
import {inheritedOnlineMoves,regionalNativeMoves} from './serverInheritedMoves.js';
import type {OnlineEvolutionStep} from './serverInheritedMoves.js';
import {kantoWildMoveLoadout} from '../catalog/kantoWildMoves.js';
import {pokemonMasteryStats,pokemonFinalStats,pokemonOwnStats} from '../stats/pokemon.js';
import {canonicalOnlineGymTrainerBonuses} from './serverGymPreparation.js';
import {inspectOnlineInventory} from '../inventory/onlineOwnership.js';
import type {OnlineInventory} from '../inventory/onlineOwnership.js';
import type {EquipmentSlot} from '../stats/trainer.js';
import {STATS,zeroStats} from '../stats/types.js';
import type {StatValues} from '../stats/types.js';
import type {Combatant,KantoMove} from '../combat/kantoBattle.js';

export interface ServerBattleSnapshotV1 {
  readonly version:1;
  readonly regionId:number;
  readonly tmLootVersion?:1;
  readonly masteryPoints?:Readonly<Record<string,number>>;
  readonly opponent:{readonly speciesId:number;readonly level:number};
  readonly trainer:{readonly level:number;readonly manual:Readonly<StatValues>;
    readonly equipped:Readonly<Partial<Record<EquipmentSlot,string>>>;
    readonly title:string;readonly wins:number;readonly seen:readonly number[];
    readonly badges:readonly string[];readonly inventory:OnlineInventory};
  readonly activePokemon:{
    readonly uid:number;readonly speciesId:number;readonly level:number;
    readonly affinity:number;readonly manual:Readonly<StatValues>;
    readonly moveName:string;
  };
}
/** v2 records an EXPLICIT equipped loadout, not the entire learned catalog.
 * The original v1 snapshot remains valid for in-flight 1-move encounters.
 */
export interface ServerBattleSnapshotV2 extends
  Omit<ServerBattleSnapshotV1,'version'|'activePokemon'> {
  readonly version:2;
  readonly activePokemon:ServerBattleSnapshotV1['activePokemon']&{
    readonly moveNames:readonly string[];
    readonly evolutionHistory?:readonly OnlineEvolutionStep[];
    readonly upgrades?:Readonly<Record<string,number>>;
    readonly machineLessons?:readonly MachineLesson[];
  };
}
/** Only canonical FRLG learned/implemented moves (plus the historical
 * no-offense fallback) are legal. No TM/egg/tutor or level-locked moves.
 * This is used by BOTH the equip writer and frozen battle constructor.
 */
export function frozenValidatedEquippedMoves(
  speciesId:number,level:number,names:unknown,history?:unknown,lessons?:unknown
):readonly KantoMove[]|null{
  if(!Number.isSafeInteger(speciesId)||speciesId<1||speciesId>151||
     !Number.isSafeInteger(level)||level<1||level>100||
     !Array.isArray(names)||names.length<1||names.length>4||
     !names.every(name=>typeof name==='string'&&
       /^[a-z][a-z-]{1,63}$/.test(name))||
     new Set(names).size!==names.length)return null;
  const species=KANTO_BATTLE_SPECIES[speciesId];
  if(!species)return null;
  const inherited=inheritedOnlineMoves(speciesId,level,history,lessons);
  const learned=validatedMachineLessons(speciesId,level,history,lessons);
  if(!inherited||!learned)return null;
  const legal=new Map([...inherited,...regionalNativeMoves(speciesId,level),...learned]);
  const result=names.map(name=>legal.get(name));
  return result.every((move):move is KantoMove=>!!move)?
    Object.freeze(result as KantoMove[]):null;
}


function manualValid(values:unknown,maxBudget:number,maxPerStat=40):values is StatValues{
  if(!values||typeof values!=='object'||Array.isArray(values))return false;
  const obj=values as Record<string,unknown>;
  if(Object.keys(obj).length!==STATS.length
    ||Object.keys(obj).some(key=>!(STATS as readonly string[]).includes(key)))return false;
  let sum=0;
  for(const stat of STATS){
    const n=obj[stat];
    if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0||n>maxPerStat)return false;
    sum+=n;
  }
  return sum<=maxBudget;
}

export function canonicalFrozenCombatants(snapshot:unknown):
  {readonly player:Combatant;readonly wild:Combatant}|null{
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return null;
  const s=snapshot as Partial<ServerBattleSnapshotV1|ServerBattleSnapshotV2>;
  const player=s.activePokemon,trainer=s.trainer,enemy=s.opponent;
  if((s.tmLootVersion!==undefined&&s.tmLootVersion!==1)||(s.version!==1&&s.version!==2)||typeof s.regionId!=='number'||!player||!trainer||!enemy
     ||!Number.isSafeInteger(trainer.level)||trainer.level<1||trainer.level>100
     ||!Number.isSafeInteger(player.uid)||player.uid<1
     ||!Number.isSafeInteger(player.level)||player.level<1||player.level>100
     ||!Number.isSafeInteger(player.speciesId)||player.speciesId<1||player.speciesId>151
     ||!Number.isSafeInteger(player.affinity)||player.affinity<0||player.affinity>100
     ||!Number.isSafeInteger(enemy.speciesId)||enemy.speciesId<1||enemy.speciesId>151
     ||!Number.isSafeInteger(enemy.level)||enemy.level<2||enemy.level>100
     // Historical R1 fixtures may contain non-pool species; preserve the
     // existing snapshot contract. New regions require catalog membership.
     ||(s.regionId===1?enemy.level>10:!serverRegionalOpponent(s.regionId,trainer.level,enemy.speciesId,enemy.level))
     ||typeof player.moveName!=='string'
     ||!manualValid(trainer.manual,(trainer.level-1)*2)
     ||!manualValid(player.manual,(player.level-1)*2,(player.level-1)*2))return null;
  const own=KANTO_BATTLE_SPECIES[player.speciesId];
  const other=KANTO_BATTLE_SPECIES[enemy.speciesId];
  if(!own||!other)return null;
  const rawNames=(player as {moveNames?:unknown}).moveNames;
  // Legacy v1 cannot smuggle a multi-move loadout without versioning it.
  // v2 MUST bind the first equipped slot to the legacy primary moveName.
  const history=(player as {evolutionHistory?:unknown}).evolutionHistory;
  const upgrades=(player as {upgrades?:unknown}).upgrades;
  const lessons=(player as {machineLessons?:unknown}).machineLessons;
  if(s.version===1&&(rawNames!==undefined||history!==undefined||upgrades!==undefined||lessons!==undefined))return null;
  if(s.version===2&&(!Array.isArray(rawNames)||
     rawNames[0]!==player.moveName))return null;
  const equipped=frozenValidatedEquippedMoves(
    player.speciesId,player.level,s.version===2?rawNames:[player.moveName],history,lessons);
  if(!equipped)return null;
  const ranks=validatedOnlineMoveRanks(player.speciesId,player.level,history,upgrades,lessons);
  if(!ranks)return null;
  const selected=equipped[0]!;
  const equippedRanks=equippedOnlineRanks(equipped,ranks);
  // Required current snapshot contract. Recompute from canonical sources;
  // no client totals and no fallback to manual-only laboratory snapshots.
  if(!inspectOnlineInventory(trainer.inventory))return null;
  const bonuses=canonicalOnlineGymTrainerBonuses({version:1,mode:'normal',
    trainer:{level:trainer.level,manual:trainer.manual,equipped:trainer.equipped,title:trainer.title},
    wins:trainer.wins,seen:trainer.seen,badges:trainer.badges,inventory:trainer.inventory});
  if(!bonuses)return null;
  const trainerStats=bonuses.totals;
  const mastery=masteryBonusFromPoints(s.masteryPoints,player.speciesId);
  if(!mastery)return null;
  const playerCombatant:Combatant={
    speciesId:own.id,name:own.name,types:own.types,level:player.level,
    ...(equipped.some(m=>m.name==='return'||m.name==='frustration')?{affinity:player.affinity}:{}),
    stats:pokemonMasteryStats(pokemonFinalStats(own.base,player.level,player.manual,
      trainerStats,player.affinity),mastery.statPercent),
    move:selected,moves:equipped,rank:equippedRanks[selected.name]??0,
    ...(Object.keys(ranks).length?{ranks:equippedRanks}:{})
  };
  const wildMoves=kantoWildMoveLoadout(enemy.speciesId,enemy.level,other.move);
  const wildCombatant:Combatant={
    speciesId:other.id,name:other.name,types:other.types,level:enemy.level,
    stats:pokemonOwnStats(other.base,enemy.level,zeroStats()),
    move:wildMoves[0]!,moves:wildMoves,rank:0
  };
  return {player:playerCombatant,wild:wildCombatant};
}

/**
 * Stateless battle PREVIEW using the same canonical PvE battle engine as /play.
 * Seed must be a server-internal uint32 from private encounter entropy.
 * Deliberately omits the legacy engine's automatic capture/reward flags:
 * online captures, XP, affinity, ball consumption and wallet are separate
 * server-authoritative actions that have NOT been implemented.
 */
export function previewFrozenWildBattle(snapshot:unknown,serverSeed:number){
  if(!Number.isSafeInteger(serverSeed)||serverSeed<0||serverSeed>0xffffffff)
    return null;
  const pair=canonicalFrozenCombatants(snapshot);
  if(!pair)return null;
  // The old automatic preview does not model the shared online TM support
  // effects. Refuse these loadouts instead of throwing or simulating a false result.
  if((pair.player.moves??[pair.player.move]).some(m=>['toxic','calm-mind','bulk-up','steel-wing','overheat','reflect','light-screen','safeguard','protect','brick-break','sunny-day','rain-dance','sandstorm','hail','thunder','rest','solar-beam','dig','hyper-beam','taunt','double-team','ice-beam','blizzard','return','frustration','facade','focus-punch','roar','torment','snatch','secret-power'].includes(m.name)))return null;
  const result=simulateKantoBattle(pair.player,pair.wild,serverSeed);
  // Legacy engine auto-rolls a 35% capture and says rewards were granted.
  // Those are NOT authoritative online actions. Preserve one frame per
  // retained line, without exposing a fictitious capture or grant.
  const log:string[]=[];
  const frames:typeof result.frames[number][]=[];
  for(let index=0;index<result.log.length;index++){
    const line=result.log[index]!;
    if(line.startsWith('Captura! '))continue;
    log.push(line==='Vitória! Recompensas de combate recebidas.'
      ?'Vitória! Resultado calculado; recompensas ainda não concedidas.'
      :line);
    frames.push(result.frames[index]!);
  }
  return {
    outcome:result.outcome,turns:result.turns,
    playerRemainingHp:result.playerRemainingHp,
    wildRemainingHp:result.wildRemainingHp,
    playerRemainingSp:result.playerRemainingSp,
    wildRemainingSp:result.wildRemainingSp,
    log,frames
  };
}
