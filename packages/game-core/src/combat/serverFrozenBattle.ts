/**
 * ONLINE-01C-11 — offline pure adapter for a frozen SERVER-OWNED snapshot.
 * No database writes, transport, grants, captures, or client-supplied combatants.
 * The API must later bundle game-core into its isolated runtime and derive
 * battle seeds exclusively from the persisted encounter's private entropy.
 */
import {KANTO_BATTLE_SPECIES,simulateKantoBattle} from '../combat/kantoBattle.js';
import {kantoLevelMoves} from '../catalog/kantoLevelMoves.js';
import {kantoSupportMoves} from '../catalog/kantoSupportMoves.js';
import {kantoWildMoveLoadout} from '../catalog/kantoWildMoves.js';
import {pokemonFinalStats,pokemonOwnStats} from '../stats/pokemon.js';
import {trainerTotals} from '../stats/trainer.js';
import {STATS,zeroStats} from '../stats/types.js';
import type {StatValues} from '../stats/types.js';
import type {Combatant,KantoMove} from '../combat/kantoBattle.js';

export interface ServerBattleSnapshotV1 {
  readonly version:1;
  readonly regionId:1;
  readonly opponent:{readonly speciesId:number;readonly level:number};
  readonly trainer:{readonly level:number;readonly manual:Readonly<StatValues>};
  readonly activePokemon:{
    readonly uid:number;readonly speciesId:number;readonly level:number;
    readonly affinity:number;readonly manual:Readonly<StatValues>;
    readonly moveName:string;
  };
}

function manualValid(values:unknown,maxBudget:number):values is StatValues{
  if(!values||typeof values!=='object'||Array.isArray(values))return false;
  const obj=values as Record<string,unknown>;
  if(Object.keys(obj).length!==STATS.length
    ||Object.keys(obj).some(key=>!(STATS as readonly string[]).includes(key)))return false;
  let sum=0;
  for(const stat of STATS){
    const n=obj[stat];
    if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0||n>40)return false;
    sum+=n;
  }
  return sum<=maxBudget;
}

export function canonicalFrozenCombatants(snapshot:unknown):
  {readonly player:Combatant;readonly wild:Combatant}|null{
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return null;
  const s=snapshot as Partial<ServerBattleSnapshotV1>;
  const player=s.activePokemon,trainer=s.trainer,enemy=s.opponent;
  if(s.version!==1||s.regionId!==1||!player||!trainer||!enemy
     ||!Number.isSafeInteger(trainer.level)||trainer.level<1||trainer.level>100
     ||!Number.isSafeInteger(player.uid)||player.uid<1
     ||!Number.isSafeInteger(player.level)||player.level<1||player.level>100
     ||!Number.isSafeInteger(player.speciesId)||player.speciesId<1||player.speciesId>151
     ||!Number.isSafeInteger(player.affinity)||player.affinity<0||player.affinity>100
     ||!Number.isSafeInteger(enemy.speciesId)||enemy.speciesId<1||enemy.speciesId>151
     ||!Number.isSafeInteger(enemy.level)||enemy.level<2||enemy.level>10
     ||typeof player.moveName!=='string'
     ||!manualValid(trainer.manual,(trainer.level-1)*2)
     ||!manualValid(player.manual,(player.level-1)*2))return null;
  const own=KANTO_BATTLE_SPECIES[player.speciesId];
  const other=KANTO_BATTLE_SPECIES[enemy.speciesId];
  if(!own||!other)return null;
  const unlocked=[...kantoLevelMoves(player.speciesId,player.level),
    ...kantoSupportMoves(player.speciesId,player.level)].map(entry=>entry.move);
  const unlockedAttacks=unlocked.filter(move=>move.category!=='status');
  const legalMoves=unlocked.length?unlocked:[own.move];
  const chosen=legalMoves.find(move=>move.name===player.moveName);
  // Fallback only when no offensive move was unlocked. Never accept arbitrary
  // moves, TM, higher-level learnsets or stats from client JSON.
  const selected=chosen??(unlockedAttacks.length===0&&
    player.moveName===own.move.name?own.move:null);
  if(!selected)return null;
  const trainerStats=trainerTotals({
    manual:trainer.manual,equipment:[],activeTitle:null,badges:[]
  });
  const playerCombatant:Combatant={
    speciesId:own.id,name:own.name,types:own.types,level:player.level,
    stats:pokemonFinalStats(own.base,player.level,player.manual,
      trainerStats,player.affinity),
    move:selected,moves:[selected],rank:0
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
  const result=simulateKantoBattle(pair.player,pair.wild,serverSeed);
  return {
    outcome:result.outcome,turns:result.turns,
    playerRemainingHp:result.playerRemainingHp,
    wildRemainingHp:result.wildRemainingHp,
    playerRemainingSp:result.playerRemainingSp,
    wildRemainingSp:result.wildRemainingSp,
    log:result.log,frames:result.frames
  };
}
