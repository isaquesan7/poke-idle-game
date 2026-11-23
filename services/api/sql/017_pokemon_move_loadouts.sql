-- ONLINE-01C-23A: immutable, per-account action receipt for the selected
-- FRLG equipped loadout (never infer four slots from learned moves).
-- This table is append-only and separate from the generic action ledger.
CREATE TABLE game_pokemon_move_equip_receipts (
  account_id uuid NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  action_id varchar(100) NOT NULL,
  pokemon_uid bigint NOT NULL CHECK(pokemon_uid>=1),
  move_names jsonb NOT NULL CHECK(
    jsonb_typeof(move_names)='array'
    AND jsonb_array_length(move_names) BETWEEN 1 AND 4
  ),
  save_revision bigint NOT NULL CHECK(save_revision>=1),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id,action_id),
  UNIQUE(account_id,save_revision)
);
CREATE INDEX game_pokemon_move_equip_uid_idx
  ON game_pokemon_move_equip_receipts(account_id,pokemon_uid,save_revision DESC);
