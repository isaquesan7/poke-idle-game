/** Internal, opt-in 23D0 transactional mail outbox. No production worker is started.
 * Encrypts recipient+token+origin with AES-256-GCM before SQL persistence.
 * Store encryption key ONLY in a private versioned runtime keyring; retaining
 * old keys is mandatory until all old messages expire / are delivered.
 */
import {randomBytes,createCipheriv,createDecipheriv,createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {deliverAccountEmail} from './mailer.mjs';
const idPattern=/^[a-z][a-z0-9_-]{0,31}$/;
const actionPattern=/^[a-zA-Z0-9_:/.-]{1,180}$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
const maxAttempts=5;
export function mailKeyring({activeId,keys}){
  if(!idPattern.test(activeId??'')||!keys||typeof keys!=='object'||
    Array.isArray(keys))throw new Error('Invalid mail encryption keyring');
  const parsed=new Map();
  for(const [id,value] of Object.entries(keys)){
    if(!idPattern.test(id)||typeof value!=='string'||!(/^[A-Za-z0-9+/]{43}=$/.test(value)))
      throw new Error('Invalid mail encryption keyring');
    const decoded=Buffer.from(value,'base64');
    if(decoded.length!==32||decoded.toString('base64')!==value)
      throw new Error('Invalid mail encryption keyring');
    parsed.set(id,decoded);
  }
  if(!parsed.has(activeId))throw new Error('Active mail encryption key missing');
  return Object.freeze({activeId,keys:parsed});
}
function assertMessage({accountId,idempotencyKey,purpose,to,token,origin,expiresAt}){
  if(!uuidPattern.test(accountId??'')||!actionPattern.test(idempotencyKey??'')||
    !['verify','reset'].includes(purpose)||typeof to!=='string'||to.length>254||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||!tokenPattern.test(token??'')||
    typeof origin!=='string'||!/^https:\/\/[^\s/]+(?:\/)?$/.test(origin)||
    !(expiresAt instanceof Date)||!Number.isFinite(expiresAt.getTime())||
    expiresAt.getTime()<=Date.now())
    throw new TypeError('Invalid mail outbox message');
}
export function encryptMailPayload(payload,key){
  const nonce=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,nonce);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
  return Buffer.concat([nonce,cipher.getAuthTag(),encrypted]);
}
export function decryptMailPayload(buffer,key){
  if(!Buffer.isBuffer(buffer)||buffer.length<=28)throw new Error('Invalid encrypted mail');
  const decipher=createDecipheriv('aes-256-gcm',key,buffer.subarray(0,12));
  decipher.setAuthTag(buffer.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(buffer.subarray(28)),decipher.final()]).toString('utf8'));
}
/** Pass a pg transaction client, not a Pool: caller commits alongside token issuance.
 * Same key is idempotent, but a different payload is never silently overwritten.
 */
export async function enqueueAccountMail(client,keyring,message){
  assertMessage(message);
  const {accountId,idempotencyKey,purpose,to,token,origin,expiresAt}=message;
  const key=keyring.keys.get(keyring.activeId);
  if(!key)throw new Error('Active key unavailable');
  const ciphertext=encryptMailPayload({to,token,origin},key);
  const fingerprint=createHmac('sha256',key).update(JSON.stringify({accountId,idempotencyKey,purpose,to,token,origin,expiresAt:expiresAt.toISOString()})).digest();
  const result=await client.query(`
    INSERT INTO game_account_mail_outbox
      (account_id,idempotency_key,purpose,encrypted_payload,key_id,expires_at,payload_fingerprint)
    VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(idempotency_key) DO NOTHING RETURNING id
  `,[accountId,idempotencyKey,purpose,ciphertext,keyring.activeId,expiresAt,fingerprint]);
  if(!result.rowCount){
    const existing=await client.query(`SELECT account_id,purpose,key_id,payload_fingerprint
      FROM game_account_mail_outbox WHERE idempotency_key=$1`,[idempotencyKey]);
    const old=existing.rows[0];
    const oldKey=old&&keyring.keys.get(old.key_id);
    const originalFingerprint=oldKey?createHmac('sha256',oldKey).update(JSON.stringify({accountId,idempotencyKey,purpose,to,token,origin,expiresAt:expiresAt.toISOString()})).digest():null;
    if(!old||old.account_id!==accountId||old.purpose!==purpose||
      !originalFingerprint||!timingSafeEqual(old.payload_fingerprint,originalFingerprint))
      throw new Error('Outbox idempotency conflict');
  }
  // Never disclose ciphertext or token in receipts.
  return {queued:result.rowCount===1};
}
/** No external send for a revoked, used, expired or foreign-account token. */
export async function accountMailTokenActive(pool,purpose,token,outboxId){
  if(!['verify','reset'].includes(purpose)||!tokenPattern.test(token??'')||
    !uuidPattern.test(outboxId??''))return false;
  const table=purpose==='verify'?'game_email_verifications':'game_password_resets';
  const result=await pool.query(`SELECT 1
    FROM game_account_mail_outbox o
    JOIN ${table} t ON t.account_id=o.account_id
    JOIN game_accounts a ON a.id=o.account_id
    WHERE o.id=$1 AND o.purpose=$2
      AND t.token_sha256=$3 AND t.used_at IS NULL
      AND t.expires_at>now() AND a.disabled_at IS NULL
      AND ($2='verify' OR a.email_verified_at IS NOT NULL)
      AND ($2='reset' OR a.email_verified_at IS NULL)
    LIMIT 1`,[outboxId,purpose,createHash('sha256').update(token).digest()]);
  return result.rowCount===1;
}

/**
 * Maintenance is explicit, bounded and safe to run concurrently with claims.
 * Only unleased rows can be finalized; a claimed in-flight message is untouched.
 * Counters contain no recipient, token, provider secret or message payload.
 */
export async function reconcileAccountMail(pool){
  const expired=await pool.query(`
    UPDATE game_account_mail_outbox
       SET status='expired',lease_until=NULL,updated_at=now()
     WHERE status IN ('pending','sending') AND expires_at<=now()
       AND (lease_until IS NULL OR lease_until<now())
    RETURNING id`);
  const dead=await pool.query(`
    UPDATE game_account_mail_outbox
       SET status='dead',lease_until=NULL,updated_at=now()
     WHERE status IN ('pending','sending') AND attempt_count>=$1
       AND (lease_until IS NULL OR lease_until<now())
    RETURNING id`,[maxAttempts]);
  return {expired:expired.rowCount,dead:dead.rowCount};
}

/** Read-only operator snapshot. No PII, URLs, token material or ids. */
export async function accountMailMetrics(pool){
  const totals=await pool.query(`
    SELECT status,count(*)::int AS total
      FROM game_account_mail_outbox GROUP BY status`);
  const delayed=await pool.query(`
    SELECT count(*)::int AS total,
      COALESCE(max(extract(epoch FROM(now()-created_at))),0)::integer AS oldest_seconds
    FROM game_account_mail_outbox
    WHERE status IN ('pending','sending') AND expires_at>now()
        AND available_at<=now()
      AND expires_at>now()`);
  const counts=Object.fromEntries(
    ['pending','sending','delivered','expired','dead'].map(key=>[key,0]));
  for(const row of totals.rows)if(Object.hasOwn(counts,row.status))
    counts[row.status]=row.total;
  return {counts,backlog:delayed.rows[0].total,
    oldestBacklogSeconds:Math.max(0,delayed.rows[0].oldest_seconds)};
}

/** Claim leases using SKIP LOCKED. Crash after provider acceptance can retry:
 * stable Resend idempotency_key is essential (at-least-once worker semantics).
 */
export async function claimAccountMail(pool){
  const result=await pool.query(`
    WITH candidate AS (
      SELECT id FROM game_account_mail_outbox
      WHERE status IN ('pending','sending') AND available_at<=now()
        AND (lease_until IS NULL OR lease_until<now())
        AND attempt_count<$1
      ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE game_account_mail_outbox AS m
      SET status='sending',attempt_count=m.attempt_count+1,
        lease_until=now()+interval '45 seconds',updated_at=now()
    FROM candidate WHERE m.id=candidate.id
    RETURNING m.id,m.purpose,m.key_id,m.encrypted_payload,m.expires_at,
      m.idempotency_key,m.attempt_count
  `,[maxAttempts]);
  return result.rows[0]??null;
}
export async function processOneAccountMail(pool,{keyring,from,providerKey,send}){
  const row=await claimAccountMail(pool);
  if(!row)return {status:'idle'};
  const id=row.id;
  // A worker must fail closed if historical key is absent: never delete ciphertext.
  const key=keyring.keys.get(row.key_id);
  if(!key){
    // Keep historical ciphertext intact. Release the lease with a bounded
    // delay so a missing key does not hot-loop or monopolize claim order.
    await pool.query(`UPDATE game_account_mail_outbox
      SET status='pending',lease_until=NULL,
          available_at=now()+interval '5 minutes',updated_at=now()
      WHERE id=$1 AND status='sending' AND attempt_count=$2
        AND lease_until>now()
        AND lease_until>now()`,[id,row.attempt_count]);
    return {status:'blocked-key',id};
  }
  if(new Date(row.expires_at).getTime()<=Date.now()){
    await pool.query(`
      UPDATE game_account_mail_outbox SET status='expired',lease_until=NULL,
      updated_at=now() WHERE id=$1 AND status='sending' AND
      attempt_count=$2`,[id,row.attempt_count]);
    return {status:'expired',id};
  }
  try{
    const data=decryptMailPayload(row.encrypted_payload,key);
    // Reject revoked/consumed/expired tokens before calling the mail provider.
    // This is a last-minute read, not a lock across an external network call.
    const tokenStillActive=await accountMailTokenActive(pool,row.purpose,data.token,id);
    if(!tokenStillActive){
      await pool.query(`UPDATE game_account_mail_outbox SET status='expired',
        lease_until=NULL,updated_at=now() WHERE id=$1 AND status='sending'
        AND attempt_count=$2 AND lease_until>now()`,[id,row.attempt_count]);
      return {status:'revoked',id};
    }
    const delivered=await deliverAccountEmail({
      to:data.to,purpose:row.purpose,token:data.token,origin:data.origin,
      key:providerKey,from,idempotencyKey:row.idempotency_key,send
    });
    await pool.query(`
      UPDATE game_account_mail_outbox SET status='delivered',
      provider_receipt=$3,delivered_at=now(),lease_until=NULL,
      updated_at=now()
      WHERE id=$1 AND status='sending' AND attempt_count=$2
    `,[id,row.attempt_count,delivered.id]);
    return {status:'delivered',id};
  }catch{
    const dead=row.attempt_count>=maxAttempts;
    await pool.query(`
      UPDATE game_account_mail_outbox
      SET status=$3,lease_until=NULL,
        available_at=now()+($4::integer*interval '1 second'),updated_at=now()
      WHERE id=$1 AND status='sending' AND attempt_count=$2
    `,[id,row.attempt_count,dead?'dead':'pending',Math.min(900,2**row.attempt_count*15)]);
    return {status:dead?'dead':'retry',id};
  }
}
