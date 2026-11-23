-- ONLINE-01C-23B2G: independent Gym terminal certificate, no payout.
-- A completed fight remains reserved until a separate one-time settlement.
ALTER TABLE game_gym_reservations
  ADD COLUMN certificate_action_id varchar(100),
  ADD COLUMN certificate_outcome text,
  ADD COLUMN certificate_revision bigint,
  ADD COLUMN certificate_turns smallint,
  ADD COLUMN certificate_digest char(64),
  ADD COLUMN certified_at timestamptz,
  ADD CONSTRAINT game_gym_certificate_complete CHECK (
    (certificate_action_id IS NULL AND certificate_outcome IS NULL
     AND certificate_revision IS NULL AND certificate_turns IS NULL
     AND certificate_digest IS NULL AND certified_at IS NULL)
    OR
    (certificate_action_id IS NOT NULL
     AND length(certificate_action_id) BETWEEN 12 AND 100
     AND certificate_outcome IN ('player-win','leader-win','draw')
     AND certificate_revision >= 2
     AND certificate_turns BETWEEN 1 AND 140
     AND certificate_digest ~ '^[0-9a-f]{64}$'
     AND certified_at IS NOT NULL
     AND status IN ('reserved','completed')
     AND turn_state IS NOT NULL
     AND turn_state->>'outcome'=certificate_outcome
     AND turn_entropy_proof IS NOT NULL)
  );
CREATE UNIQUE INDEX game_gym_certificate_once_action
  ON game_gym_reservations(account_id,certificate_action_id)
  WHERE certificate_action_id IS NOT NULL;
