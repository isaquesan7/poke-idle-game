-- ONLINE-01C-23B2H: one-time settlement from replayed terminal certificate.
ALTER TABLE game_gym_reservations
  ADD COLUMN payout_action_id varchar(100),
  ADD COLUMN payout_revision bigint,
  ADD COLUMN payout_receipt jsonb,
  ADD COLUMN paid_at timestamptz,
  ADD CONSTRAINT game_gym_payout_complete CHECK(
    (payout_action_id IS NULL AND payout_revision IS NULL
      AND payout_receipt IS NULL AND paid_at IS NULL)
    OR
    (payout_action_id IS NOT NULL
      AND length(payout_action_id) BETWEEN 12 AND 100
      AND payout_revision>=2
      AND payout_receipt IS NOT NULL
      AND jsonb_typeof(payout_receipt)='object'
      AND paid_at IS NOT NULL
      AND status='completed'
      AND certificate_action_id IS NOT NULL
      AND certificate_outcome=payout_receipt->>'outcome'
      AND (certificate_outcome='player-win')=
        (payout_receipt->>'badgeId'=gym_id))
  );
CREATE UNIQUE INDEX game_gym_payout_once_action
  ON game_gym_reservations(account_id,payout_action_id)
  WHERE payout_action_id IS NOT NULL;
