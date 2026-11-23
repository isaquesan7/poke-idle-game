-- ONLINE-01C-16: finish a PAID encounter atomically after one capture/skip decision.
-- Old checks assumed "reserved forever"; preserve their integrity predicates
-- while allowing only a fully settled capture/skip to mark "completed".
ALTER TABLE game_encounter_reservations
  ADD COLUMN final_action_id varchar(100),
  ADD COLUMN final_choice varchar(10),
  ADD COLUMN final_revision bigint,
  ADD COLUMN final_result jsonb,
  ADD COLUMN finalized_at timestamptz;

ALTER TABLE game_encounter_reservations
  DROP CONSTRAINT game_encounter_battle_seal_coherent;
ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_encounter_battle_seal_coherent CHECK (
    (battle_sealed_outcome IS NULL AND battle_sealed_at IS NULL
      AND battle_seal_action_id IS NULL AND battle_seal_revision IS NULL)
    OR
    (battle_sealed_outcome IN ('win','loss','draw')
      AND battle_sealed_at IS NOT NULL
      AND battle_seal_action_id IS NOT NULL
      AND length(battle_seal_action_id) BETWEEN 12 AND 100
      AND battle_seal_revision IS NOT NULL AND battle_seal_revision>=1
      AND battle_preview IS NOT NULL
      AND coalesce(battle_preview->>'outcome','')=battle_sealed_outcome
      AND status IN ('reserved','completed'))
  );

ALTER TABLE game_encounter_reservations
  DROP CONSTRAINT game_encounter_reward_quote_coherent;
ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_encounter_reward_quote_coherent CHECK (
    (battle_reward_quote IS NULL AND battle_reward_quote_at IS NULL)
    OR
    (battle_reward_quote IS NOT NULL
      AND jsonb_typeof(battle_reward_quote)='object'
      AND battle_reward_quote_at IS NOT NULL
      AND battle_sealed_outcome IS NOT NULL
      AND coalesce(battle_reward_quote->>'outcome','')=battle_sealed_outcome
      AND status IN ('reserved','completed'))
  );

ALTER TABLE game_encounter_reservations
  DROP CONSTRAINT game_encounter_payout_complete;
ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_encounter_payout_complete CHECK (
    (battle_payout_action_id IS NULL AND battle_payout_revision IS NULL
      AND battle_paid_at IS NULL AND battle_payout_receipt IS NULL)
    OR
    (battle_payout_action_id IS NOT NULL
      AND length(battle_payout_action_id) BETWEEN 12 AND 100
      AND battle_payout_revision IS NOT NULL AND battle_payout_revision>=1
      AND battle_paid_at IS NOT NULL
      AND battle_payout_receipt IS NOT NULL
      AND jsonb_typeof(battle_payout_receipt)='object'
      AND battle_reward_quote IS NOT NULL
      AND coalesce(battle_payout_receipt->>'outcome','')=battle_sealed_outcome
      AND status IN ('reserved','completed'))
  );

ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_encounter_finalization_complete CHECK (
    ((status='reserved' OR status='cancelled')
       AND final_action_id IS NULL AND final_choice IS NULL
       AND final_revision IS NULL AND final_result IS NULL
       AND finalized_at IS NULL)
    OR
    (status='completed'
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
           AND final_result->>'ballId'=final_choice))))
  );
CREATE UNIQUE INDEX game_encounter_final_action_unique
  ON game_encounter_reservations(account_id,final_action_id)
  WHERE final_action_id IS NOT NULL;
