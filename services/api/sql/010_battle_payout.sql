-- ONLINE-01C-15: exactly-once XP/coin/affinity payout, still no capture.
-- A paid encounter REMAINS reserved until the later capture/close flow.
ALTER TABLE game_encounter_reservations
  ADD COLUMN battle_payout_action_id varchar(100),
  ADD COLUMN battle_payout_revision bigint,
  ADD COLUMN battle_paid_at timestamptz,
  ADD COLUMN battle_payout_receipt jsonb;
ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_encounter_payout_complete CHECK (
    (battle_payout_action_id IS NULL AND battle_payout_revision IS NULL
      AND battle_paid_at IS NULL AND battle_payout_receipt IS NULL)
    OR
    (battle_payout_action_id IS NOT NULL
      AND length(battle_payout_action_id) BETWEEN 12 AND 100
      AND battle_payout_revision IS NOT NULL AND battle_payout_revision>=1
      AND battle_paid_at IS NOT NULL
      AND battle_payout_receipt IS NOT NULL
      AND jsonb_typeof(battle_payout_receipt)='object'
      AND battle_reward_quote IS NOT NULL
      AND coalesce(battle_payout_receipt->>'outcome','')=battle_sealed_outcome
      AND status='reserved')
  );
CREATE UNIQUE INDEX game_encounter_payout_action_unique
  ON game_encounter_reservations(account_id,battle_payout_action_id)
  WHERE battle_payout_action_id IS NOT NULL;
