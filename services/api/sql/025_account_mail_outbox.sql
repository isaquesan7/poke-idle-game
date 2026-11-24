-- ONLINE-01C-23D0: encrypted-at-rest, server-only transactional mail outbox.
-- No plaintext email address or bearer link/token in the database.
CREATE TABLE game_account_mail_outbox(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
  idempotency_key varchar(180) NOT NULL UNIQUE,
  purpose varchar(8) NOT NULL CHECK (purpose IN ('verify','reset')),
  encrypted_payload bytea NOT NULL,
  key_id varchar(32) NOT NULL CHECK (key_id ~ '^[a-z][a-z0-9_-]{0,31}$'),
  expires_at timestamptz NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  status varchar(12) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','delivered','expired','dead')),
  provider_receipt varchar(160),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_mail_payload_shape CHECK(octet_length(encrypted_payload)>28),
  CONSTRAINT account_mail_expiry CHECK(expires_at>created_at),
  CONSTRAINT account_mail_delivered CHECK(
    (status='delivered' AND delivered_at IS NOT NULL AND provider_receipt IS NOT NULL)
    OR (status<>'delivered' AND delivered_at IS NULL)
  )
);
CREATE INDEX game_account_mail_ready_idx ON game_account_mail_outbox
  (available_at,id) WHERE status IN ('pending','sending');
CREATE INDEX game_account_mail_account_idx ON game_account_mail_outbox
  (account_id,created_at DESC);
