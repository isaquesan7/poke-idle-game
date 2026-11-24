/** Production-only Node API entry: exports only approved canonical pure functions. */
export {previewFrozenWildBattle,canonicalFrozenCombatants,
  frozenValidatedEquippedMoves}
  from './serverFrozenBattle.js';
export {quoteFrozenBattleRewards} from './serverBattleRewards.js';

export {applyFrozenBattleRewardQuote} from './serverBattlePayout.js';

export {finalizeFrozenWildEncounter} from '../capture/serverEncounterFinalization.js';

export {createFrozenWildTurnSession,initialFrozenWildTurnActions}
  from './serverWildTurnSession.js';

export {legalFrozenWildTurnActions,resolveFrozenWildTurn}
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
export {serverRegionalAccess,serverRegionalOpponent,serverRegionalCatalog,serverRegionalRoll}
  from './serverRegionalPolicy.js';
