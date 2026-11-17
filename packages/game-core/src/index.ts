export { STATS, zeroStats } from './stats/types.js';
export type { Stat, StatBonus, StatValues } from './stats/types.js';
export { trainerTotals, canInvestTrainerPoint, MANUAL_TRAINER_CAP } from './stats/trainer.js';
export type { EquipmentSlot, EquippedBonus, BadgeBonus, TrainerSources } from './stats/trainer.js';
export { pokemonOwnStats, pokemonFinalStats } from './stats/pokemon.js';
export { clampAffinity, affinityRate, trainerContribution } from './affinity/affinity.js';
export { xpThreshold, grantXp } from './progression/xp.js';
export type { ProgressionKind, LevelProgress, XpResult } from './progression/xp.js';
export { expeditionRewards, EXPEDITION_CYCLE_MS, MAX_EXPEDITION_CYCLES } from './rewards/expedition.js';
export type { ExpeditionRewards } from './rewards/expedition.js';
export {
  LEGACY_ITEMS, LEGACY_BADGES, LEGACY_TITLES, LEGACY_STARTERS,
  effectiveLegacyTitle
} from './legacy/catalog.js';
export type { LegacyItem, LegacyBadge, LegacyTitle, LegacySpecies } from './legacy/catalog.js';

export { editLegacyTrainerJson, validLegacyTrainerDraft, LEGACY_EQUIPMENT_SLOTS } from './legacy/trainerDraft.js';
export type { TrainerDraftAction, TrainerDraftEditResult } from './legacy/trainerDraft.js';


export {
  legacyPokemonManualBudget, reduceLegacyPokemonTeamJson,
  LEGACY_POKEMON_POINTS_PER_LEVEL, LEGACY_TEAM_MAX_MEMBERS
} from './legacy/pokemonTeamReducer.js';
export type {
  LegacyPokemonTeamAction, LegacyPokemonTeamEditResult
} from './legacy/pokemonTeamReducer.js';


export { prepareRewardJournal, applyRewardEvent } from './legacy/rewardEvents.js';
export type {
  RewardCommand, RewardJournal, RewardEventReceipt, RewardEventResult
} from './legacy/rewardEvents.js';

export {
  legacyMoveRankLimits, reduceLegacyPokemonMoveJson
} from './legacy/pokemonMoveReducer.js';
export type {
  LegacyMoveAction, LegacyMoveEditResult
} from './legacy/pokemonMoveReducer.js';

export { RewardAuthorityMemoryLab } from './legacy/rewardAuthorityMemoryLab.js';
export type {
  AuthorityFault, AuthorityResult, RewardAuthorityLabClient
} from './legacy/rewardAuthorityMemoryLab.js';

export {
  KANTO_BATTLE_SPECIES, KANTO_WILD_POOL,
  KANTO_BATTLE_MOVES, kantoTypeMultiplier, kantoDamage, simulateKantoBattle
} from './combat/kantoBattle.js';
export type {
  Combatant, KantoMove, KantoSpecies, KantoBattleResult, BattleOutcome
} from './combat/kantoBattle.js';

export {
  KANTO_POKEDEX, KANTO_CATALOG_SOURCE_COMMIT, kantoSpecies, kantoDexStatus
} from './catalog/kantoSpecies.js';
export type { KantoCatalogSpecies, KantoDexStatus } from './catalog/kantoSpecies.js';
