import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import pg from 'pg';
import {mailKeyring,decryptMailPayload,processOneAccountMail} from '../src/accountMailOutbox.mjs';
const base='http://127.0.0.1:43151';
const origin='https://game.example.test';
const email='mail-23d1-'+process.pid+'@example.test';
const key=Buffer.alloc(32,0x5c).toString('base64');
const keyring=mailKeyring({activeId:'testkey',keys:{testkey:key}});
async function request(path,body){
  const response=await fetch(base+path,{method:body?'POST':'GET',
    headers:body?{'Content-Type':'application/json',Origin:origin}:{},
    body:body?JSON.stringify(body):undefined});
  return {status:response.status,data:await response.json()};
}
async function messages(pool,accountId){
  const result=await pool.query(`SELECT purpose,status,key_id,encrypted_payload,idempotency_key
    FROM game_account_mail_outbox WHERE account_id=$1 ORDER BY created_at,id`,[accountId]);
  return result.rows.map(row=>({...row,payload:decryptMailPayload(
    row.encrypted_payload,keyring.keys.get(row.key_id))}));
}
test('23D1: HTTP issuance and queued delivery share commit; stale resets never sent',async()=>{
  assert.ok(process.env.DATABASE_URL,'Disposable PostgreSQL only');
  const child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,PORT:'43151',APP_ORIGIN:origin,
      NODE_ENV:'test',ONLINE_REGISTRATION_ENABLED:'true',
      ACCOUNT_MAIL_MODE:'outbox',ACCOUNT_MAIL_ACTIVE_KEY_ID:'testkey',
      ACCOUNT_MAIL_KEYRING_JSON:JSON.stringify({testkey:key}),
      AUTH_RATE_LIMIT_SECRET:'test-only-secret-not-for-real-environments-23d1'},
    stdio:'ignore'
  });
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    let ready=false;
    for(let i=0;i<120;i++){
      try{if((await request('/health')).status===200){ready=true;break;}}catch{}
      if(child.exitCode!==null)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.equal(ready,true,'isolated API starts');
    const password='very strong first password for online test 2026';
    const registered=await request('/api/v1/auth/register',{
      email,password,trainerName:'Teste da fila'});
    assert.equal(registered.status,201);
    accountId=registered.data.id;
    assert.equal(Object.hasOwn(registered.data,'verificationToken'),false,
      'outbox mode must not disclose raw verification token in HTTP response');
    let queued=await messages(pool,accountId);
    assert.equal(queued.length,1);
    assert.equal(queued[0].purpose,'verify');
    assert.equal(queued[0].status,'pending');
    const verificationToken=queued[0].payload.token;
    assert.equal((await request('/api/v1/auth/login',{email,password})).status,403);
    let sent=0;
    const fakeProvider=async()=>{sent++;return {ok:true,status:200,json:async()=>({id:'ci-mail-id-'+sent})};};
    const opts={keyring,providerKey:'re_fake_ci',from:'contas@example.test',send:fakeProvider};
    assert.equal((await processOneAccountMail(pool,opts)).status,'delivered');
    assert.equal(sent,1);
    const unknown=await request('/api/v1/auth/request-reset',{email:'unknown-'+process.pid+'@example.test'});
    const resend=await request('/api/v1/auth/request-reset',{email});
    assert.deepEqual(resend,unknown);
    assert.deepEqual(resend,{status:200,data:{accepted:true}});
    queued=await messages(pool,accountId);
    assert.equal(queued.length,2);
    assert.equal(queued[1].purpose,'verify');
    assert.notEqual(queued[1].payload.token,verificationToken);
    const replacementVerification=queued[1].payload.token;
    assert.equal((await processOneAccountMail(pool,opts)).status,'delivered');
    assert.equal(sent,2);
    assert.equal((await request('/api/v1/auth/verify',{token:replacementVerification})).status,200);
    assert.equal((await request('/api/v1/auth/verify',{token:replacementVerification})).status,400);
    assert.equal((await request('/api/v1/auth/verify',{token:verificationToken})).status,400,
      'a different link cannot activate an already verified account again');
    assert.equal((await request('/api/v1/auth/login',{email,password})).status,200);
    const resetA=await request('/api/v1/auth/request-reset',{email});
    const resetB=await request('/api/v1/auth/request-reset',{email});
    assert.equal(resetA.status,200);
    assert.equal(resetB.status,200);
    assert.equal(Object.hasOwn(resetA.data,'testResetToken'),false);
    assert.equal(Object.hasOwn(resetB.data,'testResetToken'),false);
    queued=await messages(pool,accountId);
    assert.equal(queued.length,4);
    const resets=queued.filter(row=>row.purpose==='reset');
    assert.equal(resets.length,2);
    assert.notEqual(resets[0].payload.token,resets[1].payload.token);
    assert.equal((await processOneAccountMail(pool,opts)).status,'revoked',
      'old reset cannot reach provider after newer reset was issued');
    assert.equal(sent,2);
    assert.equal((await processOneAccountMail(pool,opts)).status,'delivered');
    assert.equal(sent,3);
    assert.equal((await request('/api/v1/auth/confirm-reset',{
      token:resets[0].payload.token,
      password:'changed strong password for CI only 2026'})).status,400);
    assert.equal((await request('/api/v1/auth/confirm-reset',{
      token:resets[1].payload.token,
      password:'changed strong password for CI only 2026'})).status,200);
    assert.equal((await processOneAccountMail(pool,opts)).status,'idle');
    // Fail closed: invalid outbox configuration must prevent server startup.
    assert.ok(!queued.some(row=>row.payload.token===password));
  }finally{
    child.kill('SIGTERM');
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});
