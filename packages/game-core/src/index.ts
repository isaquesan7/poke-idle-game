export { STATS, zeroStats } from './stats/types.js';
export type { Stat, StatBonus, StatValues } from './stats/types.js';
export { trainerTotals, canInvestTrainerPoint, MANUAL_TRAINER_CAP } from './stats/trainer.js';
export type { EquipmentSlot, EquippedBonus, BadgeBonus, TrainerSources } from './stats/trainer.js';
export { pokemonOwnStats, pokemonFinalStats } from './stats/pokemon.js';
export { clampAffinity, affinityRate, trainerContribution } from './affinity/affinity.js';
export { xpThreshold, grantXp, battleTrainerXp } from './progression/xp.js';
export type { ProgressionKind, LevelProgress, XpResult } from './progression/xp.js';
export { expeditionRewards, EXPEDITION_CYCLE_MS, MAX_EXPEDITION_CYCLES } from './rewards/expedition.js';
export type { ExpeditionRewards } from './rewards/expedition.js';
export {
  LEGACY_ITEMS, LEGACY_BADGES, LEGACY_TITLES, LEGACY_STARTERS, legacyTitleIsUnlocked,
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
  Combatant, KantoMove, KantoSpecies, KantoBattleResult, BattleOutcome,
  KantoBattleVisualFrame, KantoBattleVisualKind
} from './combat/kantoBattle.js';

export {
  KANTO_POKEDEX, KANTO_CATALOG_SOURCE_COMMIT, kantoSpecies, kantoDexStatus
} from './catalog/kantoSpecies.js';
export type { KantoCatalogSpecies, KantoDexStatus } from './catalog/kantoSpecies.js';
export {
  KANTO_LEVELUP_SOURCE_COMMIT, KANTO_LEVELUP_VERSION_GROUP,
  KANTO_LEVELUP_DAMAGE_MOVES, kantoLevelMoves
} from './catalog/kantoLevelMoves.js';
export type { KantoLearnableMove } from './catalog/kantoLevelMoves.js';
export {kantoWildMoveLoadout} from './catalog/kantoWildMoves.js';
export {
  KANTO_SUPPORT_SOURCE_COMMIT,KANTO_SUPPORT_MOVES,
  KANTO_SUPPORT_EFFECTS,kantoSupportEffect,kantoSupportMoves
} from './catalog/kantoSupportMoves.js';
export type {KantoSupportEffect,KantoSupportLearned} from './catalog/kantoSupportMoves.js';
export {pokemonMoveSlots,reducePokemonMoveSlotsJson} from './legacy/pokemonMoveSlotsReducer.js';
export type {MoveSlotAction,MoveSlotOperation,MoveSlotResult} from './legacy/pokemonMoveSlotsReducer.js';
export {
  KANTO_STATUS_SOURCE_COMMIT, KANTO_SECONDARY_EFFECTS, kantoMoveSecondaryEffect,
  KANTO_PER_HIT_SECONDARY_EFFECTS,kantoPerHitSecondaryEffect
} from './combat/kantoStatusEffects.js';
export type { KantoBattleStatus, KantoSecondaryEffect } from './combat/kantoStatusEffects.js';
export {KANTO_MULTI_HIT_MOVES,kantoMoveHitCount,kantoMoveExpectedHits,kantoRollHitCount}
  from './combat/kantoMultiHit.js';
export {
  KANTO_TM_SOURCE_COMMIT,KANTO_TM_SOURCE_BLOBS,KANTO_TM_VERSION_POLICY,
  KANTO_TM09_PREVIEW,kantoTmPreview,kantoTmIsTeachEnabled,
  kantoTmPreviewMeanHits,kantoTmPreviewHitCount
} from './catalog/kantoTmPreview.js';
export type {KantoTmPreviewHit} from './catalog/kantoTmPreview.js';
export {
  KANTO_BASIC_ATTACK,KANTO_CONCENTRATE,KANTO_SP_BALANCE,
  kantoMaxSp,kantoMovePp,kantoMoveSpCost,kantoFocusRecovery,
  kantoPreviewMoveSpCost
} from './combat/kantoSkillEnergy.js';
export type {KantoApiMoveSpPreview} from './combat/kantoSkillEnergy.js';
export {
  KANTO_PP_SOURCE_COMMIT,KANTO_PP_SOURCE_BLOB,KANTO_MOVE_PP
} from './catalog/kantoMovePp.js';
export {
  KANTO_EVOLUTION_SOURCE_COMMIT, KANTO_EVOLUTION_STONES,
  KANTO_EVOLUTION_RULES, kantoEvolutionOptions
} from './catalog/kantoEvolution.js';
export type { KantoEvolutionRule, KantoEvolutionStone } from './catalog/kantoEvolution.js';
export { reduceKantoEvolutionJson } from './legacy/pokemonEvolutionReducer.js';
export type {
  KantoEvolutionAction, KantoEvolutionEditResult
} from './legacy/pokemonEvolutionReducer.js';

// D-053: leitura de propriedade/slots ainda não conectada ao writer de recompensas.
export {BASE_BAG_SLOTS,inspectInventoryOwnership,inventorySlotsUsed,inventorySlotsAvailable,mayEquipOwnedItem} from './inventory/ownership.js';
export type {InventoryOwnershipV1,InventoryOwnershipRead} from './inventory/ownership.js';

// D-064AH — catálogo Kanto completo e contrato de captura regional.
export {KANTO_REGIONS,kantoRegion,kantoRegionalEncounter,kantoRegionCatalogInvariant}
  from './map/kantoRegions.js';
export {KANTO_BALLS,canUseKantoBall} from './capture/kantoBalls.js';
export {inspectKantoBallPocket,spendKantoBallForAttempt}
  from './capture/kantoBallPocket.js';
export {resolveKantoCaptureAttempt} from './capture/regionalCaptureAttempt.js';
export {d064DraftBallDrop,D064_DRAFT_STARTER_BALLS} from './capture/draftBallSupply.js';
export type {KantoBallId} from './capture/kantoBalls.js';
export type {KantoBallPocketV1} from './capture/kantoBallPocket.js';

// D064AO — catálogo FRLG completo para consulta, execução só de efeitos suportados.
export {
  KANTO_FRLG_LEVELUP_SOURCE_COMMIT,KANTO_FRLG_LEVELUP_ROWS,
  KANTO_FRLG_MOVE_META,KANTO_FRLG_EXECUTABLE_EFFECT_IDS,
  kantoFrlgLevelMoveCatalog
} from './catalog/kantoFrlgLevelupSnapshot.js';
export type {FrlgLevelMoveMeta} from './catalog/kantoFrlgLevelupSnapshot.js';
