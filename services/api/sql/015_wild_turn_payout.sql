-- ONLINE-01C-21: separate, once-only economic settlement for interactive turns.
-- Do not retrofit the auto-preview seal/payout schema. Turn sessions stay
-- reserved until a future audited capture/skip finalization migration.
ALTER TABLE game_encounter_reservations
  ADD COLUMN battle_turn_payout_action_id varchar(100),
  ADD COLUMN battle_turn_payout_revision bigint,
  ADD COLUMN battle_turn_payout_quote jsonb,
  ADD COLUMN battle_turn_payout_receipt jsonb,
  ADD COLUMN battle_turn_paid_at timestamptz;

ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_wild_turn_payout_complete CHECK (
    (battle_turn_payout_action_id IS NULL
      AND battle_turn_payout_revision IS NULL
      AND battle_turn_payout_quote IS NULL
      AND battle_turn_payout_receipt IS NULL
      AND battle_turn_paid_at IS NULL)
    OR
    (battle_turn_payout_action_id IS NOT NULL
      AND length(battle_turn_payout_action_id) BETWEEN 12 AND 100
      AND battle_turn_payout_revision IS NOT NULL
      AND battle_turn_payout_revision > battle_turn_certificate_revision
      AND battle_turn_payout_quote IS NOT NULL
      AND jsonb_typeof(battle_turn_payout_quote)='object'
      AND coalesce(battle_turn_payout_quote->>'outcome','')=
        battle_turn_certificate_outcome
      AND battle_turn_payout_receipt IS NOT NULL
      AND jsonb_typeof(battle_turn_payout_receipt)='object'
      AND coalesce(battle_turn_payout_receipt->>'outcome','')=
        battle_turn_certificate_outcome
      AND battle_turn_paid_at IS NOT NULL
      AND status='reserved'
      AND battle_turn_state IS NOT NULL
      AND battle_turn_state->>'phase'='resolved'
      AND battle_turn_certificate_action_id IS NOT NULL
      AND battle_preview IS NULL
      AND battle_sealed_outcome IS NULL
      AND battle_reward_quote IS NULL
      AND battle_payout_action_id IS NULL
      AND final_action_id IS NULL)
  );
CREATE UNIQUE INDEX game_wild_turn_payout_action_unique
  ON game_encounter_reservations(account_id,battle_turn_payout_action_id)
  WHERE battle_turn_payout_action_id IS NOT NULL;
