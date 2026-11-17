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
