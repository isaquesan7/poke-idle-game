export { STATS, zeroStats } from './stats/types.js';
export type { Stat, StatBonus, StatValues } from './stats/types.js';
export { trainerTotals, canInvestTrainerPoint, MANUAL_TRAINER_CAP } from './stats/trainer.js';
export type { EquipmentSlot, EquippedBonus, BadgeBonus, TrainerSources } from './stats/trainer.js';
export { pokemonOwnStats, pokemonFinalStats } from './stats/pokemon.js';
export { clampAffinity, affinityRate, trainerContribution } from './affinity/affinity.js';
export { affinityIdlePenaltyDays, affinityAfterInactivity, AFFINITY_IDLE_DAY_MS, AFFINITY_IDLE_GRACE_DAYS, AFFINITY_LOSS_ON_DEFEAT, AFFINITY_LOSS_ON_DRAW } from './affinity/affinityDynamics.js';
export { xpThreshold, grantXp, battleTrainerXp, beginnerBattleXp } from './progression/xp.js';
export type { ProgressionKind, LevelProgress, XpResult } from './progression/xp.js';
export { expeditionRewards, EXPEDITION_CYCLE_MS, MAX_EXPEDITION_CYCLES, EXPEDITION_BALL_PERIODS, emptyExpeditionBallProgress } from './rewards/expedition.js';
export {battleProgressFactor,expeditionProgressFactor,expeditionRegionRates,scaledRegionalReward} from './rewards/regionProgression.js';
export type { ExpeditionRewards,ExpeditionContext,ExpeditionBallProgress,ExpeditionBallKind } from './rewards/expedition.js';
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
  KANTO_EVOLUTION_RULES, kantoEvolutionOptions,kantoCaptureStartingLevel
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
export {d064DraftBallDrop,d064BattleBallRoll,d064BattleBallDropRates,
  d064DraftBallSupply,D064_DRAFT_STARTER_BALLS,KANTO_REGION_WINS_CAP}
  from './capture/draftBallSupply.js';
export type {KantoBattleBallDropRates,D064DraftBallDrop} from './capture/draftBallSupply.js';
export type {KantoBallId} from './capture/kantoBalls.js';
export type {KantoBallPocketV1} from './capture/kantoBallPocket.js';

// D064AO — catálogo FRLG completo para consulta, execução só de efeitos suportados.
export {
  KANTO_FRLG_LEVELUP_SOURCE_COMMIT,KANTO_FRLG_LEVELUP_ROWS,
  KANTO_FRLG_MOVE_META,KANTO_FRLG_EXECUTABLE_EFFECT_IDS,
  kantoFrlgLevelMoveCatalog
} from './catalog/kantoFrlgLevelupSnapshot.js';
export type {FrlgLevelMoveMeta} from './catalog/kantoFrlgLevelupSnapshot.js';

export {KANTO_BALL_SHOP_CATALOG,KANTO_BALL_SHOP_STATUS,
  KANTO_BALL_SHOP_PRICE_POLICY,KANTO_SHOP_BALL_POCKET_CAP,quoteKantoBallShopPurchase}
  from './shop/ballShop.js';
export type {KantoShopBallId,KantoShopPricePolicy,KantoShopPurchaseResult,
  KantoShopPurchaseInput,KantoBallShopItem} from './shop/ballShop.js';

// GYM-01: catálogo e acesso sequencial apenas; sem writer/combate de ginásio.
export {KANTO_GYMS,KANTO_GYM_MASTER_TITLE_STATS,kantoNextGym,kantoGymCatalogInvariant}
  from './gyms/kantoGyms.js';
export type {KantoGymId,KantoGymPokemon,KantoGymDefinition} from './gyms/kantoGyms.js';

// GYM-02A: seleção/treino/IA tática apenas, sem resolução de combate ou rewards.
export {selectGymTeam,gymTrainerPoints,gymLegalMoves,prepareGymOpponent,gymAiDecision}
  from './gyms/gymTactics.js';
export type {GymTeamSlot,GymAiDecision,GymPreparedOpponent} from './gyms/gymTactics.js';

// GYM-02B: estado local de equipes, dano, gasto de SP e trocas limitadas.
export {GYM_SWITCH_RULES,createGymBattleState,applyGymDamage,spendGymSp,
  switchGymPokemon,gymTeamIsDefeated} from './gyms/gymBattleState.js';
export type {GymSide,GymFighterState,GymSideState,GymBattleState,GymStateResult}
  from './gyms/gymBattleState.js';

// GYM-02C1: rodada determinística com ataques diretos e trocas; sem suporte/rewards.
export {resolveGymTurn} from './gyms/gymTurn.js';
export type {GymTurnAction,GymTurnResult} from './gyms/gymTurn.js';

// GYM-02C2: cura ativa e Concentrar com orçamento individual no 3x3.
export {healGymHp,focusGymSp} from './gyms/gymBattleState.js';

// GYM-02C2b: status e estágios pertencem ao Pokémon, nunca ao slot ativo.
export {gymStatusAllowed,gymApplyStatus,gymDropStat,gymDamageStat,
  GYM_EMPTY_EFFECTS} from './gyms/gymEffects.js';
export type {GymEffects,GymStage} from './gyms/gymEffects.js';

// GYM-02C2b2: dados psíquicos FRLG e confusão individual (somente Ginásios).
export {gymPsychicSecondary,gymPsychicLevelMoves} from './gyms/gymPsychicMoves.js';
export type {GymPsychicMove,GymPsychicSecondary} from './gyms/gymPsychicMoves.js';
export {gymApplyConfusion,gymTickConfusion,gymConfusionSelfDamage} from './gyms/gymEffects.js';

// GYM-02C2c: sono individual e KO residual atômico, inclusive empate 3×3.
export {gymApplySleep,gymTickSleep} from './gyms/gymEffects.js';
export {applyGymResidual} from './gyms/gymBattleState.js';

// GYM-02D: escolha tática validada pelas mesmas ações legais do jogador.
export {gymLegalTurnActions,GYM_MAX_TURNS} from './gyms/gymTurn.js';
export {gymChooseAiAction,resolveGymAiTurn} from './gyms/gymAiTurn.js';
