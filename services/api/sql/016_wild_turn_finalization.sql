-- ONLINE-01C-22: separate capture/skip completion for an already paid
-- interactive wild battle. Historical migrations remain checksum-immutable.
ALTER TABLE game_encounter_reservations
  ADD COLUMN battle_turn_final_action_id varchar(100),
  ADD COLUMN battle_turn_final_choice varchar(10),
  ADD COLUMN battle_turn_final_revision bigint,
  ADD COLUMN battle_turn_final_result jsonb,
  ADD COLUMN battle_turn_finalized_at timestamptz;

-- The legacy final columns remain exclusive to auto-preview encounters.
-- Exactly one completion family is permitted on a completed encounter.
ALTER TABLE game_encounter_reservations
  DROP CONSTRAINT game_encounter_finalization_complete;
ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_encounter_finalization_complete CHECK (
    (status IN ('reserved','cancelled')
      AND final_action_id IS NULL AND final_choice IS NULL
      AND final_revision IS NULL AND final_result IS NULL
      AND finalized_at IS NULL
      AND battle_turn_final_action_id IS NULL)
    OR
    (status='completed' AND
      (
        (battle_turn_final_action_id IS NULL
          AND battle_turn_state IS NULL
          AND battle_payout_action_id IS NOT NULL
          AND battle_sealed_outcome IS NOT NULL
          AND final_action_id IS NOT NULL
          AND length(final_action_id) BETWEEN 12 AND 100
          AND final_choice IN ('skip','poke-ball','great-ball','ultra-ball')
          AND final_revision IS NOT NULL AND final_revision>=1
          AND final_result IS NOT NULL
          AND jsonb_typeof(final_result)='object'
          AND finalized_at IS NOT NULL
          AND coalesce(final_result->>'outcome','') IN ('skipped','failed','captured')
          AND ((final_choice='skip' AND final_result->>'outcome'='skipped'
            AND final_result->>'ballId' IS NULL)
            OR (final_choice<>'skip'
              AND final_result->>'outcome' IN ('failed','captured')
              AND final_result->>'ballId'=final_choice)))
        OR
        (battle_turn_final_action_id IS NOT NULL
          AND battle_turn_payout_action_id IS NOT NULL
          AND battle_turn_state IS NOT NULL
          AND final_action_id IS NULL AND final_choice IS NULL
          AND final_revision IS NULL AND final_result IS NULL
          AND finalized_at IS NULL)
      ))
  );

-- Previous session/certificate/settlement checks assumed a perpetual
-- reservation; keep the SAME integrity predicates when it is completed,
-- and require a matching turn-final action for the completed transition.
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
      AND coalesce(battle_turn_state->>'regionId','')='1'
      AND coalesce(battle_turn_state->>'phase','')
        IN ('await-player','resolved')
      AND coalesce(jsonb_typeof(battle_turn_state->'player'),'')='object'
      AND coalesce(jsonb_typeof(battle_turn_state->'wild'),'')='object')
  );

ALTER TABLE game_encounter_reservations
  DROP CONSTRAINT game_wild_turn_certificate_complete;
ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_wild_turn_certificate_complete CHECK (
    (battle_turn_certificate_action_id IS NULL
      AND battle_turn_certificate_outcome IS NULL
      AND battle_turn_certificate_revision IS NULL
      AND battle_turn_certificate_digest IS NULL
      AND battle_turn_certificate_turns IS NULL
      AND battle_turn_certified_at IS NULL)
    OR
    (battle_turn_certificate_action_id IS NOT NULL
      AND length(battle_turn_certificate_action_id) BETWEEN 12 AND 100
      AND battle_turn_certificate_outcome IN ('win','loss','draw')
      AND battle_turn_certificate_revision IS NOT NULL
      AND battle_turn_certificate_revision >= 2
      AND battle_turn_certificate_digest ~ '^[0-9a-f]{64}$'
      AND battle_turn_certificate_turns BETWEEN 1 AND 30
      AND battle_turn_certified_at IS NOT NULL
      AND status IN ('reserved','completed')
      AND (status='reserved' OR battle_turn_final_action_id IS NOT NULL)
      AND battle_turn_state IS NOT NULL
      AND battle_turn_state->>'phase'='resolved'
      AND battle_turn_state->>'outcome'=battle_turn_certificate_outcome
      AND (battle_turn_state->>'turn')::int=battle_turn_certificate_turns
      AND battle_preview IS NULL AND battle_sealed_outcome IS NULL
      AND battle_reward_quote IS NULL AND battle_payout_action_id IS NULL)
  );

ALTER TABLE game_encounter_reservations
  DROP CONSTRAINT game_wild_turn_payout_complete;
ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_wild_turn_payout_complete CHECK (
    (battle_turn_payout_action_id IS NULL
      AND battle_turn_payout_revision IS NULL
      AND battle_turn_payout_quote IS NULL
      AND battle_turn_payout_receipt IS NULL
      AND battle_turn_paid_at IS NULL)
    OR
    (battle_turn_payout_action_id IS NOT NULL
      AND length(battle_turn_payout_action_id) BETWEEN 12 AND 100
      AND battle_turn_payout_revision IS NOT NULL
      AND battle_turn_payout_revision > battle_turn_certificate_revision
      AND battle_turn_payout_quote IS NOT NULL
      AND jsonb_typeof(battle_turn_payout_quote)='object'
      AND coalesce(battle_turn_payout_quote->>'outcome','')=
        battle_turn_certificate_outcome
      AND battle_turn_payout_receipt IS NOT NULL
      AND jsonb_typeof(battle_turn_payout_receipt)='object'
      AND coalesce(battle_turn_payout_receipt->>'outcome','')=
        battle_turn_certificate_outcome
      AND battle_turn_paid_at IS NOT NULL
      AND status IN ('reserved','completed')
      AND (status='reserved' OR battle_turn_final_action_id IS NOT NULL)
      AND battle_turn_state IS NOT NULL
      AND battle_turn_state->>'phase'='resolved'
      AND battle_turn_certificate_action_id IS NOT NULL
      AND battle_turn_entropy_proof IS NOT NULL
      AND battle_preview IS NULL AND battle_sealed_outcome IS NULL
      AND battle_reward_quote IS NULL AND battle_payout_action_id IS NULL
      AND final_action_id IS NULL)
  );

ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_wild_turn_final_complete CHECK (
    (battle_turn_final_action_id IS NULL
      AND battle_turn_final_choice IS NULL
      AND battle_turn_final_revision IS NULL
      AND battle_turn_final_result IS NULL
      AND battle_turn_finalized_at IS NULL)
    OR
    (battle_turn_final_action_id IS NOT NULL
      AND length(battle_turn_final_action_id) BETWEEN 12 AND 100
      AND battle_turn_final_choice IN ('skip','poke-ball','great-ball','ultra-ball')
      AND battle_turn_final_revision IS NOT NULL
      AND battle_turn_final_revision > battle_turn_payout_revision
      AND battle_turn_final_result IS NOT NULL
      AND jsonb_typeof(battle_turn_final_result)='object'
      AND battle_turn_finalized_at IS NOT NULL
      AND status='completed'
      AND battle_turn_payout_action_id IS NOT NULL
      AND battle_turn_certificate_action_id IS NOT NULL
      AND battle_turn_state->>'phase'='resolved'
      AND battle_turn_entropy_proof IS NOT NULL
      AND final_action_id IS NULL AND battle_preview IS NULL
      AND battle_sealed_outcome IS NULL AND battle_payout_action_id IS NULL
      AND coalesce(battle_turn_final_result->>'speciesId','')=species_id::text
      AND (
        (battle_turn_final_choice='skip'
          AND battle_turn_final_result->>'outcome'='skipped'
          AND battle_turn_final_result->>'ballId' IS NULL
          AND battle_turn_final_result->>'caughtUid' IS NULL)
        OR
        (battle_turn_final_choice<>'skip'
          AND battle_turn_certificate_outcome='win'
          AND battle_turn_state->'wild'->>'hp'='0'
          AND battle_turn_final_result->>'outcome' IN ('failed','captured')
          AND battle_turn_final_result->>'ballId'=battle_turn_final_choice
          AND (
            (battle_turn_final_result->>'outcome'='failed'
              AND battle_turn_final_result->>'caughtUid' IS NULL)
            OR
            (battle_turn_final_result->>'outcome'='captured'
              AND jsonb_typeof(battle_turn_final_result->'caughtUid')='number'
              AND (battle_turn_final_result->>'caughtUid')::bigint>=1)
          ))
      ))
  );
CREATE UNIQUE INDEX game_wild_turn_final_action_unique
  ON game_encounter_reservations(account_id,battle_turn_final_action_id)
  WHERE battle_turn_final_action_id IS NOT NULL;
