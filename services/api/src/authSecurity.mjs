/** ONLINE-01C: Postgres-backed throttle, safe across Node replicas.
 * Per-subject HMAC prevents storing raw email and IP in throttle tables.
 * Never trust forwarded headers from an unknown reverse proxy.
 */
import {createHmac,randomBytes,createHash} from 'node:crypto';

export function rateDigest(scope,identifier,secret){
  if(typeof secret!=='string'||secret.length<32)
    throw new Error('AUTH_RATE_LIMIT_SECRET ausente ou curto (mínimo 32 bytes)');
  return createHmac('sha256',secret).update(scope+'\0'+identifier).digest();
}
export async function throttle(pool,{scope,identifier,secret,limit,windowMinutes=15}){
  if(!Number.isInteger(limit)||limit<1||!Number.isInteger(windowMinutes)
    ||windowMinutes<1)throw new TypeError('Parâmetros de rate limit inválidos.');
  const digest=rateDigest(scope,identifier,secret);
  // Atomic UPSERT makes the quota consistent among process replicas.
  const result=await pool.query(`
    INSERT INTO game_auth_throttles AS t
      (scope,subject_digest,window_started,attempts)
    VALUES($1,$2,now(),1)
    ON CONFLICT(scope,subject_digest) DO UPDATE SET
      attempts=CASE WHEN t.window_started < now()-($3::integer*interval '1 minute')
        THEN 1 ELSE t.attempts+1 END,
      window_started=CASE WHEN t.window_started < now()-($3::integer*interval '1 minute')
        THEN now() ELSE t.window_started END
    RETURNING attempts`,[scope,digest,windowMinutes]);
  return {allowed:result.rows[0].attempts<=limit,
    attempts:result.rows[0].attempts};
}
export function requesterIp(req){
  // Real TCP peer, never X-Forwarded-For, to prevent spoofable quotas.
  return req.socket?.remoteAddress??'unknown-peer';
}
export function verificationToken(){
  return randomBytes(32).toString('base64url');
}
export function verificationDigest(token){
  return createHash('sha256').update(token).digest();
}
export async function issueVerification(client,accountId){
  const token=verificationToken();
  await client.query(`INSERT INTO game_email_verifications
    (account_id,token_sha256,expires_at)
    VALUES($1,$2,now()+interval '24 hours')`,
    [accountId,verificationDigest(token)]);
  return token;
}
export async function consumeVerification(pool,token){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return false;
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const found=await client.query(`SELECT id,account_id
      FROM game_email_verifications
      WHERE token_sha256=$1 AND used_at IS NULL AND expires_at>now()
      FOR UPDATE`,[verificationDigest(token)]);
    if(!found.rowCount){await client.query('ROLLBACK');return false;}
    const {id,account_id}=found.rows[0];
    await client.query('UPDATE game_accounts SET email_verified_at=now() WHERE id=$1',
      [account_id]);
    await client.query('UPDATE game_email_verifications SET used_at=now() WHERE id=$1',[id]);
    await client.query('COMMIT');
    return true;
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{client.release();}
}
