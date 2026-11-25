/** ONLINE-01C-14 — reward QUOTE ONLY, not a wallet or XP writer.
 * Mirrors the current /play battle-result reward policy from rewardEvents.ts.
 * A future settlement writer must check actual roster/level, caps, receipts,
 * captured state and all other concurrent server actions before crediting.
 */
import {battleProgressFactor,scaledRegionalReward} from '../rewards/regionProgression.js';
import {battleTrainerXp,beginnerBattleXp} from '../progression/xp.js';
import {AFFINITY_LOSS_ON_DEFEAT,AFFINITY_LOSS_ON_DRAW}
  from '../affinity/affinityDynamics.js';
import {canonicalFrozenCombatants} from './serverFrozenBattle.js';
import {d064BattleBallDropFromRoll} from '../capture/draftBallSupply.js';

export function quoteFrozenBattleRewards(snapshot:unknown,preview:unknown,
  affinityRoll:number,ballRoll=9999){
  const pair=canonicalFrozenCombatants(snapshot);
  if(!pair||!preview||typeof preview!=='object'||Array.isArray(preview)
    ||!Number.isSafeInteger(affinityRoll)||affinityRoll<0||affinityRoll>3
    ||!Number.isSafeInteger(ballRoll)||ballRoll<0||ballRoll>=10000)
    return null;
  const v=preview as Record<string,unknown>;
  if(!['win','loss','draw'].includes(v.outcome as string)||
     !Number.isSafeInteger(v.turns)||Number(v.turns)<1||Number(v.turns)>30||
     !Number.isSafeInteger(v.playerRemainingHp)||
     !Number.isSafeInteger(v.wildRemainingHp)||
     !Array.isArray(v.log)||!Array.isArray(v.frames)||
     v.log.length!==v.frames.length)return null;
  const s=snapshot as {activePokemon:{uid:number;affinity:number};regionId:number};
  const {player,wild}=pair;
  const outcome=v.outcome as 'win'|'loss'|'draw';
  const factor=battleProgressFactor(player.level,wild.level);
  const win=outcome==='win';
  const affinityBase=win?2+affinityRoll:0;
  const drop=d064BattleBallDropFromRoll(s.regionId,ballRoll);
  if(!drop)return null;
  // Item drop rates depend on the region, not the player's level.
  const ballDropId=win?
    (drop['poke-ball']?'poke-ball':drop['great-ball']?'great-ball':
      drop['ultra-ball']?'ultra-ball':null):null;
  const affinityDelta=win?
    Math.min(100-s.activePokemon.affinity,scaledRegionalReward(affinityBase,factor)):
    Math.max(0,s.activePokemon.affinity-
      (outcome==='draw'?AFFINITY_LOSS_ON_DRAW:AFFINITY_LOSS_ON_DEFEAT))
      -s.activePokemon.affinity;
  return Object.freeze({
    version:1,regionId:s.regionId,activeUid:s.activePokemon.uid,
    wildSpeciesId:wild.speciesId,wildLevel:wild.level,activeLevel:player.level,
    outcome,progressFactorTenths:Math.round(factor*10),
    coins:win?scaledRegionalReward(25+wild.level*3,factor):0,
    trainerXp:win?scaledRegionalReward(battleTrainerXp(wild.level),factor):0,
    pokemonXp:win?scaledRegionalReward(20+wild.level*6,factor):
      beginnerBattleXp(player.level,outcome),
    affinityDelta,ballDropId,
    // Legacy rewardEvents.ts increments losses on either loss or draw,
    // tracks draws separately, and gates battle records by progress factor.
    wins:win&&factor>0?1:0,
    losses:!win&&factor>0?1:0,
    draws:outcome==='draw'&&factor>0?1:0,
    battleRecordIncrement:factor>0?outcome:null
  });
}
