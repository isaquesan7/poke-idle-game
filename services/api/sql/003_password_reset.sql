-- ONLINE-01C-2: password reset tokens, always stored hashed and expiring.
CREATE TABLE IF NOT EXISTS game_password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  token_sha256 bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_password_reset_digest_size CHECK(octet_length(token_sha256)=32),
  CONSTRAINT game_password_reset_expiry CHECK(expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS game_password_resets_account_idx
  ON game_password_resets(account_id,created_at DESC);
