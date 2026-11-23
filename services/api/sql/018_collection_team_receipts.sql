-- ONLINE-01C-23B2A: append-only receipt for Collection-selected teams.
-- Gym will freeze these UIDs BEFORE starting; wild regions use team[0] ONLY.
-- Never mix this ledger with game_pokemon_move_equip_receipts.
CREATE TABLE game_collection_team_receipts (
  account_id uuid NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  action_id varchar(100) NOT NULL,
  team_uids jsonb NOT NULL CHECK (
    jsonb_typeof(team_uids)='array'
    AND jsonb_array_length(team_uids) BETWEEN 1 AND 3
  ),
  save_revision bigint NOT NULL CHECK(save_revision>=1),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,action_id),
  UNIQUE(account_id,save_revision)
);
CREATE INDEX game_collection_team_receipts_recent_idx
  ON game_collection_team_receipts(account_id,save_revision DESC);
