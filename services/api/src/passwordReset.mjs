/** Transactional single-use password reset, never trust client auth state. */
import {randomBytes,createHash} from 'node:crypto';
import {hashPassword,validatePassword} from './auth.mjs';

const digest=token=>createHash('sha256').update(token).digest();
export async function issuePasswordReset(pool,email,{enqueue}={}){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const account=await client.query(
      'SELECT id FROM game_accounts WHERE email=$1 AND disabled_at IS NULL AND email_verified_at IS NOT NULL FOR UPDATE',
      [email]);
    // Caller must return the same response whether the email exists or not.
    if(!account.rowCount){await client.query('COMMIT');return null;}
    const accountId=account.rows[0].id;
    await client.query(
      'UPDATE game_password_resets SET used_at=now() WHERE account_id=$1 AND used_at IS NULL',
      [accountId]);
    const token=randomBytes(32).toString('base64url');
    const inserted=await client.query(`INSERT INTO game_password_resets
      (account_id,token_sha256,expires_at)
      VALUES($1,$2,now()+interval '30 minutes') RETURNING id,expires_at`,
      [accountId,digest(token)]);
    if(enqueue)await enqueue(client,{accountId,token,tokenId:inserted.rows[0].id,
      expiresAt:inserted.rows[0].expires_at});
    await client.query('COMMIT');
    return token;
  }catch(e){await client.query('ROLLBACK');throw e;}
  finally{client.release();}
}
export async function consumePasswordReset(pool,token,newPassword){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return false;
  validatePassword(newPassword);
  const nextHash=await hashPassword(newPassword);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const result=await client.query(`SELECT id,account_id
      FROM game_password_resets
      WHERE token_sha256=$1 AND used_at IS NULL AND expires_at>now()
      FOR UPDATE`,[digest(token)]);
    if(!result.rowCount){await client.query('ROLLBACK');return false;}
    const {id,account_id}=result.rows[0];
    await client.query('UPDATE game_accounts SET password_hash=$1,updated_at=now() WHERE id=$2',
      [nextHash,account_id]);
    await client.query('UPDATE game_password_resets SET used_at=now() WHERE id=$1',[id]);
    // All previous device sessions must be invalidated after password reset.
    await client.query('UPDATE game_auth_sessions SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL',
      [account_id]);
    await client.query('COMMIT');
    return true;
  }catch(e){await client.query('ROLLBACK');throw e;}
  finally{client.release();}
}
