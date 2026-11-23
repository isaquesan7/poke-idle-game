-- ONLINE-01C-18: server-owned interactive turn-zero battle state.
-- Existing auto-resolved preview and interactive turns are mutually exclusive;
-- do NOT seal a result or pay rewards from this merely initialized state.
ALTER TABLE game_encounter_reservations
  ADD COLUMN battle_turn_state jsonb,
  ADD COLUMN battle_turn_started_at timestamptz;

ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_encounter_turn_mode_exclusive CHECK (
    (battle_turn_state IS NULL AND battle_turn_started_at IS NULL)
    OR
    (battle_turn_state IS NOT NULL
      AND jsonb_typeof(battle_turn_state)='object'
      AND battle_turn_started_at IS NOT NULL
      AND status='reserved'
      AND battle_snapshot IS NOT NULL
      AND battle_preview IS NULL AND battle_sealed_outcome IS NULL
      AND battle_reward_quote IS NULL AND battle_payout_action_id IS NULL
      AND final_action_id IS NULL
      AND coalesce(battle_turn_state->>'mode','')='turns'
      AND coalesce(battle_turn_state->>'version','')='1'
      AND coalesce(battle_turn_state->>'regionId','')='1'
      AND coalesce(battle_turn_state->>'phase','')
        IN ('await-player','resolved')
      AND coalesce(jsonb_typeof(battle_turn_state->'player'),'')='object'
      AND coalesce(jsonb_typeof(battle_turn_state->'wild'),'')='object')
  );
