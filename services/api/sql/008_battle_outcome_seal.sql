-- ONLINE-01C-13: seal exactly one canonical battle outcome, with no grants.
-- Keep status='reserved' until an atomic payout/capture/close protocol exists:
-- a sealed preview MUST NOT allow free rerolls/new encounters.
ALTER TABLE game_encounter_reservations
  ADD COLUMN battle_sealed_outcome varchar(4),
  ADD COLUMN battle_sealed_at timestamptz,
  ADD COLUMN battle_seal_action_id varchar(100),
  ADD COLUMN battle_seal_revision bigint;
ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_encounter_battle_seal_coherent CHECK (
    (battle_sealed_outcome IS NULL AND battle_sealed_at IS NULL
     AND battle_seal_action_id IS NULL AND battle_seal_revision IS NULL)
    OR
    (battle_sealed_outcome IS NOT NULL
     AND battle_sealed_outcome IN ('win','loss','draw')
     AND battle_sealed_at IS NOT NULL
     AND battle_seal_action_id IS NOT NULL
     AND length(battle_seal_action_id) BETWEEN 12 AND 100
     AND battle_seal_revision IS NOT NULL AND battle_seal_revision>=1
     AND battle_preview IS NOT NULL
     AND coalesce(battle_preview->>'outcome','')=battle_sealed_outcome
     AND status='reserved')
  );
CREATE UNIQUE INDEX game_encounter_battle_seal_action_unique
  ON game_encounter_reservations(account_id,battle_seal_action_id)
  WHERE battle_seal_action_id IS NOT NULL;
