-- ONLINE-01C-8: durable, server-issued encounter reservations.
-- No Pokémon encounter, RNG draw, loot, capture or combat is materialized here.
CREATE TABLE game_encounter_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  action_id varchar(128) NOT NULL,
  region_id smallint NOT NULL CHECK(region_id BETWEEN 1 AND 10),
  status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','completed','cancelled')),
  opened_revision bigint NOT NULL CHECK(opened_revision>=1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id,action_id)
);
-- No extra reservation/reroll while an encounter is unresolved.
CREATE UNIQUE INDEX game_encounter_one_reserved_per_account
ON game_encounter_reservations(account_id) WHERE status='reserved';
CREATE INDEX game_encounter_history_idx
ON game_encounter_reservations(account_id,created_at DESC);
