-- ONLINE-01C-23B2E: audited private Gym actions; NO badge or reward writer.
-- Historical proof ties all committed turns to one server-held HMAC key.
ALTER TABLE game_gym_reservations
  ADD COLUMN turn_entropy_proof char(64),
  ADD CONSTRAINT game_gym_entropy_requires_session CHECK (
    turn_entropy_proof IS NULL OR turn_state IS NOT NULL
  );
CREATE TABLE game_gym_turn_receipts (
  account_id uuid NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  gym_reservation_id uuid NOT NULL REFERENCES game_gym_reservations(id) ON DELETE CASCADE,
  action_id varchar(100) NOT NULL CHECK(length(action_id) BETWEEN 12 AND 100),
  action_number smallint NOT NULL CHECK (action_number BETWEEN 1 AND 140),
  player_action jsonb NOT NULL CHECK(jsonb_typeof(player_action)='object'),
  leader_action jsonb NOT NULL CHECK(jsonb_typeof(leader_action)='object'),
  turn_result jsonb NOT NULL CHECK(jsonb_typeof(turn_result)='object'
    AND turn_result->>'seed' IS NULL
    AND turn_result->>'seedAfter' IS NULL
    AND turn_result->>'rewards' IS NULL),
  save_revision bigint NOT NULL CHECK(save_revision>=2),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,action_id),
  UNIQUE(gym_reservation_id,action_number),
  UNIQUE(account_id,save_revision)
);
CREATE INDEX game_gym_turn_receipts_history_idx
  ON game_gym_turn_receipts(gym_reservation_id,action_number);
