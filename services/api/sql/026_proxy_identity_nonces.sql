-- ONLINE-01C-23E16: candidate migration; NOT registered in migrate.mjs.
-- No IP, account, email, assertion, key or body is stored.
CREATE TABLE game_proxy_identity_nonces (
  nonce_digest bytea PRIMARY KEY CHECK (octet_length(nonce_digest)=32),
  expires_at timestamptz NOT NULL CHECK (isfinite(expires_at))
);
CREATE INDEX game_proxy_identity_nonces_expiry_idx
  ON game_proxy_identity_nonces(expires_at,nonce_digest);
