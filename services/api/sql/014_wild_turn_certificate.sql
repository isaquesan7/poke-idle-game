-- ONLINE-01C-20: auditable certification of a COMPLETED interactive wild battle.
-- Distinct from 008 auto-preview seal: it cannot trigger existing payout or capture.
ALTER TABLE game_encounter_reservations
  ADD COLUMN battle_turn_certificate_action_id varchar(100),
  ADD COLUMN battle_turn_certificate_outcome varchar(4),
  ADD COLUMN battle_turn_certificate_revision bigint,
  ADD COLUMN battle_turn_certificate_digest char(64),
  ADD COLUMN battle_turn_certificate_turns smallint,
  ADD COLUMN battle_turn_certified_at timestamptz;

ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_wild_turn_certificate_complete CHECK (
    (battle_turn_certificate_action_id IS NULL
      AND battle_turn_certificate_outcome IS NULL
      AND battle_turn_certificate_revision IS NULL
      AND battle_turn_certificate_digest IS NULL
      AND battle_turn_certificate_turns IS NULL
      AND battle_turn_certified_at IS NULL)
    OR
    (battle_turn_certificate_action_id IS NOT NULL
      AND length(battle_turn_certificate_action_id) BETWEEN 12 AND 100
      AND battle_turn_certificate_outcome IN ('win','loss','draw')
      AND battle_turn_certificate_revision IS NOT NULL
      AND battle_turn_certificate_revision >= 2
      AND battle_turn_certificate_digest ~ '^[0-9a-f]{64}$'
      AND battle_turn_certificate_turns BETWEEN 1 AND 30
      AND battle_turn_certified_at IS NOT NULL
      AND status='reserved'
      AND battle_turn_state IS NOT NULL
      AND battle_turn_state->>'phase'='resolved'
      AND battle_turn_state->>'outcome'=battle_turn_certificate_outcome
      AND (battle_turn_state->>'turn')::int=battle_turn_certificate_turns
      AND battle_preview IS NULL
      AND battle_sealed_outcome IS NULL
      AND battle_reward_quote IS NULL
      AND battle_payout_action_id IS NULL)
  );
CREATE UNIQUE INDEX game_wild_turn_certificate_action_unique
  ON game_encounter_reservations(account_id,battle_turn_certificate_action_id)
  WHERE battle_turn_certificate_action_id IS NOT NULL;
