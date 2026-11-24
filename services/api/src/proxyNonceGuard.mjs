/**
 * ONLINE-01C-23E11: candidate replay guard, not wired to runtime.
 * Requires isolated schema fixture until an approved production migration.
 */
import {createHash} from 'node:crypto';
import {verifyProxyIdentity} from './proxyIdentity.mjs';

export async function consumeProxyIdentity(pool,request){
  const verified=verifyProxyIdentity(request);
  if(!verified)return null;
  // Keep only a digest of the random nonce; no subject, IP or assertion.
  const digest=createHash('sha256').update(Buffer.from(verified.nonce,'base64url')).digest();
  // Database clock independently enforces freshness. One committed insert
  // wins across all replicas. A failure is propagated, never treated as success.
  const result=await pool.query(`
    INSERT INTO game_proxy_identity_nonces(nonce_digest,expires_at)
    SELECT $1,to_timestamp($3::double precision/1000)
    WHERE statement_timestamp() <= to_timestamp($3::double precision/1000)
      AND statement_timestamp() >= to_timestamp($2::double precision/1000)-interval '2 seconds'
    ON CONFLICT(nonce_digest) DO NOTHING
    RETURNING 1`,[digest,verified.issuedAtMs,verified.expiresAtMs]);
  return result.rowCount===1?{subject:verified.subject}:null;
}

// Separate bounded maintenance operation; never delete within validity window.
// Five-minute extra retention protects against small backward clock adjustments.
export async function pruneProxyIdentityNonces(pool,{limit=500}={}){
  if(!Number.isInteger(limit)||limit<1||limit>500)
    throw new TypeError('Invalid nonce cleanup batch');
  const result=await pool.query(`
    WITH expired AS (
      SELECT nonce_digest FROM game_proxy_identity_nonces
      WHERE expires_at < statement_timestamp()-interval '5 minutes'
      ORDER BY expires_at,nonce_digest LIMIT $1 FOR UPDATE SKIP LOCKED
    )
    DELETE FROM game_proxy_identity_nonces n USING expired e
    WHERE n.nonce_digest=e.nonce_digest`,[limit]);
  return result.rowCount;
}
