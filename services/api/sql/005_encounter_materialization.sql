-- ONLINE-01C-9: freeze the species and level once per server-issued encounter.
-- Existing reserved encounters are allowed to be unmaterialized until the
-- private server worker processes them; no client-facing route is added.
ALTER TABLE game_encounter_reservations
  ADD COLUMN species_id smallint,
  ADD COLUMN pokemon_level smallint,
  ADD COLUMN entropy_version varchar(64),
  ADD COLUMN materialized_at timestamptz;
ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_encounter_materialization_consistent CHECK (
    (species_id IS NULL AND pokemon_level IS NULL AND entropy_version IS NULL
      AND materialized_at IS NULL)
    OR
    (species_id IS NOT NULL AND species_id BETWEEN 1 AND 151
      AND pokemon_level IS NOT NULL AND pokemon_level BETWEEN 1 AND 100
      AND entropy_version IS NOT NULL AND materialized_at IS NOT NULL)
  );
