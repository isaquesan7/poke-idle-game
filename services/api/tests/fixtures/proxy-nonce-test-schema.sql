-- Isolated test fixture ONLY; not registered in migrate.mjs.
CREATE TABLE game_proxy_identity_nonces (
  nonce_digest bytea PRIMARY KEY CHECK (octet_length(nonce_digest)=32),
  expires_at timestamptz NOT NULL
);
CREATE INDEX game_proxy_identity_nonces_expiry_idx
  ON game_proxy_identity_nonces(expires_at,nonce_digest);
