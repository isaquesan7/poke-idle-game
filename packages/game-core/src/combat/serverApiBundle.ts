/** Production-only Node API entry: exports only approved canonical pure functions. */
export {previewFrozenWildBattle,canonicalFrozenCombatants,
  frozenValidatedEquippedMoves}
  from './serverFrozenBattle.js';
export {quoteFrozenBattleRewards} from './serverBattleRewards.js';

export {applyFrozenBattleRewardQuote} from './serverBattlePayout.js';

export {finalizeFrozenWildEncounter} from '../capture/serverEncounterFinalization.js';

export {createFrozenWildTurnSession,initialFrozenWildTurnActions}
  from './serverWildTurnSession.js';

export {legalFrozenWildTurnActions,resolveFrozenWildTurn,chooseFrozenWildPlayerAction}
  from './serverWildTurnResolver.js';

// ONLINE-01C-23B2B: pure, read-only Gym bonuses and 3v3 opening preview.
export {canonicalOnlineGymTrainerBonuses,canonicalOnlineGymEquippedMoves,
  canonicalOnlineGymPreparation,canonicalOnlineGymOpeningState}
  from './serverGymPreparation.js';

// ONLINE-01C-23B2D: identical legal actions used by local Gym core.
export {gymLegalTurnActions} from '../gyms/gymTurn.js';

// ONLINE-01C-23B2E: shared canonical 3v3 resolver and fair Gym AI.
export {resolveGymTurn} from '../gyms/gymTurn.js';
export {gymChooseAiAction} from '../gyms/gymAiTurn.js';

// ONLINE-01C-23B2H: immutable reward transition from local Gym catalog.
export {applyCertifiedGymSettlement} from './serverGymSettlement.js';

// Canonical regional catalog/eligibility and unbiased HMAC-driven selection.
export {serverRegionalAccess,serverRegionalOpponent,serverRegionalCatalog,serverRegionalRoll,serverRegionalCaptureChoices}
  from './serverRegionalPolicy.js';

export {applyOnlineExpedition,onlineExpeditionProjection} from './serverExpedition.js';

export {onlineShopProjection,applyOnlineShopPurchase,applyOnlineGearPurchase} from './serverShop.js';

export {onlineMoveProjection} from './serverMoveProjection.js';

export {applyOnlineEvolution,onlineEvolutionProjection} from './serverEvolution.js';

export {applyOnlinePokemonTraining,onlinePokemonTrainingProjection} from './serverPokemonTraining.js';

export {applyOnlineMoveRank,validatedOnlineMoveRanks} from './serverMoveRanks.js';

export {onlinePokedexProjection,onlinePokedexDetail} from '../catalog/serverPokedex.js';

export {onlineInventoryProjection,applyOnlineTrainerLoadout} from '../inventory/serverInventory.js';

export {inspectOnlineInventory,createOnlineDropGear} from '../inventory/onlineOwnership.js';
export {rollRegionalLoot} from '../inventory/regionalLoot.js';

export {placeCertifiedRegionalLoot,inspectPendingRegionalLoot,resolvePendingRegionalLoot,discardOnlineGear} from '../inventory/serverRegionalLoot.js';

export {inspectPendingExpeditionLoot,resolvePendingExpeditionLoot} from '../inventory/serverExpeditionLoot.js';

export {onlineMasteryProjection,applyOnlineResearch} from '../progression/serverMastery.js';

export {onlineMachineProjection,applyOnlineMachineTeaching} from './serverMachineLessons.js';

export {rollRegionalMachine} from '../inventory/machineLoot.js';
