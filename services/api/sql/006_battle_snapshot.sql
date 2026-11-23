-- ONLINE-01C-10: immutable-by-service battle preparation snapshot.
-- No turns, combat rewards, capture results or client-facing endpoint yet.
ALTER TABLE game_encounter_reservations
  ADD COLUMN battle_snapshot jsonb,
  ADD COLUMN battle_prepared_at timestamptz;
ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_encounter_battle_snapshot_complete CHECK (
    (battle_snapshot IS NULL AND battle_prepared_at IS NULL)
    OR
    (battle_snapshot IS NOT NULL AND jsonb_typeof(battle_snapshot)='object'
      AND battle_prepared_at IS NOT NULL AND species_id IS NOT NULL
      AND pokemon_level IS NOT NULL)
  );
