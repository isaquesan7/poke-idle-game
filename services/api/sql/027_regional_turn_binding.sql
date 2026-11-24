-- CANDIDATE ONLY: not registered by migrate.mjs. Preserve prior checks and bind
-- persisted turn/snapshot region to the reserved row (1..10).
ALTER TABLE game_encounter_reservations
  DROP CONSTRAINT game_encounter_turn_mode_exclusive;
ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_encounter_turn_mode_exclusive CHECK (
    (battle_turn_state IS NULL AND battle_turn_started_at IS NULL)
    OR
    (battle_turn_state IS NOT NULL
      AND jsonb_typeof(battle_turn_state)='object'
      AND battle_turn_started_at IS NOT NULL
      AND status IN ('reserved','completed')
      AND (status='reserved' OR battle_turn_final_action_id IS NOT NULL)
      AND battle_snapshot IS NOT NULL
      AND battle_preview IS NULL AND battle_sealed_outcome IS NULL
      AND battle_reward_quote IS NULL AND battle_payout_action_id IS NULL
      AND final_action_id IS NULL
      AND coalesce(battle_turn_state->>'mode','')='turns'
      AND coalesce(battle_turn_state->>'version','')='1'
      AND coalesce(battle_turn_state->>'regionId','')=region_id::text
      AND coalesce(battle_snapshot->>'regionId','')=region_id::text
      AND coalesce(battle_turn_state->>'phase','')
        IN ('await-player','resolved')
      AND coalesce(jsonb_typeof(battle_turn_state->'player'),'')='object'
      AND coalesce(jsonb_typeof(battle_turn_state->'wild'),'')='object')
  );

