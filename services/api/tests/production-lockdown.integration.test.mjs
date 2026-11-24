import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import pg from 'pg';

// Harden the production boundary in a disposable PG18 CI instance.
// Do not connect this file to Railway or provide real account credentials.
const origin='http://127.0.0.1:43158';
const denies=[
  '/api/v1/auth/register','/api/v1/auth/verify',
  '/api/v1/auth/request-reset','/api/v1/auth/confirm-reset',
  '/api/v1/auth/login','/api/v1/auth/logout',
  '/api/v1/account/export',
  '/api/v1/expedition/start','/api/v1/expedition/claim','/api/v1/expedition/stop',
  '/api/v1/adventure/start','/api/v1/trainer/invest',
  '/api/v1/collection/team','/api/v1/gym/reserve',
  '/api/v1/gym/start','/api/v1/gym/turn',
  '/api/v1/gym/certify','/api/v1/gym/settle'
];
async function call(path,method='GET',originHeader=origin){
  const response=await fetch(origin+path,{
    method,redirect:'manual',
    headers:{Origin:originHeader,'Content-Type':'application/json',
      Cookie:'__Host-kanto_session='+('z'.repeat(43))},
    body:method==='POST'?JSON.stringify({
      email:'no-create-23d7@example.test',password:'never-written-123456789',
      trainerName:'Blocked Trainer',token:'z'.repeat(43),
      actionId:'blocked-prod-23d7-000001',expectedRevision:0,
      starterId:1,stat:'attack',teamUids:[1,2,3],
      gymReservationId:'00000000-0000-4000-8000-000000000001',
      action:{kind:'focus'}
    }):undefined
  });
  const data=await response.json();
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal(response.headers.get('x-frame-options'),'DENY');
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  assert.equal(response.headers.get('access-control-allow-origin'),null);
  assert.equal(response.headers.get('set-cookie'),null,
    'disabled operations cannot return or clear real session cookies');
  return {status:response.status,data};
}
test('23D7: production flag never enables public accounts, email actions or game writers',async()=>{
  assert.ok(process.env.DATABASE_URL,'Disposable PostgreSQL CI required');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  const before=await pool.query(`SELECT
    (SELECT count(*)::int FROM game_accounts) AS accounts,
    (SELECT count(*)::int FROM game_saves) AS saves,
    (SELECT count(*)::int FROM game_account_mail_outbox) AS outbox,
    (SELECT count(*)::int FROM game_auth_sessions) AS sessions`);
  const child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,PORT:'43158',NODE_ENV:'production',
      ONLINE_REGISTRATION_ENABLED:'true',ACCOUNT_MAIL_MODE:'off',
      ONLINE_SIGNED_QUOTA_MODE:'reviewed',ONLINE_GATEWAY_RECEIVER_ACTIVE_HEX:'11'.repeat(32)},
    stdio:'ignore'
  });
  try{
    let ready=false;
    for(let attempt=0;attempt<120;attempt++){
      try{if((await call('/health')).status===200){ready=true;break;}}catch{}
      if(child.exitCode!==null)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.equal(ready,true,'production-mode API must start');
    const status=await call('/api/v1/status');
    assert.equal(status.status,200);
    assert.equal(status.data.registrationEnabled,false);
    assert.equal(status.data.savesEnabled,false);
    for(const path of denies){
      const result=await call(path,'POST');
      assert.equal(result.status,503,path+' must fail closed');
      assert.ok(!JSON.stringify(result.data).includes('token'),
        'denied response cannot reveal account tokens');
    }
    for(const path of ['/api/v1/auth/register','/api/v1/auth/login',
      '/api/v1/gym/turn']){
      assert.equal((await call(path,'POST','https://attacker.example')).status,
        503,'bad Origin cannot bypass production lock: '+path);
    }
    assert.equal((await call('/api/v1/expedition/current')).status,503);
    assert.equal((await call('/api/v1/me')).status,401,
      'unknown session must not expose account identity');
    assert.equal((await call('/api/v1/save')).status,401,
      'unknown session must not expose a save');
    const after=await pool.query(`SELECT
      (SELECT count(*)::int FROM game_accounts) AS accounts,
      (SELECT count(*)::int FROM game_saves) AS saves,
      (SELECT count(*)::int FROM game_account_mail_outbox) AS outbox,
      (SELECT count(*)::int FROM game_auth_sessions) AS sessions`);
    assert.deepEqual(after.rows[0],before.rows[0],
      'production-denied requests must create no accounts, sessions, saves or email');
  }finally{
    child.kill('SIGTERM');
    await pool.end();
  }
});
