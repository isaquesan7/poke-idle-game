-- ONLINE-01C-23C1 — record key version, not key material.
-- NULL is allowed for already-existing HMAC Gym sessions, which must be
-- matched to a retained historical secret by the private keyring resolver.
ALTER TABLE game_gym_reservations
  ADD COLUMN turn_entropy_key_id varchar(32),
  ADD CONSTRAINT gym_entropy_key_id_format CHECK(
    turn_entropy_key_id IS NULL OR
    turn_entropy_key_id ~ '^[a-z][a-z0-9_-]{0,31}$'
  ),
  ADD CONSTRAINT gym_entropy_key_id_requires_proof CHECK(
    turn_entropy_key_id IS NULL OR turn_entropy_proof IS NOT NULL
  );
