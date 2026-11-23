import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import pg from 'pg';

const origin='http://127.0.0.1:43142';
const email='online01b-ci-'+process.pid+'@example.test';
async function json(base,pathname,method='GET',body,headers={}){
  const result=await fetch(base+pathname,{method,redirect:'manual',
    headers:{...(body?{'Content-Type':'application/json','Origin':origin}:{}),
      ...headers},
    body:body?JSON.stringify(body):undefined
  });
  return {status:result.status,headers:result.headers,data:await result.json()};
}

test('ONLINE-01B: signup/login/session and save isolated from legacy client',async()=>{
  assert.ok(process.env.DATABASE_URL,'Somente no PostgreSQL descartável de CI');
  const child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,PORT:'43142',APP_ORIGIN:origin,
      ONLINE_REGISTRATION_ENABLED:'true',NODE_ENV:'test'},
    stdio:['ignore','pipe','pipe']
  });
  let stderr='';
  child.stderr.on('data',chunk=>{stderr+=chunk.toString()});
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  try{
    let ready=false;
    for(let i=0;i<80;i++){
      try{if((await json(origin,'/health')).status===200){ready=true;break;}}
      catch{}
      await new Promise(done=>setTimeout(done,100));
    }
    assert.equal(ready,true,'API deve iniciar com schema aplicado: '+stderr);
    const status=await json(origin,'/api/v1/status');
    assert.equal(status.status,200);
    assert.equal(status.data.registrationEnabled,true);
    assert.equal(status.data.savesEnabled,false);
    assert.equal((await json(origin,'/api/v1/me')).status,401);
    const user={email,password:'strong passphrase 12+ symbols ! 2026',
      trainerName:'Treinador CI'};
    assert.equal((await json(origin,'/api/v1/auth/register','POST',user,
      {Origin:'https://example.org'})).status,400,'CSRF origin');
    const register=await json(origin,'/api/v1/auth/register','POST',user);
    assert.equal(register.status,201);
    assert.ok(register.data.id);
    assert.equal(register.data.trainerName,user.trainerName);
    assert.match(register.data.verificationToken,/^[A-Za-z0-9_-]{43}$/);
    const unverified=await json(origin,'/api/v1/auth/login','POST',
      {email,password:user.password});
    assert.equal(unverified.status,403,'login antes de verificar e-mail deve ser negado');
    const verification=await json(origin,'/api/v1/auth/verify','POST',
      {token:register.data.verificationToken});
    assert.equal(verification.status,200);
    const replayVerification=await json(origin,'/api/v1/auth/verify','POST',
      {token:register.data.verificationToken});
    assert.equal(replayVerification.status,400,'token deve ser uso único');
    assert.equal((await json(origin,'/api/v1/auth/register','POST',user)).status,
      409,'email único');
    const denied=await json(origin,'/api/v1/auth/login','POST',
      {email,password:'invalid password'});
    assert.equal(denied.status,401);
    const login=await json(origin,'/api/v1/auth/login','POST',
      {email,password:user.password});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie');
    assert.ok(cookie?.includes('HttpOnly'));
    assert.ok(cookie?.includes('SameSite=Lax'));
    assert.ok(!cookie?.includes('password'));
    const sessionCookie=cookie.split(';')[0];
    const me=await json(origin,'/api/v1/me','GET',undefined,
      {Cookie:sessionCookie});
    assert.equal(me.status,200);
    assert.equal(me.data.trainerName,user.trainerName);
    assert.equal((await json(origin,'/api/v1/save','GET',undefined,
      {Cookie:sessionCookie})).status,404,'new account has no imported progress');
    assert.equal((await json(origin,'/api/v1/adventure/start','POST',
      {starterId:25},{Cookie:sessionCookie})).status,400,
      'only the three approved Kanto starters are allowed');
    assert.equal((await json(origin,'/api/v1/adventure/start','POST',
      {starterId:4,coins:100000,badges:['boulder']},
      {Cookie:sessionCookie})).status,400,
      'client may never send rewards or state in the first-save request');
    const started=await json(origin,'/api/v1/adventure/start','POST',
      {starterId:4},{Cookie:sessionCookie});
    assert.equal(started.status,201);
    assert.deepEqual(started.data,{created:true,revision:0,starterId:4});
    assert.equal((await json(origin,'/api/v1/adventure/start','POST',
      {starterId:1},{Cookie:sessionCookie})).status,409,
      'duplicate and concurrent starts may not mint another initial reward');
    const serverSave=await json(origin,'/api/v1/save','GET',undefined,
      {Cookie:sessionCookie});
    assert.equal(serverSave.status,200);
    assert.equal(serverSave.data.schema_version,2);
    assert.equal(Number(serverSave.data.revision),0);
    const initial=JSON.parse(serverSave.data.state.journal.raw);
    assert.equal(initial.name,user.trainerName);
    assert.equal(initial.coins,0);
    assert.equal(initial.roster[0].pokemonId,4);
    assert.equal(initial.roster[0].level,1);
    assert.equal(initial.roster[0].affinity,0);
    assert.deepEqual(initial.badges,[]);
    assert.equal(initial.ballPocket.quantities['poke-ball'],12);

    assert.equal((await json(origin,'/api/v1/save','PUT',
      {coins:999999,badges:['boulder']},{Cookie:sessionCookie})).status,404,
      'clients cannot post arbitrary saves/rewards');
    const proof=await pool.query(
      'SELECT password_hash FROM game_accounts WHERE id=$1',[register.data.id]);
    assert.equal(proof.rowCount,1);
    assert.notEqual(proof.rows[0].password_hash,user.password);
    const saves=await pool.query('SELECT account_id FROM game_saves WHERE account_id=$1',
      [register.data.id]);
    assert.equal(saves.rowCount,1,'only the server-started adventure is persisted');
    const receipts=await pool.query(
      'SELECT action_id,kind FROM game_action_receipts WHERE account_id=$1',
      [register.data.id]);
    assert.deepEqual(receipts.rows,[{action_id:'adventure:create:v1',
      kind:'adventure-initialization'}]);
    // Two concurrent starts from the SAME authenticated account must commit
    // one save/receipt only. Different starter requests cannot overwrite it.
    const another={email:'concurrency-'+process.pid+'@example.test',
      password:'another unique strong password 2026',trainerName:'Corrida CI'};
    const created=await json(origin,'/api/v1/auth/register','POST',another);
    assert.equal(created.status,201);
    assert.equal((await json(origin,'/api/v1/auth/verify','POST',
      {token:created.data.verificationToken})).status,200);
    const otherLogin=await json(origin,'/api/v1/auth/login','POST',
      {email:another.email,password:another.password});
    const otherCookie=otherLogin.headers.get('set-cookie').split(';')[0];
    const outcomes=await Promise.all([1,7].map(starterId=>
      json(origin,'/api/v1/adventure/start','POST',{starterId},
        {Cookie:otherCookie})));
    assert.deepEqual(outcomes.map(o=>o.status).sort(),[201,409]);
    const parallelRows=await pool.query(
      'SELECT state FROM game_saves WHERE account_id=$1',[created.data.id]);
    assert.equal(parallelRows.rowCount,1);
    assert.ok([1,7].includes(JSON.parse(parallelRows.rows[0].state.journal.raw)
      .roster[0].pokemonId));
    const parallelReceipt=await pool.query(
      'SELECT count(*)::int AS total FROM game_action_receipts WHERE account_id=$1',
      [created.data.id]);
    assert.equal(parallelReceipt.rows[0].total,1);

    const sessions=await pool.query(
      'SELECT octet_length(token_sha256) AS bytes FROM game_auth_sessions WHERE account_id=$1',
      [register.data.id]);
    assert.equal(sessions.rows[0].bytes,32);
    assert.equal((await json(origin,'/api/v1/auth/logout','POST',{},
      {Cookie:sessionCookie})).status,200);
    assert.equal((await json(origin,'/api/v1/me','GET',undefined,
      {Cookie:sessionCookie})).status,401);
    const preResetLogin=await json(origin,'/api/v1/auth/login','POST',
      {email,password:user.password});
    assert.equal(preResetLogin.status,200);
    const preResetCookie=preResetLogin.headers.get('set-cookie').split(';')[0];
    const requestReset=await json(origin,'/api/v1/auth/request-reset','POST',
      {email});
    assert.equal(requestReset.status,200);
    assert.equal(requestReset.data.accepted,true);
    assert.match(requestReset.data.testResetToken,/^[A-Za-z0-9_-]{43}$/);
    const unknown=await json(origin,'/api/v1/auth/request-reset','POST',
      {email:'missing-'+process.pid+'@example.test'});
    assert.equal(unknown.status,200,'reset request must not reveal account existence');
    assert.equal(unknown.data.accepted,true);
    assert.equal(Object.hasOwn(unknown.data,'testResetToken'),false);
    const appliedReset=await json(origin,'/api/v1/auth/confirm-reset','POST',
      {token:requestReset.data.testResetToken,
        password:'new securely chosen password for CI 2026'});
    assert.equal(appliedReset.status,200);
    assert.equal((await json(origin,'/api/v1/auth/confirm-reset','POST',
      {token:requestReset.data.testResetToken,
        password:'another securely chosen password 2026'})).status,400,
      'reset must be single-use');
    assert.equal((await json(origin,'/api/v1/me','GET',undefined,
      {Cookie:preResetCookie})).status,401,'all old sessions revoked by reset');
    assert.equal((await json(origin,'/api/v1/auth/login','POST',
      {email,password:user.password})).status,401,'old password denied');
    assert.equal((await json(origin,'/api/v1/auth/login','POST',
      {email,password:'new securely chosen password for CI 2026'})).status,200);
    const migrations=await pool.query(
      'SELECT name FROM game_schema_migrations');
    assert.equal(migrations.rows.length,4,'all migrations applied exactly once');
    const verified=await pool.query(
      'SELECT email_verified_at FROM game_accounts WHERE id=$1',[register.data.id]);
    assert.ok(verified.rows[0].email_verified_at);
  }finally{
    child.kill('SIGTERM');
    await pool.end();
  }
});

test('rate limiting persists across requests and rejects repeated login attempts',async()=>{
  const base='http://127.0.0.1:43144';
  const child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,PORT:'43144',NODE_ENV:'test',
      ONLINE_REGISTRATION_ENABLED:'true'},
    stdio:'ignore'
  });
  try{
    let ready=false;
    for(let i=0;i<80;i++){
      try{if((await json(base,'/health')).status===200){ready=true;break;}}
      catch{}
      await new Promise(done=>setTimeout(done,70));
    }
    assert.equal(ready,true);
    const email='rate-ci-'+process.pid+'@example.test';
    const responses=[];
    for(let i=0;i<8;i++){
      const reply=await json(base,'/api/v1/auth/login','POST',
        {email,password:'invalid pass'});
      responses.push(reply.status);
    }
    assert.ok(responses.slice(0,6).every(code=>code===401));
    assert.ok(responses.slice(6).every(code=>code===429));
    const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
    try{
      const tracked=await pool.query(`SELECT scope,attempts
        FROM game_auth_throttles WHERE scope='login-email' ORDER BY attempts DESC LIMIT 1`);
      assert.ok(tracked.rowCount>0);
      assert.ok(tracked.rows[0].attempts>=8);
    }finally{await pool.end();}
  }finally{child.kill('SIGTERM');}
});

test('production stays registration-disabled even with the feature flag misconfigured',async()=>{
  const base='http://127.0.0.1:43143';
  const child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,PORT:'43143',NODE_ENV:'production',
      ONLINE_REGISTRATION_ENABLED:'true'},
    stdio:'ignore'
  });
  try{
    let status=null;
    for(let i=0;i<50;i++){
      try{
        const response=await fetch(base+'/api/v1/status');
        if(response.status===200){status=await response.json();break;}
      }catch{}
      await new Promise(done=>setTimeout(done,80));
    }
    assert.ok(status,'API process must start');
    assert.equal(status.registrationEnabled,false);
    const registration=await json(base,'/api/v1/auth/register','POST',{
      email:'should-never-register@example.test',
      trainerName:'Unsafe',
      password:'never-used-passphrase-123'
    });
    assert.equal(registration.status,503);
  }finally{child.kill('SIGTERM');}
});

test('ONLINE-01C-6 trainer investment is serialized, revision-bound and receipt-idempotent',async()=>{
  assert.ok(process.env.DATABASE_URL,'Only disposable CI PG');
  const base='http://127.0.0.1:43146';
  const child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,PORT:'43146',NODE_ENV:'test',
      ONLINE_REGISTRATION_ENABLED:'true'},
    stdio:'ignore'
  });
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  try{
    let ready=false;
    for(let i=0;i<80;i++){
      try{if((await json(base,'/health')).status===200){ready=true;break;}}
      catch{}
      await new Promise(done=>setTimeout(done,80));
    }
    assert.equal(ready,true);
    const user={email:'invest-'+process.pid+'@example.test',
      password:'trainer investment CI 2026 long passphrase',
      trainerName:'Progresso CI'};
    const reg=await json(base,'/api/v1/auth/register','POST',user);
    assert.equal(reg.status,201);
    assert.equal((await json(base,'/api/v1/auth/verify','POST',
      {token:reg.data.verificationToken})).status,200);
    const login=await json(base,'/api/v1/auth/login','POST',
      {email:user.email,password:user.password});
    const cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await json(base,'/api/v1/adventure/start','POST',
      {starterId:7},{Cookie:cookie})).status,201);
    const invest=(data,headers={})=>json(base,'/api/v1/trainer/invest',
      'POST',data,{Cookie:cookie,...headers});
    assert.equal((await invest({actionId:'invest-initial-0001',
      expectedRevision:0,stat:'hp'})).status,409,
      'level 1 must not have trainable points');
    assert.equal((await invest({actionId:'invest-invalid-0001',
      expectedRevision:0,stat:'coins'})).status,400);
    assert.equal((await invest({actionId:'invest-extra-0001',
      expectedRevision:0,stat:'hp',coins:999})).status,400);
    assert.equal((await invest({actionId:'invest-origin-0001',
      expectedRevision:0,stat:'hp'}, {Origin:'https://bad.test'})).status,400);
    // Only a CI-side fixture adds level; there is no level-grant HTTP route.
    const saved=await pool.query(
      'SELECT state FROM game_saves WHERE account_id=$1',[reg.data.id]);
    const fixture= saved.rows[0].state;
    const trainer=JSON.parse(fixture.journal.raw);
    trainer.trainer.level=2;
    fixture.journal.raw=JSON.stringify(trainer);
    await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',
      [reg.data.id,JSON.stringify(fixture)]);
    const outcomes=await Promise.all([
      invest({actionId:'invest-concurrent-0001',expectedRevision:0,stat:'hp'}),
      invest({actionId:'invest-concurrent-0002',expectedRevision:0,stat:'attack'})
    ]);
    assert.deepEqual(outcomes.map(v=>v.status).sort(),[200,409]);
    const accepted=outcomes.find(v=>v.status===200);
    assert.equal(accepted.data.revision,1);
    assert.equal((await invest({actionId:'invest-concurrent-0001',
      expectedRevision:0,stat:'hp'})).status,409,
      'receipt and revision must block replay');
    const second=await invest({actionId:'invest-followup-0003',
      expectedRevision:1,stat:'speed'});
    assert.equal(second.status,200);
    assert.equal(second.data.revision,2);
    assert.equal((await invest({actionId:'invest-overbudget-0004',
      expectedRevision:2,stat:'defense'})).status,409);
    const finalSave=await json(base,'/api/v1/save','GET',undefined,
      {Cookie:cookie});
    assert.equal(Number(finalSave.data.revision),2);
    assert.equal(finalSave.data.state.journal.revision,2);
    const state=JSON.parse(finalSave.data.state.journal.raw);
    assert.equal(state.trainer.level,2);
    const points=Object.values(state.trainer.manual).reduce((a,b)=>a+b,0);
    assert.equal(points,2);
    assert.equal(state.coins,0);
    assert.deepEqual(state.badges,[]);
    const receipts=await pool.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 ORDER BY save_revision',
      [reg.data.id]);
    assert.equal(receipts.rowCount,3);
    assert.deepEqual(receipts.rows.map(row=>row.kind),
      ['adventure-initialization','trainer-invest','trainer-invest']);
  }finally{child.kill('SIGTERM');await pool.end();}
});
