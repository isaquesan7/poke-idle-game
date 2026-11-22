-- ONLINE-01: PostgreSQL 18, initial schema for NEW accounts only.
-- No localStorage migration and no trust in client-provided battle rewards.
BEGIN;
CREATE TABLE IF NOT EXISTS game_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  CONSTRAINT game_accounts_email_valid CHECK (
    char_length(email) BETWEEN 5 AND 254 AND email = lower(btrim(email))
    AND position('@' IN email)>1),
  CONSTRAINT game_accounts_password_hash CHECK (char_length(password_hash) BETWEEN 40 AND 512)
);
CREATE UNIQUE INDEX IF NOT EXISTS game_accounts_email_unique
  ON game_accounts (email);
CREATE TABLE IF NOT EXISTS game_auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  token_sha256 bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  CONSTRAINT game_auth_token_length CHECK (octet_length(token_sha256)=32),
  CONSTRAINT game_auth_valid_expiry CHECK (expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS game_auth_sessions_account_idx
  ON game_auth_sessions(account_id,expires_at);
CREATE TABLE IF NOT EXISTS game_profiles (
  account_id uuid PRIMARY KEY REFERENCES game_accounts(id) ON DELETE CASCADE,
  trainer_name varchar(32) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_profiles_trainer_name CHECK (length(btrim(trainer_name)) BETWEEN 2 AND 32)
);
CREATE TABLE IF NOT EXISTS game_saves (
  account_id uuid PRIMARY KEY REFERENCES game_accounts(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 2 CHECK (schema_version>=2),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0),
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_saves_state_object CHECK (jsonb_typeof(state)='object')
);
CREATE TABLE IF NOT EXISTS game_action_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  action_id varchar(128) NOT NULL,
  kind varchar(48) NOT NULL,
  save_revision bigint NOT NULL CHECK (save_revision>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id,action_id)
);
CREATE INDEX IF NOT EXISTS game_action_receipts_account_idx
  ON game_action_receipts(account_id,created_at DESC);
COMMIT;
