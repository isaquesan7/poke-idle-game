-- ONLINE-01C-12: retain a non-rewarding canonical combat preview.
-- No endpoint, capture, XP, coins, affinity, ball consumption or resolution.
ALTER TABLE game_encounter_reservations
  ADD COLUMN battle_preview jsonb,
  ADD COLUMN battle_preview_at timestamptz;
ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_encounter_preview_coherent CHECK (
    (battle_preview IS NULL AND battle_preview_at IS NULL)
    OR
    (battle_preview IS NOT NULL
      AND jsonb_typeof(battle_preview)='object'
      AND battle_preview_at IS NOT NULL
      AND battle_snapshot IS NOT NULL
      AND species_id IS NOT NULL
      AND pokemon_level IS NOT NULL)
  );
