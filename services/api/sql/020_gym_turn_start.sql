-- ONLINE-01C-23B2D: start a Gym at canonical turn zero only.
-- HMAC actions, turn receipts and payouts are separate follow-up migrations.
ALTER TABLE game_gym_reservations
  ADD COLUMN turn_state jsonb,
  ADD COLUMN turn_started_at timestamptz,
  ADD CONSTRAINT game_gym_turn_started_pair CHECK (
    (turn_state IS NULL AND turn_started_at IS NULL)
    OR (turn_state IS NOT NULL AND turn_started_at IS NOT NULL)
  ),
  ADD CONSTRAINT game_gym_turn_state_object CHECK (
    turn_state IS NULL OR jsonb_typeof(turn_state)='object'
  );
