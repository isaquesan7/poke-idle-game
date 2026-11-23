-- ONLINE-01C-23B2C: exclusively server-owned Gym reservation.
-- No client seed, result, rewards, badges or team selection is accepted.
CREATE TABLE game_gym_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  action_id varchar(100) NOT NULL,
  gym_id text NOT NULL CHECK (gym_id <> ''),
  team_uids jsonb NOT NULL CHECK (
    jsonb_typeof(team_uids)='array' AND jsonb_array_length(team_uids)=3
  ),
  frozen_preparation jsonb NOT NULL,
  frozen_battle jsonb NOT NULL,
  opened_revision bigint NOT NULL CHECK (opened_revision>=1),
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id,action_id),
  UNIQUE(account_id,opened_revision)
);
CREATE UNIQUE INDEX game_gym_one_active_per_account
  ON game_gym_reservations(account_id) WHERE status='reserved';
CREATE INDEX game_gym_reservations_recent_idx
  ON game_gym_reservations(account_id,created_at DESC);
