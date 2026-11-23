-- ONLINE-01C-14: authoritative reward QUOTE, not settlement.
-- Do not unlock a reserved encounter or credit any player resource.
ALTER TABLE game_encounter_reservations
  ADD COLUMN battle_reward_quote jsonb,
  ADD COLUMN battle_reward_quote_at timestamptz;
ALTER TABLE game_encounter_reservations
  ADD CONSTRAINT game_encounter_reward_quote_coherent CHECK (
    (battle_reward_quote IS NULL AND battle_reward_quote_at IS NULL)
    OR
    (battle_reward_quote IS NOT NULL
     AND jsonb_typeof(battle_reward_quote)='object'
     AND battle_reward_quote_at IS NOT NULL
     AND battle_sealed_outcome IS NOT NULL
     AND battle_reward_quote->>'outcome'=battle_sealed_outcome
     AND status='reserved')
  );
