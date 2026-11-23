-- ONLINE-01C-19: one durable receipt for every server-authoritative wild turn.
-- Phase 012 remains mutually exclusive with the legacy automatic preview.
-- This table is append-only; no rewards, captures or public API are enabled.
CREATE TABLE game_wild_turn_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  encounter_id uuid NOT NULL REFERENCES game_encounter_reservations(id) ON DELETE CASCADE,
  action_id varchar(100) NOT NULL,
  turn_number smallint NOT NULL CHECK (turn_number BETWEEN 1 AND 30),
  player_action jsonb NOT NULL,
  wild_action jsonb NOT NULL,
  turn_result jsonb NOT NULL,
  save_revision bigint NOT NULL CHECK (save_revision>=2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_wild_turn_receipt_complete CHECK (
    length(action_id) BETWEEN 12 AND 100
    AND jsonb_typeof(player_action)='object'
    AND jsonb_typeof(wild_action)='object'
    AND jsonb_typeof(turn_result)='object'
    AND coalesce(turn_result->>'turn','')=turn_number::text
    AND coalesce(turn_result->>'phase','') IN ('await-player','resolved')
    AND turn_result->>'seed' IS NULL
  ),
  CONSTRAINT game_wild_turn_action_once UNIQUE (account_id,action_id),
  CONSTRAINT game_wild_turn_number_once UNIQUE (encounter_id,turn_number)
);
CREATE INDEX game_wild_turn_history_idx
  ON game_wild_turn_receipts(encounter_id,turn_number);
