-- ONLINE-01C: security tables; migration runner owns the transaction.
-- No user-created saves and no automatic import of local browser progress.
CREATE TABLE IF NOT EXISTS game_auth_throttles (
  scope varchar(32) NOT NULL,
  subject_digest bytea NOT NULL,
  window_started timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts>=0),
  PRIMARY KEY(scope,subject_digest),
  CONSTRAINT game_auth_throttles_digest_size CHECK(octet_length(subject_digest)=32)
);
CREATE INDEX IF NOT EXISTS game_auth_throttles_expiry_idx
  ON game_auth_throttles(window_started);

CREATE TABLE IF NOT EXISTS game_email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  token_sha256 bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_email_token_digest_size CHECK(octet_length(token_sha256)=32),
  CONSTRAINT game_email_expiry_after_creation CHECK(expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS game_email_verifications_account_idx
  ON game_email_verifications(account_id,created_at DESC);
