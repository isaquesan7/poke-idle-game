import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import pg from 'pg';

// Uses only disposable CI PostgreSQL. No live accounts, mail or Railway.
const origin='http://127.0.0.1:43159';
async function request(path,{method='GET',body,cookie,requestOrigin=origin}={}){
  const response=await fetch(origin+path,{method,redirect:'manual',
    headers:{Origin:requestOrigin,'Content-Type':'application/json',
      ...(cookie?{Cookie:cookie}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,headers:response.headers,
    data:await response.json()};
}
test('23E2: reauthenticated owner-only HTTP export, no secrets or cross-account data',async()=>{
  assert.ok(process.env.DATABASE_URL,'Disposable PostgreSQL required');
  const child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,PORT:'43159',APP_ORIGIN:origin,NODE_ENV:'test',
      ONLINE_REGISTRATION_ENABLED:'true',ACCOUNT_MAIL_MODE:'off'},
    stdio:'ignore'
  });
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  const accounts=[];
  try{
    let ready=false;
    for(let i=0;i<120;i++){
      try{if((await request('/health')).status===200){ready=true;break;}}catch{}
      if(child.exitCode!==null)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.equal(ready,true);
    const password='Strong password for privacy test 23E2';
    const signup=async(label)=>{
      const email='export-'+label+'-'+process.pid+'@example.test';
      const created=await request('/api/v1/auth/register',{
        method:'POST',body:{email,password,trainerName:label}});
      assert.equal(created.status,201);
      accounts.push(created.data.id);
      assert.equal((await request('/api/v1/auth/verify',{method:'POST',
        body:{token:created.data.verificationToken}})).status,200);
      const logged=await request('/api/v1/auth/login',{method:'POST',
        body:{email,password}});
      assert.equal(logged.status,200);
      return {id:created.data.id,cookie:logged.headers.get('set-cookie').split(';')[0]};
    };
    const alice=await signup('Alice');
    const bob=await signup('Bruno');
    assert.equal((await request('/api/v1/adventure/start',{method:'POST',
      cookie:alice.cookie,body:{starterId:1}})).status,201);
    assert.equal((await request('/api/v1/adventure/start',{method:'POST',
      cookie:bob.cookie,body:{starterId:7}})).status,201);
    const withoutCookie=await request('/api/v1/account/export',{
      method:'POST',body:{password}});
    assert.equal(withoutCookie.status,401);
    const rejectedCsrf=await request('/api/v1/account/export',{
      method:'POST',body:{password},cookie:alice.cookie,
      requestOrigin:'https://attacker.example'});
    assert.equal(rejectedCsrf.status,400);
    const badPassword=await request('/api/v1/account/export',{
      method:'POST',body:{password:'incorrect password'},
      cookie:alice.cookie});
    assert.equal(badPassword.status,401);
    const aliceExport=await request('/api/v1/account/export',{
      method:'POST',body:{password},cookie:alice.cookie});
    assert.equal(aliceExport.status,200);
    assert.equal(aliceExport.data.account.id,alice.id);
    assert.equal(aliceExport.data.profile.trainerName,'Alice');
    assert.equal(aliceExport.headers.get('cache-control'),'no-store');
    assert.equal(aliceExport.headers.get('access-control-allow-origin'),null);
    assert.match(aliceExport.headers.get('content-disposition'),/attachment/);
    const serialized=JSON.stringify(aliceExport.data);
    for(const forbidden of [bob.id,'Bruno','password_hash','token_sha256',
      'encrypted_payload','__Host-kanto_session','verificationToken']){
      assert.ok(!serialized.includes(forbidden),'export must exclude '+forbidden);
    }
    const bobExport=await request('/api/v1/account/export',{
      method:'POST',body:{password},cookie:bob.cookie});
    assert.equal(bobExport.status,200);
    assert.equal(bobExport.data.account.id,bob.id);
    assert.ok(!JSON.stringify(bobExport.data).includes(alice.id));
    const throttled=await request('/api/v1/account/export',{
      method:'POST',body:{password},cookie:alice.cookie});
    assert.equal(throttled.status,200,'third try within quota');
    assert.equal((await request('/api/v1/account/export',{method:'POST',
      body:{password},cookie:alice.cookie})).status,429);
    assert.equal((await request('/api/v1/account/export',{method:'POST',
      body:{password,accountId:bob.id},cookie:bob.cookie})).status,400,
      'client cannot select owner ID');
  }finally{
    child.kill('SIGTERM');
    if(accounts.length)await pool.query('DELETE FROM game_accounts WHERE id = ANY($1::uuid[])',
      [accounts]);
    await pool.end();
  }
});
