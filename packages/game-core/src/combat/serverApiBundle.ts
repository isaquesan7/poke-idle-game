/** Production-only Node API entry: exports only approved canonical pure functions. */
export {previewFrozenWildBattle,canonicalFrozenCombatants}
  from './serverFrozenBattle.js';
export {quoteFrozenBattleRewards} from './serverBattleRewards.js';

export {applyFrozenBattleRewardQuote} from './serverBattlePayout.js';
