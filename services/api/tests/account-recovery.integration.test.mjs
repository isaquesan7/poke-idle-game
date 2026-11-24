import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import pg from 'pg';

// Runs only in disposable PostgreSQL integration CI. Never send real email.
const origin='http://127.0.0.1:43149';
async function call(path,method='GET',body,headers={}){
  const response=await fetch(origin+path,{method,redirect:'manual',
    headers:{...(body?{'Content-Type':'application/json',Origin:origin}:{}),...headers},
    body:body?JSON.stringify(body):undefined});
  return {status:response.status,headers:response.headers,data:await response.json()};
}
test('ONLINE-01C-23C9: real HTTP account recovery expires, invalidates and revokes sessions',async()=>{
  assert.ok(process.env.DATABASE_URL,'Use disposable PostgreSQL only');
  const child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,PORT:'43149',APP_ORIGIN:origin,NODE_ENV:'test',
      ONLINE_REGISTRATION_ENABLED:'true',ACCOUNT_MAIL_MODE:'off'},
    stdio:'ignore'
  });
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  const email='identity-23c9-'+process.pid+'@example.test';
  const password='initial unique and strong passphrase 2026';
  const updated='replacement unique and strong passphrase 2026';
  let accountId;
  try{
    let ready=false;
    for(let i=0;i<120;i++){
      try{if((await call('/health')).status===200){ready=true;break;}}catch{}
      if(child.exitCode!==null)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.equal(ready,true,'isolated test API must start');
    const status=await call('/api/v1/status');
    assert.equal(status.data.registrationEnabled,true);
    const registered=await call('/api/v1/auth/register','POST',{
      email,password,trainerName:'Treinador Recuperacao'});
    assert.equal(registered.status,201);
    accountId=registered.data.id;
    const expiredVerify=registered.data.verificationToken;
    assert.match(expiredVerify,/^[A-Za-z0-9_-]{43}$/);
    const verifyStorage=await pool.query(
      'SELECT token_sha256 FROM game_email_verifications WHERE account_id=$1',[accountId]);
    assert.equal(verifyStorage.rowCount,1);
    assert.equal(verifyStorage.rows[0].token_sha256.length,32);
    assert.ok(!verifyStorage.rows[0].token_sha256.toString('hex').includes(expiredVerify));
    await pool.query(
      "UPDATE game_email_verifications SET expires_at=now()-interval '1 second' WHERE account_id=$1",
      [accountId]);
    assert.equal((await call('/api/v1/auth/verify','POST',{token:expiredVerify})).status,400,
      'expired verification token cannot activate account');
    assert.equal((await call('/api/v1/auth/login','POST',{email,password})).status,403,
      'unverified account cannot log in');
    assert.equal((await call('/api/v1/auth/request-reset','POST',{email})).status,200,
      'reset requests do not expose unverified account status');
    const unverifiedRows=await pool.query(
      'SELECT count(*)::int AS total FROM game_password_resets WHERE account_id=$1',[accountId]);
    assert.equal(unverifiedRows.rows[0].total,0,
      'unverified account must not receive password reset token');

    // Create a fresh one-use verification token using the existing internal issuer.
    // No public resend endpoint is invented or enabled.
    const {issueVerification}=await import('../src/authSecurity.mjs');
    const freshVerify=await issueVerification(pool,accountId);
    assert.equal((await call('/api/v1/auth/verify','POST',
      {token:freshVerify},{Origin:'https://attacker.example'})).status,400);
    assert.equal((await call('/api/v1/auth/verify','POST',{token:freshVerify})).status,200);
    assert.equal((await call('/api/v1/auth/verify','POST',{token:freshVerify})).status,400);

    const login=await call('/api/v1/auth/login','POST',{email,password});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie?.includes('='));
    assert.equal((await call('/api/v1/me','GET',undefined,{Cookie:cookie})).status,200);
    const first=await call('/api/v1/auth/request-reset','POST',{email});
    assert.equal(first.status,200);
    assert.match(first.data.testResetToken,/^[A-Za-z0-9_-]{43}$/);
    const second=await call('/api/v1/auth/request-reset','POST',{email});
    assert.equal(second.status,200);
    assert.match(second.data.testResetToken,/^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(first.data.testResetToken,second.data.testResetToken);
    assert.equal((await call('/api/v1/auth/confirm-reset','POST',
      {token:first.data.testResetToken,password:updated})).status,400,
      'newer request revokes previous password-reset token');
    await pool.query(
      "UPDATE game_password_resets SET expires_at=now()-interval '1 second' WHERE account_id=$1 AND used_at IS NULL",
      [accountId]);
    assert.equal((await call('/api/v1/auth/confirm-reset','POST',
      {token:second.data.testResetToken,password:updated})).status,400,
      'expired password reset must not change credentials');
    assert.equal((await call('/api/v1/me','GET',undefined,{Cookie:cookie})).status,200,
      'failed resets cannot revoke live sessions');

    const third=await call('/api/v1/auth/request-reset','POST',{email});
    assert.equal(third.status,200);
    assert.match(third.data.testResetToken,/^[A-Za-z0-9_-]{43}$/);
    assert.equal((await call('/api/v1/auth/confirm-reset','POST',
      {token:third.data.testResetToken,password:updated},
      {Origin:'https://attacker.example'})).status,400);
    assert.equal((await call('/api/v1/auth/confirm-reset','POST',
      {token:third.data.testResetToken,password:updated})).status,200);
    assert.equal((await call('/api/v1/auth/confirm-reset','POST',
      {token:third.data.testResetToken,password:updated})).status,400,
      'successful reset is single use');
    assert.equal((await call('/api/v1/me','GET',undefined,{Cookie:cookie})).status,401,
      'successful reset revokes sessions');
    assert.equal((await call('/api/v1/auth/login','POST',{email,password})).status,401);
    const next=await call('/api/v1/auth/login','POST',{email,password:updated});
    assert.equal(next.status,200);
    const nextCookie=next.headers.get('set-cookie')?.split(';')[0];
    assert.equal((await call('/api/v1/auth/logout','POST',{},
      {Cookie:nextCookie,Origin:'https://attacker.example'})).status,400);
    assert.equal((await call('/api/v1/me','GET',undefined,{Cookie:nextCookie})).status,200);
    assert.equal((await call('/api/v1/auth/logout','POST',{},
      {Cookie:nextCookie})).status,200);
    assert.equal((await call('/api/v1/me','GET',undefined,{Cookie:nextCookie})).status,401);
    const resetHashes=await pool.query(
      'SELECT token_sha256 FROM game_password_resets WHERE account_id=$1',[accountId]);
    assert.equal(resetHashes.rowCount,3);
    assert.ok(resetHashes.rows.every(row=>row.token_sha256.length===32),
      'database must store token digests, never bearer tokens');
  }finally{
    child.kill('SIGTERM');
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});
