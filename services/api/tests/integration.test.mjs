import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
async function stopChild(child){if(child&&child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}}
import pg from 'pg';

const origin='http://127.0.0.1:23142';
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
    env:{...process.env,PORT:'23142',APP_ORIGIN:origin,
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
      if(child.exitCode!==null)break;
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
    assert.ok(cookie?.includes('Secure'),'__Host- cookie must be Secure even in CI');
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
    assert.equal((await json(origin,'/api/v1/gym/reserve','POST',{
      actionId:'gym-http-unauthorized-0001',expectedRevision:0
    })).status,401,'Gym reserve requires an authenticated server session');
    assert.equal((await json(origin,'/api/v1/gym/turn','POST',{
      actionId:'gym-unauthorized-first-turn-0001',expectedRevision:0,
      gymReservationId:'00000000-0000-4000-8000-000000000001',
      action:{kind:'basic'}
    })).status,401,'Gym turn requires a verified authenticated account');
    for(const endpoint of ['certify','settle']){
      const path='/api/v1/gym/'+endpoint;
      const args={actionId:'gym-http-unauthorized-final-0001',expectedRevision:0,
        gymReservationId:'00000000-0000-4000-8000-000000000001'};
      assert.equal((await json(origin,path,'POST',args)).status,401,
        'final Gym actions require a session');
      assert.equal((await json(origin,path,'POST',{
        ...args,seed:123,accountId:'00000000-0000-4000-8000-000000000001'
      },{Cookie:sessionCookie})).status,400,
        'final Gym actions reject forged account and seed');
      assert.equal((await json(origin,path,'POST',args,{
        Cookie:sessionCookie,Origin:'https://attacker.example'
      })).status,400,'final Gym actions reject cross-site Origin');
    }
    assert.equal((await json(origin,'/api/v1/gym/turn','POST',{
      actionId:'gym-browser-seed-attack-0001',expectedRevision:0,
      gymReservationId:'00000000-0000-4000-8000-000000000001',
      action:{kind:'basic'},entropyKey:'attacker-owned',seed:999
    },{Cookie:sessionCookie})).status,400,
    'Gym turn rejects all browser-controlled entropy and secrets');
    assert.equal((await json(origin,'/api/v1/gym/turn','POST',{
      actionId:'gym-cross-site-turn-0001',expectedRevision:0,
      gymReservationId:'00000000-0000-4000-8000-000000000001',
      action:{kind:'basic'}
    },{Cookie:sessionCookie,Origin:'https://attacker.example'})).status,400,
    'Gym turn requires the exact expected Origin');
    assert.equal((await json(origin,'/api/v1/gym/reserve','POST',{
      actionId:'gym-http-other-user-0001',expectedRevision:0,
      accountId:'00000000-0000-4000-8000-000000000001'
    },{Cookie:sessionCookie})).status,400,
    'browser cannot choose the account or inject other Gym commands');
    assert.equal((await json(origin,'/api/v1/gym/start','POST',{
      gymReservationId:'00000000-0000-4000-8000-000000000001',
      expectedRevision:0,seed:123
    },{Cookie:sessionCookie})).status,400,
    'browser seed and extra fields are rejected');
    assert.equal((await json(origin,'/api/v1/gym/reserve','POST',{
      actionId:'gym-http-csrf-0001',expectedRevision:0
    },{Cookie:sessionCookie,Origin:'https://attacker.example'})).status,400,
    'cross-site Gym commands are blocked');
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
    const teamArgs={actionId:'http-collection-team-first-0001',
      expectedRevision:0,teamUids:[1]};
    assert.equal((await json(origin,'/api/v1/collection/team','POST',
      teamArgs)).status,401,'Collection writes require a session');
    assert.equal((await json(origin,'/api/v1/collection/team','POST',
      {...teamArgs,accountId:register.data.id},
      {Cookie:sessionCookie})).status,400,
      'browser cannot supply its own accountId');
    assert.equal((await json(origin,'/api/v1/collection/team','POST',
      {...teamArgs,seed:88},
      {Cookie:sessionCookie})).status,400,
      'browser cannot supply seeds or extra fields to Collection');
    assert.equal((await json(origin,'/api/v1/collection/team','POST',
      teamArgs,{Cookie:sessionCookie,Origin:'https://attacker.example'})).status,
      400,'Collection team writes reject cross-site request origin');
    assert.equal((await json(origin,'/api/v1/collection/team','POST',
      {...teamArgs,teamUids:[1,2,3]},
      {Cookie:sessionCookie})).status,409,
      'Collection team UIDs must be truly owned by the server account');
    const teamSet=await json(origin,'/api/v1/collection/team','POST',
      teamArgs,{Cookie:sessionCookie});
    assert.equal(teamSet.status,200);
    assert.equal(teamSet.data.status,'set');
    assert.deepEqual(teamSet.data.teamUids,[1]);
    assert.equal(teamSet.data.revision,1);
    const teamReplay=await json(origin,'/api/v1/collection/team','POST',
      {...teamArgs,expectedRevision:0},{Cookie:sessionCookie});
    assert.equal(teamReplay.status,200);
    assert.equal(teamReplay.data.status,'replay');
    assert.deepEqual(teamReplay.data.teamUids,[1]);
    const teamStored=await pool.query(
      'SELECT state FROM game_saves WHERE account_id=$1',[register.data.id]);
    assert.deepEqual(JSON.parse(teamStored.rows[0].state.journal.raw).team,[1]);

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
    assert.equal(migrations.rows.length,25,'all migrations applied exactly once');
    const verified=await pool.query(
      'SELECT email_verified_at FROM game_accounts WHERE id=$1',[register.data.id]);
    assert.ok(verified.rows[0].email_verified_at);
  }finally{
    await stopChild(child);
    await pool.end();
  }
});

test('rate limiting persists across requests and rejects repeated login attempts',async()=>{
  const base='http://127.0.0.1:23144';
  const child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,PORT:'23144',NODE_ENV:'test',APP_ORIGIN:origin,
      ONLINE_REGISTRATION_ENABLED:'true'},
    stdio:'ignore'
  });
  try{
    let ready=false;
    for(let i=0;i<160;i++){
      try{if((await json(base,'/health')).status===200){ready=true;break;}}
      catch{}
      if(child.exitCode!==null)break;
      await new Promise(done=>setTimeout(done,100));
    }
    assert.equal(ready,true,'throttle test server did not start in CI');
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
  }finally{await stopChild(child);}
});

test('production stays registration-disabled even with the feature flag misconfigured',async()=>{
  const base='http://127.0.0.1:23143';
  const child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,PORT:'23143',NODE_ENV:'production',
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
    assert.equal((await json(base,'/api/v1/gym/reserve','POST',{
      actionId:'gym-test-disabled-prod-0001',expectedRevision:0
    })).status,503,'production cannot reserve Gyms while beta gated');
    assert.equal((await json(base,'/api/v1/gym/start','POST',{
      gymReservationId:'00000000-0000-4000-8000-000000000001',
      expectedRevision:0
    })).status,503,'production cannot start Gyms while beta gated');
    assert.equal((await json(base,'/api/v1/gym/turn','POST',{
      actionId:'gym-prod-turn-denied-0001',expectedRevision:0,
      gymReservationId:'00000000-0000-4000-8000-000000000001',
      action:{kind:'basic'}
    })).status,503,'production cannot execute Gym turns during CI-only stage');
    for(const endpoint of ['certify','settle']){
      assert.equal((await json(base,'/api/v1/gym/'+endpoint,'POST',{
        actionId:'gym-prod-final-denied-0001',expectedRevision:0,
        gymReservationId:'00000000-0000-4000-8000-000000000001'
      })).status,503,'production must deny all Gym terminal writes');
    }
    assert.equal((await json(base,'/api/v1/collection/team','POST',{
      actionId:'collection-prod-forbidden-0001',expectedRevision:0,
      teamUids:[1]
    })).status,503,'production must deny Collection writes while beta is gated');
  }finally{await stopChild(child);}
});

test('ONLINE-01C-6 trainer investment is serialized, revision-bound and receipt-idempotent',async()=>{
  assert.ok(process.env.DATABASE_URL,'Only disposable CI PG');
  const base='http://127.0.0.1:23146';
  const child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,PORT:'23146',NODE_ENV:'test',APP_ORIGIN:origin,
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
  }finally{await stopChild(child);await pool.end();}
});

test('ONLINE-01C-8: an encounter reservation is durable, idempotent, one at a time and reward-free',async()=>{
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  const email='encounter-'+process.pid+'@example.test';
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      [email,'x'.repeat(48)]);
    accountId=account.rows[0].id;
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(firstSave('CI Kanto',1,1740000000000))]);
    const params={accountId,actionId:'encounter-reserve-ci-0001',
      expectedRevision:0,regionId:1};
    assert.equal((await reserveEncounter(pool,{...params,regionId:10})).status,'invalid',
      'region eligibility requires separate server policy before unlocking');
    assert.equal((await reserveEncounter(pool,{...params,actionId:'x'})).status,'invalid');
    const result=await Promise.all([
      reserveEncounter(pool,params),
      reserveEncounter(pool,{...params,actionId:'encounter-reserve-ci-0002'})
    ]);
    assert.deepEqual(result.map(x=>x.status).sort(),['reserved','stale']);
    const winner=result.find(x=>x.status==='reserved');
    assert.match(winner.encounterId,/^[0-9a-f-]{36}$/);
    const used=result[0].status==='reserved'?params.actionId:'encounter-reserve-ci-0002';
    const replay=await reserveEncounter(pool,{...params,actionId:used,expectedRevision:0});
    assert.equal(replay.status,'replay');
    assert.equal(replay.encounterId,winner.encounterId);
    assert.equal(replay.revision,1);
    assert.equal((await reserveEncounter(pool,{...params,actionId:'encounter-reserve-ci-0003',
      expectedRevision:0})).status,'stale');
    assert.equal((await reserveEncounter(pool,{...params,actionId:'encounter-reserve-ci-0004',
      expectedRevision:1})).status,'busy');
    const saved=await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',
      [accountId]);
    assert.equal(Number(saved.rows[0].revision),1);
    assert.equal(saved.rows[0].state.revision,1);
    assert.equal(saved.rows[0].state.journal.revision,1);
    const raw=JSON.parse(saved.rows[0].state.journal.raw);
    assert.equal(raw.coins,0);
    assert.equal(raw.trainer.xp,0);
    assert.equal(raw.roster[0].level,1);
    assert.deepEqual(raw.badges,[]);
    assert.equal(raw.ballPocket.quantities['poke-ball'],12);
    const encounters=await pool.query(
      'SELECT id,status,region_id FROM game_encounter_reservations WHERE account_id=$1',
      [accountId]);
    assert.equal(encounters.rowCount,1);
    assert.equal(encounters.rows[0].id,winner.encounterId);
    assert.equal(encounters.rows[0].status,'reserved');
    const receipts=await pool.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1',[accountId]);
    assert.deepEqual(receipts.rows,[{kind:'encounter-reserve',save_revision:'1'}]);
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});

test('ONLINE-01C-9: one materialized encounter survives retries and worker races without grants',async()=>{
 const {firstSave}=await import('../src/initialAdventure.mjs');
 const {reserveEncounter}=await import('../src/encounterReservation.mjs');
 const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
 const {FIRST_REGION_SPECIES}=await import('../src/encounterMaterialization.mjs');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 let accountId;
 try{
  const account=await pool.query(
    'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
    ['materialize-'+process.pid+'@example.test','x'.repeat(48)]);
  accountId=account.rows[0].id;
  await pool.query(
    'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
    [accountId,JSON.stringify(firstSave('CI Kanto',4,1740000000000))]);
  const action={accountId,actionId:'materialize-ci-action-0001',expectedRevision:0,regionId:1};
  const reserved=await reserveEncounter(pool,action);
  assert.equal(reserved.status,'reserved');
  assert.equal((await materializeReservedEncounter(pool,{accountId,encounterId:reserved.encounterId,
    entropyKey:Buffer.alloc(16)})).status,'invalid');
  const params={accountId,encounterId:reserved.encounterId,entropyKey:Buffer.alloc(32,0x71)};
  const race=await Promise.all([
    materializeReservedEncounter(pool,params),
    materializeReservedEncounter(pool,params)
  ]);
  assert.deepEqual(race.map(r=>r.status).sort(),['materialized','replay']);
  const first=race.find(r=>r.status==='materialized');
  assert.ok(FIRST_REGION_SPECIES.includes(first.speciesId));
  assert.ok(first.level>=2&&first.level<=10);
  const restarted=await materializeReservedEncounter(pool,{
    ...params,entropyKey:Buffer.alloc(32,0x82)});
  assert.equal(restarted.status,'replay',
    'new process or key rotation reads persisted encounter instead of rerolling');
  assert.deepEqual([restarted.speciesId,restarted.level],
    [first.speciesId,first.level]);
  const result=await pool.query(
    'SELECT status,species_id,pokemon_level,entropy_version,materialized_at FROM game_encounter_reservations WHERE id=$1',
    [reserved.encounterId]);
  assert.equal(result.rows[0].status,'reserved');
  assert.equal(Number(result.rows[0].species_id),first.speciesId);
  await assert.rejects(pool.query(
    'UPDATE game_encounter_reservations SET pokemon_level=NULL WHERE id=$1',
    [reserved.encounterId]),
    error=>error.code==='23514','partial materialization must violate CHECK');

  assert.ok(result.rows[0].materialized_at);
  const save=await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',
    [accountId]);
  assert.equal(Number(save.rows[0].revision),1);
  const raw=JSON.parse(save.rows[0].state.journal.raw);
  assert.equal(raw.coins,0);
  assert.equal(raw.trainer.xp,0);
  assert.equal(raw.roster[0].pokemonId,4);
  assert.deepEqual(raw.badges,[]);
  assert.equal(raw.ballPocket.quantities['poke-ball'],12);
  const receipts=await pool.query(
    'SELECT kind FROM game_action_receipts WHERE account_id=$1',
    [accountId]);
  assert.deepEqual(receipts.rows.map(x=>x.kind),['encounter-reserve']);
  assert.equal((await reserveEncounter(pool,{...action,actionId:'materialize-ci-action-0002',
    expectedRevision:1})).status,'busy');
 }finally{
  if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
  await pool.end();
 }
});

test('ONLINE-01C-10: atomic battle preparation freezes participants under worker races',async()=>{
 const {firstSave}=await import('../src/initialAdventure.mjs');
 const {reserveEncounter}=await import('../src/encounterReservation.mjs');
 const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
 const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 let accountId;
 try{
   const account=await pool.query(
     'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
     ['prepare-battle-'+process.pid+'@example.test','x'.repeat(48)]);
   accountId=account.rows[0].id;
   await pool.query(
     'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
     [accountId,JSON.stringify(firstSave('Preparação CI',7,1740000000000))]);
   const action={accountId,actionId:'prepare-battle-action-0001',expectedRevision:0,regionId:1};
   const booked=await reserveEncounter(pool,action);
   assert.equal(booked.status,'reserved');
   const input={accountId,encounterId:booked.encounterId};
   assert.equal((await prepareReservedBattle(pool,input)).status,'unavailable',
     'cannot prepare before materialization');
   const materialized=await materializeReservedEncounter(pool,{
     ...input,entropyKey:Buffer.alloc(32,0x38)});
   assert.equal(materialized.status,'materialized');
   const attempts=await Promise.all([
     prepareReservedBattle(pool,input),
     prepareReservedBattle(pool,input)
   ]);
   assert.deepEqual(attempts.map(x=>x.status).sort(),['prepared','replay']);
   assert.deepEqual(attempts[0].snapshot,attempts[1].snapshot);
   const original=attempts[0].snapshot;
   assert.equal(original.opponent.speciesId,materialized.speciesId);
   assert.equal(original.opponent.level,materialized.level);
   assert.equal(original.activePokemon.speciesId,7);
   assert.equal(original.activePokemon.level,1);
   const result=await pool.query(
     'SELECT battle_snapshot,battle_prepared_at FROM game_encounter_reservations WHERE id=$1',
     [booked.encounterId]);
   assert.ok(result.rows[0].battle_prepared_at);
   assert.deepEqual(result.rows[0].battle_snapshot,original);
   await assert.rejects(pool.query(
     'UPDATE game_encounter_reservations SET battle_prepared_at=NULL WHERE id=$1',
     [booked.encounterId]),error=>error.code==='23514');
   // A later trainer change does not mutate a frozen battle already prepared.
   const saved=await pool.query(
     'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
   const state=saved.rows[0].state;
   const raw=JSON.parse(state.journal.raw);
   raw.trainer.level=2;
   state.journal.raw=JSON.stringify(raw);
   await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',
     [accountId,JSON.stringify(state)]);
   const replay=await prepareReservedBattle(pool,input);
   assert.equal(replay.status,'replay');
   assert.deepEqual(replay.snapshot,original);
   const proof=await pool.query(
     'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
   assert.equal(Number(proof.rows[0].revision),1);
   const updated=JSON.parse(proof.rows[0].state.journal.raw);
   assert.equal(updated.coins,0);
   assert.deepEqual(updated.badges,[]);
   assert.equal(updated.ballPocket.quantities['poke-ball'],12);
   const receipt=await pool.query(
     'SELECT kind FROM game_action_receipts WHERE account_id=$1',[accountId]);
   assert.deepEqual(receipt.rows.map(r=>r.kind),['encounter-reserve']);
 }finally{
   if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
   await pool.end();
 }
});

test('ONLINE-01C-12 private canonical preview persists across races/key changes without rewards',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {previewReservedBattle}=await import('../src/battlePreview.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['canonical-preview-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(firstSave('Combate CI',4,1740000000000))]);
    const booked=await reserveEncounter(pool,{
      accountId,actionId:'canonical-preview-action-0001',
      expectedRevision:0,regionId:1});
    assert.equal(booked.status,'reserved');
    const ids={accountId,encounterId:booked.encounterId};
    const key=Buffer.alloc(32,0x49);
    assert.equal((await previewReservedBattle(pool,{...ids,entropyKey:key})).status,
      'unavailable','preview requires frozen battle preparation');
    assert.equal((await materializeReservedEncounter(pool,{
      ...ids,entropyKey:key})).status,'materialized');
    assert.equal((await previewReservedBattle(pool,{...ids,entropyKey:key})).status,
      'unavailable','preview must not start with only materialized species');
    assert.equal((await prepareReservedBattle(pool,ids)).status,'prepared');
    const outcomes=await Promise.all([
      previewReservedBattle(pool,{...ids,entropyKey:key}),
      previewReservedBattle(pool,{...ids,entropyKey:Buffer.alloc(32,0x17)})
    ]);
    assert.deepEqual(outcomes.map(x=>x.status).sort(),['previewed','replay']);
    const original=outcomes[0].preview;
    assert.deepEqual(original,outcomes[1].preview);
    assert.ok(['win','loss','draw'].includes(original.outcome));
    assert.equal(original.log.length,original.frames.length);
    assert.ok(original.turns>=1&&original.turns<=30);
    assert.ok(original.log.every(line=>
      !line.startsWith('Captura! ')&&
      !line.includes('Recompensas de combate recebidas')));
    assert.equal(Object.hasOwn(original,'captured'),false);
    assert.equal(Object.hasOwn(original,'affinityGain'),false);
    assert.equal(Object.hasOwn(original,'seed'),false);
    const restarted=await previewReservedBattle(pool,{
      ...ids,entropyKey:Buffer.alloc(32,0xf0)});
    assert.equal(restarted.status,'replay');
    assert.deepEqual(restarted.preview,original);
    const row=await pool.query(
      'SELECT status,battle_preview,battle_preview_at FROM game_encounter_reservations WHERE id=$1',
      [booked.encounterId]);
    assert.equal(row.rows[0].status,'reserved','no implicit battle resolution');
    assert.deepEqual(row.rows[0].battle_preview,original);
    assert.ok(row.rows[0].battle_preview_at);
    await assert.rejects(pool.query(
      'UPDATE game_encounter_reservations SET battle_preview_at=NULL WHERE id=$1',
      [booked.encounterId]),err=>err.code==='23514');
    const result=await pool.query(
      'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
    assert.equal(Number(result.rows[0].revision),1);
    const save=JSON.parse(result.rows[0].state.journal.raw);
    assert.equal(save.coins,0);
    assert.equal(save.trainer.xp,0);
    assert.equal(save.roster[0].pokemonId,4);
    assert.deepEqual(save.badges,[]);
    assert.equal(save.ballPocket.quantities['poke-ball'],12);
    const receipts=await pool.query(
      'SELECT kind FROM game_action_receipts WHERE account_id=$1',[accountId]);
    assert.deepEqual(receipts.rows.map(r=>r.kind),['encounter-reserve']);
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});

test('ONLINE-01C-13 battle seal is atomic, idempotent, immutable and reward-free',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {previewReservedBattle}=await import('../src/battlePreview.mjs');
  const {sealReservedBattle}=await import('../src/battleSeal.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['battle-seal-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    const first=firstSave('Battle CI',7,1740000000000);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(first)]);
    const booking=await reserveEncounter(pool,{accountId,
      actionId:'battle-seal-booking-0001',expectedRevision:0,regionId:1});
    assert.equal(booking.status,'reserved');
    const ids={accountId,encounterId:booking.encounterId};
    const params={...ids,actionId:'battle-seal-final-0001',expectedRevision:1};
    assert.equal((await sealReservedBattle(pool,{...params,actionId:'x'})).status,'invalid');
    assert.equal((await sealReservedBattle(pool,params)).status,'unavailable',
      'no result without materialization, frozen actors and preview');
    const entropyKey=Buffer.alloc(32,0x44);
    assert.equal((await materializeReservedEncounter(pool,{...ids,entropyKey})).status,
      'materialized');
    assert.equal((await prepareReservedBattle(pool,ids)).status,'prepared');
    assert.equal((await sealReservedBattle(pool,params)).status,'unavailable',
      'materialization and snapshot alone cannot seal an unknown outcome');
    const preview=await previewReservedBattle(pool,{...ids,entropyKey});
    assert.equal(preview.status,'previewed');
    assert.equal((await sealReservedBattle(pool,{...params,expectedRevision:0})).status,'stale');
    assert.equal((await sealReservedBattle(pool,{...params,actionId:'battle-seal-booking-0001'})).status,
      'duplicate-action','receipt IDs cannot be reused across kinds');
    const competing=await Promise.all([
      sealReservedBattle(pool,params),
      sealReservedBattle(pool,{...params,actionId:'battle-seal-final-0002'})
    ]);
    assert.deepEqual(competing.map(x=>x.status).sort(),['already-sealed','sealed']);
    const winner=competing.find(x=>x.status==='sealed');
    assert.equal(winner.outcome,preview.preview.outcome);
    assert.equal(winner.revision,2);
    const used=competing[0].status==='sealed'?
      'battle-seal-final-0001':'battle-seal-final-0002';
    const replay=await sealReservedBattle(pool,{...params,actionId:used,expectedRevision:1});
    assert.equal(replay.status,'replay');
    assert.equal(replay.revision,2);
    assert.equal(replay.outcome,winner.outcome);
    assert.equal((await sealReservedBattle(pool,{...params,
      actionId:'battle-seal-final-0003',expectedRevision:2})).status,
      'already-sealed');
    const rows=await pool.query(
      'SELECT status,battle_sealed_outcome,battle_seal_action_id,battle_seal_revision,battle_sealed_at FROM game_encounter_reservations WHERE id=$1',
      [booking.encounterId]);
    const persisted=rows.rows[0];
    assert.equal(persisted.status,'reserved','no new encounter before settlement');
    assert.equal(persisted.battle_sealed_outcome,winner.outcome);
    assert.equal(persisted.battle_seal_action_id,used);
    assert.equal(Number(persisted.battle_seal_revision),2);
    assert.ok(persisted.battle_sealed_at);
    await assert.rejects(pool.query(
      "UPDATE game_encounter_reservations SET battle_sealed_outcome='nope' WHERE id=$1",
      [booking.encounterId]),error=>error.code==='23514');
    await assert.rejects(pool.query(
      "UPDATE game_encounter_reservations SET status='completed' WHERE id=$1",
      [booking.encounterId]),error=>error.code==='23514');
    await assert.rejects(pool.query(
      "UPDATE game_encounter_reservations SET battle_preview=battle_preview - 'outcome' WHERE id=$1",
      [booking.encounterId]),error=>error.code==='23514',
      'a missing preview outcome must not pass a nullable SQL CHECK');
    const newBooking=await reserveEncounter(pool,{accountId,
      actionId:'battle-seal-booking-0002',expectedRevision:2,regionId:1});
    assert.equal(newBooking.status,'busy');
    const saved=await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',
      [accountId]);
    assert.equal(Number(saved.rows[0].revision),2);
    assert.equal(saved.rows[0].state.revision,2);
    assert.equal(saved.rows[0].state.journal.revision,2);
    assert.equal(saved.rows[0].state.journal.raw,first.journal.raw);
    const raw=JSON.parse(saved.rows[0].state.journal.raw);
    assert.equal(raw.coins,0);
    assert.equal(raw.trainer.xp,0);
    assert.equal(raw.roster[0].pokemonId,7);
    assert.deepEqual(raw.badges,[]);
    assert.equal(raw.ballPocket.quantities['poke-ball'],12);
    const receipts=await pool.query(
      'SELECT action_id,kind,save_revision FROM game_action_receipts WHERE account_id=$1 ORDER BY save_revision',
      [accountId]);
    assert.deepEqual(receipts.rows.map(x=>x.kind),
      ['encounter-reserve','battle-seal']);
    assert.deepEqual(receipts.rows.map(x=>Number(x.save_revision)),[1,2]);
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});

test('ONLINE-01C-14 reward quote is idempotent, server-bound and does not credit anything',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {previewReservedBattle}=await import('../src/battlePreview.mjs');
  const {sealReservedBattle}=await import('../src/battleSeal.mjs');
  const {quoteSealedBattleRewards}=await import('../src/battleRewardQuote.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['reward-quote-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    const first=firstSave('Reward CI',4,1740000000000);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(first)]);
    const reserve=await reserveEncounter(pool,{accountId,
      actionId:'reward-quote-book-0001',expectedRevision:0,regionId:1});
    assert.equal(reserve.status,'reserved');
    const identity={accountId,encounterId:reserve.encounterId};
    const entropyKey=Buffer.alloc(32,0x67);
    const args={...identity,entropyKey};
    assert.equal((await quoteSealedBattleRewards(pool,args)).status,'unavailable');
    assert.equal((await materializeReservedEncounter(pool,args)).status,'materialized');
    assert.equal((await prepareReservedBattle(pool,identity)).status,'prepared');
    assert.equal((await previewReservedBattle(pool,args)).status,'previewed');
    assert.equal((await quoteSealedBattleRewards(pool,args)).status,'unavailable',
      'no reward quote before a sealed result');
    assert.equal((await sealReservedBattle(pool,{...identity,
      actionId:'reward-quote-seal-0001',expectedRevision:1})).status,'sealed');
    const attempts=await Promise.all([
      quoteSealedBattleRewards(pool,args),
      quoteSealedBattleRewards(pool,{...identity,entropyKey:Buffer.alloc(32,0x28)})
    ]);
    assert.deepEqual(attempts.map(x=>x.status).sort(),['quoted','replay']);
    assert.deepEqual(attempts[0].quote,attempts[1].quote);
    const quote=attempts[0].quote;
    assert.equal(quote.version,1);
    assert.equal(quote.activeUid,1);
    assert.equal(quote.activeLevel,1);
    assert.equal(quote.regionId,1);
    assert.ok(quote.wildLevel>=2&&quote.wildLevel<=10);
    assert.equal(quote.progressFactorTenths,10);
    assert.equal(quote.outcome,
      (await pool.query('SELECT battle_sealed_outcome FROM game_encounter_reservations WHERE id=$1',
        [reserve.encounterId])).rows[0].battle_sealed_outcome);
    assert.ok(Number.isSafeInteger(quote.coins)&&quote.coins>=0);
    assert.ok(Number.isSafeInteger(quote.pokemonXp)&&quote.pokemonXp>=0);
    assert.equal(Object.hasOwn(quote,'capture'),false);
    assert.equal(Object.hasOwn(quote,'seed'),false);
    const replay=await quoteSealedBattleRewards(pool,{
      ...identity,entropyKey:Buffer.alloc(32,0x99)});
    assert.equal(replay.status,'replay');
    assert.deepEqual(replay.quote,quote);
    const row=await pool.query(
      'SELECT status,battle_reward_quote,battle_reward_quote_at FROM game_encounter_reservations WHERE id=$1',
      [reserve.encounterId]);
    assert.equal(row.rows[0].status,'reserved');
    assert.deepEqual(row.rows[0].battle_reward_quote,quote);
    assert.ok(row.rows[0].battle_reward_quote_at);
    await assert.rejects(pool.query(
      'UPDATE game_encounter_reservations SET battle_reward_quote_at=NULL WHERE id=$1',
      [reserve.encounterId]),error=>error.code==='23514');
    await assert.rejects(pool.query(
      "UPDATE game_encounter_reservations SET battle_reward_quote=battle_reward_quote - 'outcome' WHERE id=$1",
      [reserve.encounterId]),error=>error.code==='23514');
    const saved=await pool.query(
      'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
    assert.equal(Number(saved.rows[0].revision),2);
    assert.equal(saved.rows[0].state.journal.raw,first.journal.raw);
    const raw=JSON.parse(saved.rows[0].state.journal.raw);
    assert.equal(raw.coins,0);
    assert.equal(raw.trainer.xp,0);
    assert.equal(raw.roster[0].xp,0);
    assert.equal(raw.roster[0].affinity,0);
    assert.deepEqual(raw.badges,[]);
    assert.equal(raw.ballPocket.quantities['poke-ball'],12);
    const receipts=await pool.query(
      'SELECT kind FROM game_action_receipts WHERE account_id=$1 ORDER BY save_revision',
      [accountId]);
    assert.deepEqual(receipts.rows.map(x=>x.kind),['encounter-reserve','battle-seal']);
    assert.equal((await reserveEncounter(pool,{accountId,actionId:'reward-quote-book-0002',
      expectedRevision:2,regionId:1})).status,'busy');
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});

test('ONLINE-01C-15: battle payout commits exactly once, preserves capture choice',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {previewReservedBattle}=await import('../src/battlePreview.mjs');
  const {sealReservedBattle}=await import('../src/battleSeal.mjs');
  const {quoteSealedBattleRewards}=await import('../src/battleRewardQuote.mjs');
  const {paySealedBattleRewards}=await import('../src/battlePayout.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['payout-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    const initial=firstSave('Payout CI',4,1740000000000);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(initial)]);
    const booked=await reserveEncounter(pool,{
      accountId,actionId:'payout-reserve-action-0001',expectedRevision:0,regionId:1});
    assert.equal(booked.status,'reserved');
    const identity={accountId,encounterId:booked.encounterId};
    const entropyKey=Buffer.alloc(32,0x45);
    const payout={...identity,actionId:'payout-payment-action-0001',expectedRevision:2};
    assert.equal((await paySealedBattleRewards(pool,payout)).status,'stale');
    assert.equal((await materializeReservedEncounter(pool,{...identity,entropyKey})).status,'materialized');
    assert.equal((await prepareReservedBattle(pool,identity)).status,'prepared');
    assert.equal((await previewReservedBattle(pool,{...identity,entropyKey})).status,'previewed');
    assert.equal((await sealReservedBattle(pool,{...identity,
      actionId:'payout-seal-action-0001',expectedRevision:1})).status,'sealed');
    assert.equal((await paySealedBattleRewards(pool,payout)).status,'unavailable');
    const quoted=await quoteSealedBattleRewards(pool,{...identity,entropyKey});
    assert.equal(quoted.status,'quoted');
    assert.equal((await paySealedBattleRewards(pool,{...payout,expectedRevision:1})).status,'stale');
    assert.equal((await paySealedBattleRewards(pool,{...payout,actionId:'payout-seal-action-0001'})).status,
      'duplicate-action');
    const race=await Promise.all([
      paySealedBattleRewards(pool,payout),
      paySealedBattleRewards(pool,{...payout,actionId:'payout-payment-action-0002'})
    ]);
    assert.deepEqual(race.map(x=>x.status).sort(),['already-paid','paid']);
    const winner=race.find(x=>x.status==='paid');
    assert.equal(winner.revision,3);
    const used=race[0].status==='paid'?'payout-payment-action-0001':'payout-payment-action-0002';
    const replay=await paySealedBattleRewards(pool,{...payout,actionId:used,expectedRevision:2});
    assert.equal(replay.status,'replay');
    assert.deepEqual(replay.paid,winner.paid);
    assert.equal((await paySealedBattleRewards(pool,{...payout,
      actionId:'payout-payment-action-0003',expectedRevision:3})).status,'already-paid');
    const enc=await pool.query(
      'SELECT status,battle_payout_action_id,battle_payout_revision,battle_payout_receipt FROM game_encounter_reservations WHERE id=$1',
      [booked.encounterId]);
    assert.equal(enc.rows[0].status,'reserved');
    assert.equal(enc.rows[0].battle_payout_action_id,used);
    assert.equal(Number(enc.rows[0].battle_payout_revision),3);
    assert.deepEqual(enc.rows[0].battle_payout_receipt,winner.paid);
    await assert.rejects(pool.query(
      'UPDATE game_encounter_reservations SET battle_payout_receipt=NULL WHERE id=$1',
      [booked.encounterId]),error=>error.code==='23514');
    await assert.rejects(pool.query(
      "UPDATE game_encounter_reservations SET status='completed' WHERE id=$1",
      [booked.encounterId]),error=>error.code==='23514');
    const saved=await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',
      [accountId]);
    assert.equal(Number(saved.rows[0].revision),3);
    assert.equal(saved.rows[0].state.journal.revision,3);
    const raw=JSON.parse(saved.rows[0].state.journal.raw);
    assert.equal(raw.coins,quoted.quote.coins);
    assert.equal(raw.trainer.xp,quoted.quote.trainerXp);
    assert.equal(raw.roster[0].xp,quoted.quote.pokemonXp);
    assert.equal(raw.roster[0].affinity,quoted.quote.affinityDelta);
    assert.equal(raw.wins,quoted.quote.wins);
    assert.equal(raw.losses,quoted.quote.losses);
    assert.equal(raw.ballPocket.quantities['poke-ball'],
      12+(quoted.quote.ballDropId==='poke-ball'?1:0));
    assert.equal(raw.roster.length,1);
    assert.deepEqual(raw.badges,[]);
    const receipts=await pool.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 ORDER BY save_revision',
      [accountId]);
    assert.deepEqual(receipts.rows.map(x=>x.kind),
      ['encounter-reserve','battle-seal','battle-payout']);
    assert.deepEqual(receipts.rows.map(x=>Number(x.save_revision)),[1,2,3]);
    assert.equal((await reserveEncounter(pool,{accountId,
      actionId:'payout-reserve-action-0002',expectedRevision:3,regionId:1})).status,'busy');
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});

test('ONLINE-01C-16: finish after payout atomically, replay once and unlock next encounter',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {previewReservedBattle}=await import('../src/battlePreview.mjs');
  const {sealReservedBattle}=await import('../src/battleSeal.mjs');
  const {quoteSealedBattleRewards}=await import('../src/battleRewardQuote.mjs');
  const {paySealedBattleRewards}=await import('../src/battlePayout.mjs');
  const {finishPaidWildEncounter}=await import('../src/encounterFinalization.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['finish-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(firstSave('Final CI',4,1740000000000))]);
    const booked=await reserveEncounter(pool,{
      accountId,actionId:'finish-reservation-0001',expectedRevision:0,regionId:1});
    assert.equal(booked.status,'reserved');
    const ids={accountId,encounterId:booked.encounterId};
    const entropyKey=Buffer.alloc(32,0x4f);
    const finish={...ids,actionId:'finish-skip-action-0001',
      expectedRevision:3,choice:'skip',entropyKey};
    assert.equal((await finishPaidWildEncounter(pool,finish)).status,'stale');
    assert.equal((await materializeReservedEncounter(pool,{...ids,entropyKey})).status,'materialized');
    assert.equal((await prepareReservedBattle(pool,ids)).status,'prepared');
    assert.equal((await previewReservedBattle(pool,{...ids,entropyKey})).status,'previewed');
    assert.equal((await sealReservedBattle(pool,{...ids,
      actionId:'finish-seal-action-0001',expectedRevision:1})).status,'sealed');
    const quoted=await quoteSealedBattleRewards(pool,{...ids,entropyKey});
    assert.equal(quoted.status,'quoted');
    assert.equal((await finishPaidWildEncounter(pool,finish)).status,'stale',
      'cannot complete before payout revision');
    assert.equal((await paySealedBattleRewards(pool,{...ids,
      actionId:'finish-payout-action-0001',expectedRevision:2})).status,'paid');
    assert.equal((await finishPaidWildEncounter(pool,{...finish,
      expectedRevision:2})).status,'stale');
    assert.equal((await finishPaidWildEncounter(pool,{...finish,
      actionId:'finish-payout-action-0001'})).status,'duplicate-action');
    const competing=await Promise.all([
      finishPaidWildEncounter(pool,finish),
      finishPaidWildEncounter(pool,{...finish,actionId:'finish-skip-action-0002'})
    ]);
    assert.deepEqual(competing.map(x=>x.status).sort(),['already-finished','finished']);
    const winner=competing.find(x=>x.status==='finished');
    assert.equal(winner.revision,4);
    assert.equal(winner.result.outcome,'skipped');
    assert.equal(winner.result.ballId,null);
    const winningAction=competing[0].status==='finished'?
      'finish-skip-action-0001':'finish-skip-action-0002';
    const replay=await finishPaidWildEncounter(pool,{
      ...finish,actionId:winningAction,expectedRevision:3});
    assert.equal(replay.status,'replay');
    assert.deepEqual(replay.result,winner.result);
    assert.equal((await finishPaidWildEncounter(pool,{...finish,
      actionId:winningAction,choice:'poke-ball'})).status,'already-finished');
    const row=await pool.query(
      'SELECT status,final_action_id,final_choice,final_revision,final_result FROM game_encounter_reservations WHERE id=$1',
      [booked.encounterId]);
    assert.equal(row.rows[0].status,'completed');
    assert.equal(row.rows[0].final_choice,'skip');
    assert.equal(row.rows[0].final_action_id,winningAction);
    assert.equal(Number(row.rows[0].final_revision),4);
    assert.deepEqual(row.rows[0].final_result,winner.result);
    await assert.rejects(pool.query(
      'UPDATE game_encounter_reservations SET final_result=NULL WHERE id=$1',
      [booked.encounterId]),err=>err.code==='23514');
    await assert.rejects(pool.query(
      'UPDATE game_encounter_reservations SET status=\'reserved\' WHERE id=$1',
      [booked.encounterId]),err=>err.code==='23514');
    const saved=await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',
      [accountId]);
    assert.equal(Number(saved.rows[0].revision),4);
    const raw=JSON.parse(saved.rows[0].state.journal.raw);
    assert.equal(raw.ballPocket.quantities['poke-ball'],
      12+(quoted.quote.ballDropId==='poke-ball'?1:0));
    assert.equal(raw.roster.length,1);
    assert.deepEqual(raw.badges,[]);
    const receipts=await pool.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 ORDER BY save_revision',
      [accountId]);
    assert.deepEqual(receipts.rows.map(x=>x.kind),
      ['encounter-reserve','battle-seal','battle-payout','encounter-finish']);
    assert.deepEqual(receipts.rows.map(x=>Number(x.save_revision)),[1,2,3,4]);
    const next=await reserveEncounter(pool,{
      accountId,actionId:'finish-reservation-0002',expectedRevision:4,regionId:1});
    assert.equal(next.status,'reserved','after completion, next encounter is available');
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});

test('ONLINE-01C-16: successful capture debits one ball and creates one canonical UID atomically',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {previewReservedBattle}=await import('../src/battlePreview.mjs');
  const {sealReservedBattle}=await import('../src/battleSeal.mjs');
  const {quoteSealedBattleRewards}=await import('../src/battleRewardQuote.mjs');
  const {paySealedBattleRewards}=await import('../src/battlePayout.mjs');
  const {finishPaidWildEncounter}=await import('../src/encounterFinalization.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['capture-final-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    // Deterministic isolated DB fixture: experienced Charmander vs Caterpie.
    // Nothing in the production server allows choosing a wild species/level.
    const first=firstSave('Capture CI',4,1740000000000);
    const raw=JSON.parse(first.journal.raw);
    raw.roster[0].level=10;
    first.journal.raw=JSON.stringify(raw);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(first)]);
    const book=await reserveEncounter(pool,{
      accountId,actionId:'capture-final-booking-0001',expectedRevision:0,regionId:1});
    assert.equal(book.status,'reserved');
    const ids={accountId,encounterId:book.encounterId};
    const entropyKey=Buffer.alloc(32,0x59);
    assert.equal((await materializeReservedEncounter(pool,{...ids,entropyKey})).status,
      'materialized');
    await pool.query(
      'UPDATE game_encounter_reservations SET species_id=10,pokemon_level=2 WHERE id=$1',
      [book.encounterId]);
    assert.equal((await prepareReservedBattle(pool,ids)).status,'prepared');
    const preview=await previewReservedBattle(pool,{...ids,entropyKey});
    assert.equal(preview.status,'previewed');
    assert.equal(preview.preview.outcome,'win');
    assert.equal((await sealReservedBattle(pool,{...ids,
      actionId:'capture-final-seal-0001',expectedRevision:1})).status,'sealed');
    assert.equal((await quoteSealedBattleRewards(pool,{...ids,entropyKey})).status,'quoted');
    assert.equal((await paySealedBattleRewards(pool,{...ids,
      actionId:'capture-final-payout-0001',expectedRevision:2})).status,'paid');
    const before=await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[accountId]);
    const oldRaw=JSON.parse(before.rows[0].state.journal.raw);
    assert.equal(oldRaw.roster.length,1);
    const cmd={...ids,actionId:'capture-final-throw-0001',
      expectedRevision:3,choice:'poke-ball',entropyKey};
    const race=await Promise.all([finishPaidWildEncounter(pool,cmd),
      finishPaidWildEncounter(pool,cmd)]);
    assert.deepEqual(race.map(x=>x.status).sort(),['finished','replay']);
    assert.deepEqual(race[0].result,race[1].result);
    assert.equal(race[0].result.outcome,'captured');
    assert.equal(race[0].result.speciesId,10);
    assert.equal(race[0].result.caughtUid,2);
    const saved=await pool.query('SELECT state,revision FROM game_saves WHERE account_id=$1',
      [accountId]);
    assert.equal(Number(saved.rows[0].revision),4);
    const updated=JSON.parse(saved.rows[0].state.journal.raw);
    assert.equal(updated.ballPocket.quantities['poke-ball'],
      oldRaw.ballPocket.quantities['poke-ball']-1);
    assert.equal(updated.nextUid,3);
    assert.equal(updated.roster.length,2);
    assert.equal(updated.roster[1].pokemonId,10);
    assert.equal(updated.roster[1].uid,2);
    assert.equal(updated.roster[1].level,1);
    assert.equal(updated.roster[1].xp,0);
    assert.ok(updated.seen.includes(10));
    assert.ok(updated.caughtSpecies.includes(10));
    assert.deepEqual(updated.badges,[]);
    const counts=await pool.query(
      "SELECT kind,count(*)::int AS n FROM game_action_receipts WHERE account_id=$1 AND kind='encounter-finish' GROUP BY kind",
      [accountId]);
    assert.equal(counts.rows[0].n,1);
    const status=await pool.query('SELECT status FROM game_encounter_reservations WHERE id=$1',
      [book.encounterId]);
    assert.equal(status.rows[0].status,'completed');
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});

test('ONLINE-01C-17: canonical HMAC R1 Poké Ball drop is quoted and credited once',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {previewReservedBattle}=await import('../src/battlePreview.mjs');
  const {sealReservedBattle}=await import('../src/battleSeal.mjs');
  const {quoteSealedBattleRewards}=await import('../src/battleRewardQuote.mjs');
  const {paySealedBattleRewards}=await import('../src/battlePayout.mjs');
  const {finishPaidWildEncounter}=await import('../src/encounterFinalization.mjs');
  const {createPrivateBattleRandom}=await import('../src/battleEntropy.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['ball-drop-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    const first=firstSave('Ball Drop CI',4,1740000000000);
    const starter=JSON.parse(first.journal.raw);
    starter.roster[0].level=10; // strong enough for reliable test-only wild KO
    first.journal.raw=JSON.stringify(starter);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(first)]);
    const reserve=await reserveEncounter(pool,{accountId,
      actionId:'ball-drop-booking-0001',expectedRevision:0,regionId:1});
    assert.equal(reserve.status,'reserved');
    const ids={accountId,encounterId:reserve.encounterId};
    // Rejection sampling is performed by the private HMAC tool; the test
    // chooses a key solely in this throwaway account to cover a DROP path.
    let key;
    for(let n=1;n<256;n++){
      const candidate=Buffer.alloc(32,n);
      const rng=createPrivateBattleRandom(candidate,{
        ...ids,phase:'wild-battle-ball-drop'});
      if(rng.integer(10000)<3000){key=candidate;break;}
    }
    assert.ok(key,'expected a test key that rolls into R1 30% bucket');
    assert.equal((await materializeReservedEncounter(pool,{
      ...ids,entropyKey:key})).status,'materialized');
    // Override random wild species only in isolated PG18 test fixture.
    await pool.query(
      'UPDATE game_encounter_reservations SET species_id=10,pokemon_level=2 WHERE id=$1',
      [reserve.encounterId]);
    assert.equal((await prepareReservedBattle(pool,ids)).status,'prepared');
    const battle=await previewReservedBattle(pool,{...ids,entropyKey:key});
    assert.equal(battle.status,'previewed');
    assert.equal(battle.preview.outcome,'win');
    assert.equal((await sealReservedBattle(pool,{...ids,
      actionId:'ball-drop-seal-0001',expectedRevision:1})).status,'sealed');
    const quoted=await quoteSealedBattleRewards(pool,{...ids,entropyKey:key});
    assert.equal(quoted.status,'quoted');
    assert.equal(quoted.quote.outcome,'win');
    assert.equal(quoted.quote.ballDropId,'poke-ball');
    const afterRotation=await quoteSealedBattleRewards(pool,{
      ...ids,entropyKey:Buffer.alloc(32,0xa5)});
    assert.equal(afterRotation.status,'replay');
    assert.deepEqual(afterRotation.quote,quoted.quote);
    const payout={...ids,actionId:'ball-drop-payout-0001',expectedRevision:2};
    const raced=await Promise.all([
      paySealedBattleRewards(pool,payout),
      paySealedBattleRewards(pool,payout)
    ]);
    assert.deepEqual(raced.map(x=>x.status).sort(),['paid','replay']);
    assert.deepEqual(raced[0].paid,raced[1].paid);
    assert.deepEqual(raced[0].paid.ballDrop,{ballId:'poke-ball',quantity:1});
    assert.equal((await paySealedBattleRewards(pool,{...payout,
      actionId:'ball-drop-payout-0002'})).status,'already-paid');
    const after=await pool.query('SELECT state,revision FROM game_saves WHERE account_id=$1',
      [accountId]);
    assert.equal(Number(after.rows[0].revision),3);
    const raw=JSON.parse(after.rows[0].state.journal.raw);
    assert.equal(raw.ballPocket.quantities['poke-ball'],13);
    assert.equal(raw.coins,quoted.quote.coins);
    assert.equal(raw.roster.length,1);
    const finished=await finishPaidWildEncounter(pool,{
      ...ids,actionId:'ball-drop-skip-0001',
      expectedRevision:3,choice:'skip',entropyKey:key
    });
    assert.equal(finished.status,'finished');
    const end=await pool.query('SELECT state FROM game_saves WHERE account_id=$1',
      [accountId]);
    assert.equal(JSON.parse(end.rows[0].state.journal.raw)
      .ballPocket.quantities['poke-ball'],13,
      'skip never removes already-earned random ball drop');
    const receipts=await pool.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 ORDER BY save_revision',
      [accountId]);
    assert.deepEqual(receipts.rows.map(x=>x.kind),[
      'encounter-reserve','battle-seal','battle-payout','encounter-finish'
    ]);
    assert.deepEqual(receipts.rows.map(x=>Number(x.save_revision)),[1,2,3,4]);
    const next=await reserveEncounter(pool,{
      accountId,actionId:'ball-drop-booking-0002',expectedRevision:4,regionId:1});
    assert.equal(next.status,'reserved');
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});

test('ONLINE-01C-18: turn session begins once and blocks automatic battle preview',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {startReservedWildTurnSession}=await import('../src/wildTurnSession.mjs');
  const {previewReservedBattle}=await import('../src/battlePreview.mjs');
  const {sealReservedBattle}=await import('../src/battleSeal.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['turn-session-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    const first=firstSave('Turn CI',4,1740000000000);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(first)]);
    const booked=await reserveEncounter(pool,{
      accountId,actionId:'turn-session-reserve-0001',
      expectedRevision:0,regionId:1});
    assert.equal(booked.status,'reserved');
    const ids={accountId,encounterId:booked.encounterId};
    const args={...ids,expectedRevision:1};
    const entropyKey=Buffer.alloc(32,0x8a);
    assert.equal((await startReservedWildTurnSession(pool,args)).status,'unavailable',
      'cannot start without the frozen snapshot');
    assert.equal((await materializeReservedEncounter(pool,{
      ...ids,entropyKey})).status,'materialized');
    assert.equal((await prepareReservedBattle(pool,ids)).status,'prepared');
    assert.equal((await startReservedWildTurnSession(pool,{
      ...args,expectedRevision:0})).status,'stale');
    const race=await Promise.all([
      startReservedWildTurnSession(pool,args),
      startReservedWildTurnSession(pool,args)
    ]);
    assert.deepEqual(race.map(x=>x.status).sort(),['replay','started']);
    const winner=race.find(x=>x.status==='started');
    const replay=race.find(x=>x.status==='replay');
    assert.deepEqual(winner.turnState,replay.turnState);
    assert.equal(winner.turnState.phase,'await-player');
    assert.equal(winner.turnState.turn,0);
    assert.equal(winner.turnState.player.uid,1);
    assert.equal(winner.turnState.player.speciesId,4);
    assert.equal(winner.turnState.player.hp,winner.turnState.player.maxHp);
    assert.equal(winner.turnState.player.sp,winner.turnState.player.maxSp);
    assert.equal(winner.turnState.wild.hp,winner.turnState.wild.maxHp);
    assert.ok(winner.turnState.wild.equippedMoves.length<=4);
    assert.deepEqual(winner.actions.map(x=>x.kind),['basic','move']);
    assert.equal(Object.hasOwn(winner.turnState,'seed'),false);
    const replayAgain=await startReservedWildTurnSession(pool,{
      ...args,expectedRevision:0});
    assert.equal(replayAgain.status,'replay');
    assert.deepEqual(replayAgain.turnState,winner.turnState);
    assert.equal((await previewReservedBattle(pool,{
      ...ids,entropyKey})).status,'unavailable',
      'turn mode cannot fall back to the obsolete whole-battle auto preview');
    assert.equal((await sealReservedBattle(pool,{
      ...ids,actionId:'turn-session-seal-0001',expectedRevision:1})).status,
      'unavailable','no outcome exists before applying legal player turns');
    const row=await pool.query(
      `SELECT status,battle_turn_state,battle_turn_started_at,
              battle_preview,battle_sealed_outcome
         FROM game_encounter_reservations WHERE id=$1`,
      [booked.encounterId]);
    assert.equal(row.rows[0].status,'reserved');
    assert.ok(row.rows[0].battle_turn_started_at);
    assert.deepEqual(row.rows[0].battle_turn_state,winner.turnState);
    assert.equal(row.rows[0].battle_preview,null);
    assert.equal(row.rows[0].battle_sealed_outcome,null);
    await assert.rejects(pool.query(
      `UPDATE game_encounter_reservations
          SET battle_preview='{}'::jsonb,battle_preview_at=now()
        WHERE id=$1`,[booked.encounterId]),e=>e.code==='23514');
    await assert.rejects(pool.query(
      'UPDATE game_encounter_reservations SET battle_turn_started_at=NULL WHERE id=$1',
      [booked.encounterId]),e=>e.code==='23514');
    const save=await pool.query(
      'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
    assert.equal(Number(save.rows[0].revision),1);
    assert.equal(save.rows[0].state.journal.raw,first.journal.raw);
    const raw=JSON.parse(save.rows[0].state.journal.raw);
    assert.equal(raw.coins,0);
    assert.equal(raw.trainer.xp,0);
    assert.equal(raw.ballPocket.quantities['poke-ball'],12);
    assert.deepEqual(raw.badges,[]);
    const receipts=await pool.query(
      'SELECT kind FROM game_action_receipts WHERE account_id=$1',
      [accountId]);
    assert.deepEqual(receipts.rows.map(x=>x.kind),['encounter-reserve']);
    assert.equal((await reserveEncounter(pool,{
      accountId,actionId:'turn-session-reserve-0002',
      expectedRevision:1,regionId:1})).status,'busy');
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});

test('ONLINE-01C-18: automatic preview and turn mode cannot coexist',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {startReservedWildTurnSession}=await import('../src/wildTurnSession.mjs');
  const {previewReservedBattle}=await import('../src/battlePreview.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['turn-exclusive-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(firstSave('Legacy CI',7,1740000000000))]);
    const booked=await reserveEncounter(pool,{
      accountId,actionId:'turn-exclusive-reserve-0001',
      expectedRevision:0,regionId:1});
    assert.equal(booked.status,'reserved');
    const ids={accountId,encounterId:booked.encounterId};
    const entropyKey=Buffer.alloc(32,0x22);
    assert.equal((await materializeReservedEncounter(pool,{
      ...ids,entropyKey})).status,'materialized');
    assert.equal((await prepareReservedBattle(pool,ids)).status,'prepared');
    assert.equal((await previewReservedBattle(pool,{
      ...ids,entropyKey})).status,'previewed');
    assert.equal((await startReservedWildTurnSession(pool,{
      ...ids,expectedRevision:1})).status,'unavailable');
    const rows=await pool.query(
      'SELECT battle_turn_state FROM game_encounter_reservations WHERE id=$1',
      [booked.encounterId]);
    assert.equal(rows.rows[0].battle_turn_state,null);
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});

test('ONLINE-01C-19: one transactional wild turn, replay, audit and no rewards',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {startReservedWildTurnSession}=await import('../src/wildTurnSession.mjs');
  const {applyReservedWildTurn}=await import('../src/wildTurnAction.mjs');
  const {previewReservedBattle}=await import('../src/battlePreview.mjs');
  const {sealReservedBattle}=await import('../src/battleSeal.mjs');
  const {quoteSealedBattleRewards}=await import('../src/battleRewardQuote.mjs');
  const {paySealedBattleRewards}=await import('../src/battlePayout.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const registered=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['turn-writer-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=registered.rows[0].id;
    const initial=firstSave('Turn Writer CI',4,1740000000000);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(initial)]);
    const reserved=await reserveEncounter(pool,{
      accountId,actionId:'turn-writer-reserve-0001',expectedRevision:0,regionId:1});
    assert.equal(reserved.status,'reserved');
    const ids={accountId,encounterId:reserved.encounterId};
    const key=Buffer.alloc(32,0x82);
    const basic={kind:'basic'};
    const command={...ids,actionId:'turn-writer-action-0001',
      expectedRevision:1,action:basic,entropyKey:key};
    assert.equal((await applyReservedWildTurn(pool,command)).status,'unavailable');
    assert.equal((await materializeReservedEncounter(pool,{
      ...ids,entropyKey:key})).status,'materialized');
    assert.equal((await prepareReservedBattle(pool,ids)).status,'prepared');
    assert.equal((await startReservedWildTurnSession(pool,{
      ...ids,expectedRevision:1})).status,'started');
    assert.equal((await applyReservedWildTurn(pool,{
      ...command,action:{kind:'move',moveName:'hyper-beam'}})).status,
      'blocked','unequipped future move must not consume a turn');
    assert.equal((await applyReservedWildTurn(pool,{
      ...command,action:{kind:'focus'}})).status,'blocked',
      'cannot focus while SP is full');
    assert.equal((await applyReservedWildTurn(pool,{
      ...command,action:{kind:'switch',toIndex:1}})).status,'invalid');
    assert.equal((await applyReservedWildTurn(pool,{
      ...command,expectedRevision:0})).status,'stale');
    const parallel=await Promise.all([
      applyReservedWildTurn(pool,command),
      applyReservedWildTurn(pool,{...command,entropyKey:Buffer.alloc(32,0xe3)})
    ]);
    assert.deepEqual(parallel.map(x=>x.status).sort(),['applied','replay']);
    assert.deepEqual(parallel[0].result,parallel[1].result);
    const result=parallel[0].result;
    assert.equal(result.turn,1);
    assert.equal(result.playerAction.kind,'basic');
    assert.ok(['basic','move','focus'].includes(result.wildAction.kind));
    assert.equal(result.logDelta.length,result.framesDelta.length);
    assert.equal(result.player.hp<=result.player.maxHp,true);
    assert.equal(result.wild.hp<=result.wild.maxHp,true);
    assert.ok(result.player.sp<=result.player.maxSp);
    assert.ok(result.wild.sp<=result.wild.maxSp);
    assert.equal(Object.hasOwn(result,'seed'),false);
    assert.equal(Object.hasOwn(result,'coins'),false);
    assert.equal(Object.hasOwn(result,'captured'),false);
    const retry=await applyReservedWildTurn(pool,{
      ...command,entropyKey:Buffer.alloc(32,0xa6),expectedRevision:0});
    assert.equal(retry.status,'replay');
    assert.deepEqual(retry.result,result);
    assert.equal((await applyReservedWildTurn(pool,{
      ...command,action:{kind:'move',moveName:'scratch'}})).status,
      'duplicate-action','same actionId cannot change command');
    if(result.phase==='await-player'){
      assert.equal((await applyReservedWildTurn(pool,{
        ...command,actionId:'turn-writer-wrong-key-0001',
        expectedRevision:2,entropyKey:Buffer.alloc(32,0xb7)})).status,
        'entropy-mismatch','a new turn cannot switch the historical HMAC key');
    }
    assert.equal((await applyReservedWildTurn(pool,{
      ...command,actionId:'turn-writer-reserve-0001'})).status,
      'duplicate-action','action identifiers cannot cross receipt kinds');
    const row=await pool.query(
      'SELECT status,battle_turn_state,battle_preview,battle_sealed_outcome FROM game_encounter_reservations WHERE id=$1',
      [reserved.encounterId]);
    assert.equal(row.rows[0].status,'reserved');
    assert.equal(row.rows[0].battle_turn_state.turn,1);
    assert.equal(row.rows[0].battle_turn_state.log.length,
      row.rows[0].battle_turn_state.frames.length);
    assert.equal(row.rows[0].battle_preview,null);
    assert.equal(row.rows[0].battle_sealed_outcome,null);
    const receipts=await pool.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 ORDER BY save_revision',
      [accountId]);
    assert.deepEqual(receipts.rows.map(x=>x.kind),
      ['encounter-reserve','wild-turn']);
    assert.deepEqual(receipts.rows.map(x=>Number(x.save_revision)),[1,2]);
    const journal=await pool.query(
      'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
    assert.equal(Number(journal.rows[0].revision),2);
    assert.equal(journal.rows[0].state.journal.revision,2);
    assert.equal(journal.rows[0].state.journal.raw,initial.journal.raw);
    const contents=JSON.parse(journal.rows[0].state.journal.raw);
    assert.equal(contents.coins,0);
    assert.equal(contents.trainer.xp,0);
    assert.equal(contents.roster[0].xp,0);
    assert.equal(contents.ballPocket.quantities['poke-ball'],12);
    assert.deepEqual(contents.badges,[]);
    const events=await pool.query(
      'SELECT turn_number,player_action,wild_action,turn_result,save_revision FROM game_wild_turn_receipts WHERE encounter_id=$1',
      [reserved.encounterId]);
    assert.equal(events.rowCount,1);
    assert.equal(events.rows[0].turn_number,1);
    assert.deepEqual(events.rows[0].player_action,basic);
    assert.deepEqual(events.rows[0].turn_result,result);
    assert.equal(Number(events.rows[0].save_revision),2);
    await assert.rejects(pool.query(
      "UPDATE game_wild_turn_receipts SET turn_result='{}'::jsonb WHERE encounter_id=$1",
      [reserved.encounterId]),e=>e.code==='23514');
    assert.equal((await previewReservedBattle(pool,{
      ...ids,entropyKey:key})).status,'unavailable');
    assert.equal((await sealReservedBattle(pool,{...ids,
      actionId:'turn-writer-seal-0001',expectedRevision:2})).status,'unavailable');
    assert.equal((await quoteSealedBattleRewards(pool,{...ids,
      entropyKey:key})).status,'unavailable');
    assert.equal((await paySealedBattleRewards(pool,{...ids,
      actionId:'turn-writer-payout-0001',expectedRevision:2})).status,'unavailable');
    assert.equal((await reserveEncounter(pool,{
      accountId,actionId:'turn-writer-reserve-0002',
      expectedRevision:2,regionId:1})).status,'busy');
    if(result.phase==='await-player'){
      const next=await applyReservedWildTurn(pool,{
        ...command,actionId:'turn-writer-action-0002',
        expectedRevision:2,entropyKey:key});
      assert.equal(next.status,'applied');
      assert.equal(next.result.turn,2);
      assert.equal(next.revision,3);
      assert.equal(next.result.logDelta.length,next.result.framesDelta.length);
      assert.equal((await applyReservedWildTurn(pool,{
        ...command,actionId:'turn-writer-action-0002',
        expectedRevision:2,entropyKey:Buffer.alloc(32,0x7a)})).status,'replay');
    }
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});


test('ONLINE-01C-20: certify terminal wild transcript once without any payout',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {startReservedWildTurnSession}=await import('../src/wildTurnSession.mjs');
  const {applyReservedWildTurn}=await import('../src/wildTurnAction.mjs');
  const {certifyResolvedWildTurn}=await import('../src/wildTurnCertificate.mjs');
  const {paySealedBattleRewards}=await import('../src/battlePayout.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['turn-certificate-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    const initial=firstSave('Turn Cert CI',4,1740000000000);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(initial)]);
    const reserve=await reserveEncounter(pool,{
      accountId,actionId:'turn-certificate-reserve-0001',expectedRevision:0,regionId:1});
    assert.equal(reserve.status,'reserved');
    const ids={accountId,encounterId:reserve.encounterId};
    const key=Buffer.alloc(32,0x2f);
    const sealArgs={...ids,actionId:'turn-certificate-seal-0001',expectedRevision:1};
    assert.equal((await certifyResolvedWildTurn(pool,sealArgs)).status,'unavailable',
      'cannot certify before preparing/playing');
    assert.equal((await materializeReservedEncounter(pool,{
      ...ids,entropyKey:key})).status,'materialized');
    assert.equal((await prepareReservedBattle(pool,ids)).status,'prepared');
    const started=await startReservedWildTurnSession(pool,{
      ...ids,expectedRevision:1});
    assert.equal(started.status,'started');
    assert.equal((await certifyResolvedWildTurn(pool,sealArgs)).status,'unavailable',
      'turn zero must never be a payable or certifiable outcome');
    let session=started.turnState,revision=1,turns=0;
    while(session.phase==='await-player'&&turns<30){
      turns++;
      const resolved=await applyReservedWildTurn(pool,{
        ...ids,actionId:'turn-certificate-step-'+String(turns).padStart(4,'0'),
        expectedRevision:revision,action:{kind:'basic'},entropyKey:key});
      assert.equal(resolved.status,'applied');
      revision=resolved.revision;
      const next=await pool.query(
        'SELECT battle_turn_state FROM game_encounter_reservations WHERE id=$1',
        [ids.encounterId]);
      session=next.rows[0].battle_turn_state;
      assert.equal(session.turn,turns);
      assert.equal(session.log.length,session.frames.length);
    }
    assert.equal(session.phase,'resolved','turns must finish by KO or round 30');
    assert.ok(['win','loss','draw'].includes(session.outcome));
    const command={...sealArgs,expectedRevision:revision};
    assert.equal((await certifyResolvedWildTurn(pool,{
      ...command,expectedRevision:revision-1})).status,'stale');
    assert.equal((await certifyResolvedWildTurn(pool,{
      ...command,actionId:'turn-certificate-step-0001'})).status,'duplicate-action');
    const lastAction='turn-certificate-step-'+String(turns).padStart(4,'0');
    const original=await pool.query(
      'SELECT turn_result FROM game_wild_turn_receipts WHERE encounter_id=$1 AND action_id=$2',
      [ids.encounterId,lastAction]);
    assert.equal(original.rowCount,1);
    await pool.query(
      "UPDATE game_wild_turn_receipts SET turn_result=jsonb_set(turn_result,'{logDelta}','[\"forged\"]'::jsonb) WHERE encounter_id=$1 AND action_id=$2",
      [ids.encounterId,lastAction]);
    assert.equal((await certifyResolvedWildTurn(pool,command)).status,
      'invalid-history','mutated audit log must not create a certificate');
    await pool.query(
      'UPDATE game_wild_turn_receipts SET turn_result=$3::jsonb WHERE encounter_id=$1 AND action_id=$2',
      [ids.encounterId,lastAction,JSON.stringify(original.rows[0].turn_result)]);
    const race=await Promise.all([
      certifyResolvedWildTurn(pool,command),
      certifyResolvedWildTurn(pool,command)
    ]);
    assert.deepEqual(race.map(x=>x.status).sort(),['certified','replay']);
    assert.deepEqual(race[0].certificate,race[1].certificate);
    assert.equal(race[0].certificate.outcome,session.outcome);
    assert.equal(race[0].certificate.turns,turns);
    assert.match(race[0].certificate.digest,/^[0-9a-f]{64}$/);
    assert.equal(race[0].revision,revision+1);
    assert.equal((await certifyResolvedWildTurn(pool,{
      ...command,actionId:'turn-certificate-second-0001',
      expectedRevision:revision+1})).status,'already-certified');
    const encounter=await pool.query(
      'SELECT status,battle_preview,battle_sealed_outcome,battle_reward_quote,battle_payout_action_id,battle_turn_certificate_revision,battle_turn_certificate_outcome,battle_turn_certificate_digest FROM game_encounter_reservations WHERE id=$1',
      [ids.encounterId]);
    assert.equal(encounter.rows[0].status,'reserved');
    assert.equal(encounter.rows[0].battle_preview,null);
    assert.equal(encounter.rows[0].battle_sealed_outcome,null);
    assert.equal(encounter.rows[0].battle_reward_quote,null);
    assert.equal(encounter.rows[0].battle_payout_action_id,null);
    assert.equal(Number(encounter.rows[0].battle_turn_certificate_revision),revision+1);
    assert.equal(encounter.rows[0].battle_turn_certificate_outcome,session.outcome);
    assert.equal(encounter.rows[0].battle_turn_certificate_digest,race[0].certificate.digest);
    const saved=await pool.query(
      'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
    assert.equal(Number(saved.rows[0].revision),revision+1);
    assert.equal(saved.rows[0].state.journal.revision,revision+1);
    assert.equal(saved.rows[0].state.journal.raw,initial.journal.raw);
    const raw=JSON.parse(saved.rows[0].state.journal.raw);
    assert.equal(raw.coins,0);
    assert.equal(raw.trainer.xp,0);
    assert.equal(raw.roster[0].xp,0);
    assert.equal(raw.ballPocket.quantities['poke-ball'],12);
    assert.equal((await paySealedBattleRewards(pool,{
      ...ids,actionId:'turn-certificate-payout-0001',
      expectedRevision:revision+1})).status,'unavailable',
      'turn certificate is not a license to call auto-preview payout');
    assert.equal((await reserveEncounter(pool,{
      accountId,actionId:'turn-certificate-reroll-0001',
      expectedRevision:revision+1,regionId:1})).status,'busy');
    const receipts=await pool.query(
      'SELECT kind FROM game_action_receipts WHERE account_id=$1 AND kind=$2',
      [accountId,'wild-turn-certificate']);
    assert.equal(receipts.rowCount,1);
    await assert.rejects(pool.query(
      "UPDATE game_encounter_reservations SET battle_turn_certificate_outcome='fake' WHERE id=$1",
      [ids.encounterId]),error=>error.code==='23514');
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});


test('ONLINE-01C-21: verify every HMAC turn and pay exactly once (never auto-preview)',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {startReservedWildTurnSession}=await import('../src/wildTurnSession.mjs');
  const {applyReservedWildTurn}=await import('../src/wildTurnAction.mjs');
  const {certifyResolvedWildTurn,auditResolvedWildTurnTranscript}=
    await import('../src/wildTurnCertificate.mjs');
  const {payCertifiedWildTurns}=await import('../src/wildTurnSettlement.mjs');
  const {paySealedBattleRewards}=await import('../src/battlePayout.mjs');
  const {finishPaidWildEncounter}=await import('../src/encounterFinalization.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['turn-payout-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    const initial=firstSave('Turn Payout CI',4,1740000000000);
    const before=JSON.parse(initial.journal.raw);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(initial)]);
    const booked=await reserveEncounter(pool,{
      accountId,actionId:'turn-payout-reservation-0001',
      expectedRevision:0,regionId:1});
    assert.equal(booked.status,'reserved');
    const ids={accountId,encounterId:booked.encounterId};
    const key=Buffer.alloc(32,0x39);
    const corruptedKey=Buffer.alloc(32,0xa1);
    const payoutId='turn-payout-payment-0001';
    const command={...ids,actionId:payoutId,expectedRevision:1,entropyKey:key};
    assert.equal((await payCertifiedWildTurns(pool,command)).status,'unavailable');
    assert.equal((await materializeReservedEncounter(pool,{
      ...ids,entropyKey:key})).status,'materialized');
    assert.equal((await prepareReservedBattle(pool,ids)).status,'prepared');
    const opened=await startReservedWildTurnSession(pool,{
      ...ids,expectedRevision:1});
    assert.equal(opened.status,'started');
    assert.equal((await payCertifiedWildTurns(pool,command)).status,'unavailable');
    let state=opened.turnState,revision=1,turn=0;
    while(state.phase==='await-player'&&turn<30){
      turn++;
      const applied=await applyReservedWildTurn(pool,{
        ...ids,actionId:'turn-payout-step-'+String(turn).padStart(4,'0'),
        expectedRevision:revision,action:{kind:'basic'},entropyKey:key});
      assert.equal(applied.status,'applied');
      revision=applied.revision;
      const row=await pool.query(
        'SELECT battle_turn_state FROM game_encounter_reservations WHERE id=$1',
        [ids.encounterId]);
      state=row.rows[0].battle_turn_state;
    }
    assert.equal(state.phase,'resolved');
    assert.ok(turn>=1&&turn<=30);
    assert.equal((await payCertifiedWildTurns(pool,{
      ...command,expectedRevision:revision})).status,'unavailable',
      'a final session without an independent certificate cannot pay');
    const {createPrivateBattleKeyProof}=await import('../src/battleEntropy.mjs');
    const proofRow=await pool.query(
      'SELECT battle_turn_entropy_proof FROM game_encounter_reservations WHERE id=$1',
      [ids.encounterId]);
    assert.match(proofRow.rows[0].battle_turn_entropy_proof,/^[0-9a-f]{64}$/);
    assert.equal(proofRow.rows[0].battle_turn_entropy_proof,
      createPrivateBattleKeyProof(key,ids));
    assert.notEqual(createPrivateBattleKeyProof(corruptedKey,ids),
      proofRow.rows[0].battle_turn_entropy_proof);
    const certify=await certifyResolvedWildTurn(pool,{
      ...ids,actionId:'turn-payout-certificate-0001',
      expectedRevision:revision});
    assert.equal(certify.status,'certified');
    revision=certify.revision;
    const args={...command,expectedRevision:revision};
    assert.equal((await payCertifiedWildTurns(pool,{
      ...args,expectedRevision:revision-1})).status,'stale');
    assert.equal((await payCertifiedWildTurns(pool,{
      ...args,actionId:'turn-payout-certificate-0001'})).status,
      'duplicate-action');
    assert.equal((await payCertifiedWildTurns(pool,{
      ...args,entropyKey:corruptedKey})).status,'entropy-mismatch',
      'key rotation without old key must fail closed and never reroll');
    const original=await pool.query(
      `SELECT battle_snapshot,battle_turn_state,battle_turn_certificate_digest
         FROM game_encounter_reservations WHERE id=$1`,[ids.encounterId]);
    const session=original.rows[0].battle_turn_state;
    const history=await pool.query(
      `SELECT t.action_id,t.turn_number,t.player_action,t.wild_action,
              t.turn_result,t.save_revision,a.kind,
              a.save_revision AS receipt_revision
         FROM game_wild_turn_receipts t JOIN game_action_receipts a
           ON a.account_id=t.account_id AND a.action_id=t.action_id
        WHERE t.account_id=$1 AND t.encounter_id=$2
        ORDER BY t.turn_number`,[accountId,ids.encounterId]);
    assert.ok(history.rows[0].turn_result.logDelta.length>0);
    // Forge an internally consistent transcript AND recompute its non-MAC
    // certificate digest. The independent HMAC replay must still reject it.
    const fakeLine='transcript-forjado-ci';
    const fakeHistory=structuredClone(history.rows);
    fakeHistory[0].turn_result.logDelta[0]=fakeLine;
    const fakeSession=structuredClone(session);
    fakeSession.log[0]=fakeLine;
    const fakeCertificate=auditResolvedWildTurnTranscript(
      original.rows[0].battle_snapshot,fakeSession,fakeHistory);
    assert.ok(fakeCertificate,
      'structural digest can be forged without the secret HMAC');
    assert.notEqual(fakeCertificate.digest,certify.certificate.digest);
    await pool.query(
      'UPDATE game_wild_turn_receipts SET turn_result=$3::jsonb WHERE account_id=$1 AND encounter_id=$2 AND turn_number=1',
      [accountId,ids.encounterId,JSON.stringify(fakeHistory[0].turn_result)]);
    await pool.query(
      `UPDATE game_encounter_reservations
          SET battle_turn_state=$3::jsonb,battle_turn_certificate_digest=$4
        WHERE account_id=$1 AND id=$2`,
      [accountId,ids.encounterId,JSON.stringify(fakeSession),
        fakeCertificate.digest]);
    assert.equal((await payCertifiedWildTurns(pool,args)).status,
      'invalid-history','forged SHA256 and matching forged logs are insufficient');
    await pool.query(
      'UPDATE game_wild_turn_receipts SET turn_result=$3::jsonb WHERE account_id=$1 AND encounter_id=$2 AND turn_number=1',
      [accountId,ids.encounterId,JSON.stringify(history.rows[0].turn_result)]);
    await pool.query(
      `UPDATE game_encounter_reservations
          SET battle_turn_state=$3::jsonb,battle_turn_certificate_digest=$4
        WHERE account_id=$1 AND id=$2`,
      [accountId,ids.encounterId,JSON.stringify(session),
        original.rows[0].battle_turn_certificate_digest]);
    const core=await import(process.env.CORE_BUNDLE_PATH);
    const {createPrivateBattleRandom}=await import('../src/battleEntropy.mjs');
    const stableHistory=await pool.query(
      `SELECT t.action_id,t.turn_number,t.player_action,t.wild_action,
              t.turn_result,t.save_revision,a.kind,
              a.save_revision AS receipt_revision
         FROM game_wild_turn_receipts t JOIN game_action_receipts a
           ON a.account_id=t.account_id AND a.action_id=t.action_id
        WHERE t.account_id=$1 AND t.encounter_id=$2 ORDER BY t.turn_number`,
      [accountId,ids.encounterId]);
    const stableAudit=auditResolvedWildTurnTranscript(
      original.rows[0].battle_snapshot,session,stableHistory.rows);
    assert.ok(stableAudit,'restored structural transcript');
    assert.equal(stableAudit.digest,certify.certificate.digest,
      'canonical transcript digest must match before replay');
    let calculated=core.createFrozenWildTurnSession(original.rows[0].battle_snapshot);
    assert.ok(calculated);
    for(let index=0;index<stableHistory.rows.length;index++){
      const record=stableHistory.rows[index];
      const seed=createPrivateBattleRandom(key,{
        accountId,encounterId:ids.encounterId,phase:'wild-turn-'+(index+1)
      }).integer(2**32);
      const resolved=core.resolveFrozenWildTurn(
        original.rows[0].battle_snapshot,calculated,record.player_action,seed);
      assert.equal(resolved?.status,'applied','replay should resolve turn '+(index+1));
      const next=JSON.parse(JSON.stringify(resolved.turnState));
      const expected=JSON.parse(JSON.stringify({
        turn:index+1,phase:next.phase,outcome:next.outcome??null,
        player:next.player,wild:next.wild,
        playerAction:resolved.playerAction,wildAction:resolved.wildAction,
        logDelta:resolved.logDelta,framesDelta:resolved.framesDelta,
        nextActions:resolved.nextActions
      }));
      assert.deepEqual(expected,record.turn_result,
        'canonical HMAC receipt mismatch at turn '+(index+1));
      calculated=next;
    }
    assert.deepEqual(calculated,session,'canonical final state equals DB snapshot');
    const parallel=await Promise.all([
      payCertifiedWildTurns(pool,args),
      payCertifiedWildTurns(pool,args)
    ]);
    assert.deepEqual(parallel.map(x=>x.status).sort(),['paid','replay']);
    assert.deepEqual(parallel[0].paid,parallel[1].paid);
    assert.deepEqual(parallel[0].quote,parallel[1].quote);
    assert.equal(parallel[0].revision,revision+1);
    assert.equal(parallel[0].paid.outcome,state.outcome);
    assert.equal(parallel[0].quote.outcome,state.outcome);
    assert.equal(parallel[0].paid.ballDrop?.quantity??0,
      parallel[0].quote.ballDropId?1:0);
    assert.equal((await payCertifiedWildTurns(pool,{
      ...args,actionId:'turn-payout-payment-0002',
      expectedRevision:revision+1})).status,'already-paid');
    assert.equal((await payCertifiedWildTurns(pool,{
      ...args,entropyKey:corruptedKey,expectedRevision:0})).status,'replay',
      'a committed payout must replay without re-reading rotated entropy');
    const afterRow=await pool.query(
      'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
    assert.equal(Number(afterRow.rows[0].revision),revision+1);
    assert.equal(afterRow.rows[0].state.journal.revision,revision+1);
    const after=JSON.parse(afterRow.rows[0].state.journal.raw);
    const paid=parallel[0].paid;
    assert.equal(after.coins,before.coins+paid.coins);
    assert.equal(after.trainer.xp,before.trainer.xp+paid.trainerXp);
    assert.equal(after.roster[0].xp,before.roster[0].xp+paid.pokemonXp);
    assert.equal(after.roster[0].affinity,before.roster[0].affinity+paid.affinityDelta);
    assert.deepEqual(after.badges,before.badges);
    assert.equal(after.roster.length,before.roster.length);
    assert.equal(after.ballPocket.quantities['poke-ball'],
      before.ballPocket.quantities['poke-ball']+
        (paid.ballDrop?.ballId==='poke-ball'?paid.ballDrop.quantity:0));
    const row=await pool.query(
      `SELECT status,battle_preview,battle_sealed_outcome,battle_reward_quote,
              battle_payout_action_id,battle_turn_payout_action_id,
              battle_turn_payout_revision,battle_turn_payout_quote,
              battle_turn_payout_receipt
         FROM game_encounter_reservations WHERE id=$1`,[ids.encounterId]);
    assert.equal(row.rows[0].status,'reserved');
    for(const name of ['battle_preview','battle_sealed_outcome',
      'battle_reward_quote','battle_payout_action_id'])
      assert.equal(row.rows[0][name],null);
    assert.equal(row.rows[0].battle_turn_payout_action_id,payoutId);
    assert.equal(Number(row.rows[0].battle_turn_payout_revision),revision+1);
    assert.deepEqual(row.rows[0].battle_turn_payout_quote,parallel[0].quote);
    assert.deepEqual(row.rows[0].battle_turn_payout_receipt,paid);
    assert.equal((await paySealedBattleRewards(pool,{
      ...ids,actionId:'turn-payout-old-0001',
      expectedRevision:revision+1})).status,'unavailable');
    assert.equal((await finishPaidWildEncounter(pool,{
      ...ids,actionId:'turn-payout-capture-0001',
      expectedRevision:revision+1,choice:'skip',entropyKey:key})).status,
      'unavailable','capture/skip must use a separate future turn-mode finalizer');
    assert.equal((await reserveEncounter(pool,{
      accountId,actionId:'turn-payout-reroll-0001',
      expectedRevision:revision+1,regionId:1})).status,'busy');
    const receipts=await pool.query(
      'SELECT kind,save_revision FROM game_action_receipts WHERE account_id=$1 AND kind=$2',
      [accountId,'wild-turn-payout']);
    assert.equal(receipts.rowCount,1);
    assert.equal(Number(receipts.rows[0].save_revision),revision+1);
    await assert.rejects(pool.query(
      "UPDATE game_encounter_reservations SET battle_turn_payout_quote=NULL WHERE id=$1",
      [ids.encounterId]),e=>e.code==='23514');
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});


test('ONLINE-01C-22: losing interactive battle can only skip, with receipt and next reservation',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {startReservedWildTurnSession}=await import('../src/wildTurnSession.mjs');
  const {applyReservedWildTurn}=await import('../src/wildTurnAction.mjs');
  const {certifyResolvedWildTurn}=await import('../src/wildTurnCertificate.mjs');
  const {payCertifiedWildTurns}=await import('../src/wildTurnSettlement.mjs');
  const {finishPaidWildTurnEncounter}=await import('../src/wildTurnFinalization.mjs');
  const {finishPaidWildEncounter}=await import('../src/encounterFinalization.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['turn-finish-skip-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    const first=firstSave('Turn Skip CI',4,1740000000000);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(first)]);
    const reserved=await reserveEncounter(pool,{
      accountId,actionId:'turn-finish-skip-reserve-0001',
      expectedRevision:0,regionId:1});
    assert.equal(reserved.status,'reserved');
    const ids={accountId,encounterId:reserved.encounterId};
    const key=Buffer.alloc(32,0x57);
    const finalize={...ids,actionId:'turn-finish-skip-choice-0001',
      expectedRevision:1,choice:'skip',entropyKey:key};
    assert.equal((await finishPaidWildTurnEncounter(pool,finalize)).status,'unavailable');
    assert.equal((await materializeReservedEncounter(pool,{
      ...ids,entropyKey:key})).status,'materialized');
    // A deliberately stronger wild Charmander guarantees the losing path;
    // no browser can select this opponent: the override is CI-only fixture.
    await pool.query(
      'UPDATE game_encounter_reservations SET species_id=4,pokemon_level=10 WHERE id=$1',
      [ids.encounterId]);
    assert.equal((await prepareReservedBattle(pool,ids)).status,'prepared');
    const opened=await startReservedWildTurnSession(pool,{
      ...ids,expectedRevision:1});
    assert.equal(opened.status,'started');
    assert.equal((await finishPaidWildTurnEncounter(pool,finalize)).status,'unavailable');
    let turnState=opened.turnState,rev=1,round=0;
    while(turnState.phase==='await-player'&&round<30){
      round++;
      const done=await applyReservedWildTurn(pool,{
        ...ids,actionId:'turn-finish-skip-step-'+String(round).padStart(4,'0'),
        expectedRevision:rev,action:{kind:'basic'},entropyKey:key});
      assert.equal(done.status,'applied');
      rev=done.revision;
      const current=await pool.query(
        'SELECT battle_turn_state FROM game_encounter_reservations WHERE id=$1',
        [ids.encounterId]);
      turnState=current.rows[0].battle_turn_state;
    }
    assert.equal(turnState.phase,'resolved');
    assert.equal(turnState.outcome,'loss');
    assert.equal((await finishPaidWildTurnEncounter(pool,{
      ...finalize,expectedRevision:rev})).status,'unavailable',
      'no early finish without certified and paid result');
    const cert=await certifyResolvedWildTurn(pool,{
      ...ids,actionId:'turn-finish-skip-certificate-0001',expectedRevision:rev});
    assert.equal(cert.status,'certified');
    rev=cert.revision;
    assert.equal((await finishPaidWildTurnEncounter(pool,{
      ...finalize,expectedRevision:rev})).status,'unavailable',
      'certification is not payment');
    const payout=await payCertifiedWildTurns(pool,{
      ...ids,actionId:'turn-finish-skip-payout-0001',
      expectedRevision:rev,entropyKey:key});
    assert.equal(payout.status,'paid');
    rev=payout.revision;
    const afterPayout=await pool.query(
      'SELECT state FROM game_saves WHERE account_id=$1',[accountId]);
    const paidRaw=JSON.parse(afterPayout.rows[0].state.journal.raw);
    assert.equal((await reserveEncounter(pool,{
      accountId,actionId:'turn-finish-skip-next-early',
      expectedRevision:rev,regionId:1})).status,'busy');
    const args={...finalize,expectedRevision:rev};
    assert.equal((await finishPaidWildTurnEncounter(pool,{
      ...args,choice:'poke-ball'})).status,'unavailable',
      'loss/draw never gets a capture choice');
    assert.equal((await finishPaidWildTurnEncounter(pool,{
      ...args,entropyKey:Buffer.alloc(32,0x92)})).status,
      'entropy-mismatch');
    assert.equal((await finishPaidWildTurnEncounter(pool,{
      ...args,expectedRevision:rev-1})).status,'stale');
    assert.equal((await finishPaidWildTurnEncounter(pool,{
      ...args,actionId:'turn-finish-skip-payout-0001'})).status,
      'duplicate-action');
    await assert.rejects(pool.query(
      "UPDATE game_encounter_reservations SET status='completed' WHERE id=$1",
      [ids.encounterId]),e=>e.code==='23514',
      'completed requires its own transactionally signed final result');
    const race=await Promise.all([
      finishPaidWildTurnEncounter(pool,args),
      finishPaidWildTurnEncounter(pool,args)
    ]);
    assert.deepEqual(race.map(x=>x.status).sort(),['finished','replay']);
    assert.deepEqual(race[0].result,race[1].result);
    assert.deepEqual(race[0].result,{
      outcome:'skipped',ballId:null,speciesId:4,caughtUid:null});
    assert.equal(race[0].revision,rev+1);
    assert.equal((await finishPaidWildTurnEncounter(pool,{
      ...args,actionId:'turn-finish-skip-choice-0002',
      expectedRevision:rev+1})).status,'already-finished');
    assert.equal((await finishPaidWildTurnEncounter(pool,{
      ...args,choice:'poke-ball'})).status,'already-finished');
    assert.equal((await finishPaidWildEncounter(pool,{
      ...args,actionId:'turn-finish-legacy-0001',
      expectedRevision:rev+1})).status,'unavailable',
      'old auto-preview finalizer must be unavailable after turn completion');
    const after=await pool.query(
      'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
    assert.equal(Number(after.rows[0].revision),rev+1);
    assert.deepEqual(JSON.parse(after.rows[0].state.journal.raw),paidRaw,
      'skip must not change coins, XP, balls, Pokémon or badges');
    const encounter=await pool.query(
      `SELECT status,final_action_id,battle_preview,battle_sealed_outcome,
              battle_turn_payout_action_id,battle_turn_final_action_id,
              battle_turn_final_choice,battle_turn_final_revision,
              battle_turn_final_result FROM game_encounter_reservations
         WHERE id=$1`,[ids.encounterId]);
    assert.equal(encounter.rows[0].status,'completed');
    assert.equal(encounter.rows[0].final_action_id,null);
    assert.equal(encounter.rows[0].battle_preview,null);
    assert.equal(encounter.rows[0].battle_sealed_outcome,null);
    assert.ok(encounter.rows[0].battle_turn_payout_action_id);
    assert.equal(encounter.rows[0].battle_turn_final_action_id,args.actionId);
    assert.equal(encounter.rows[0].battle_turn_final_choice,'skip');
    assert.equal(Number(encounter.rows[0].battle_turn_final_revision),rev+1);
    assert.deepEqual(encounter.rows[0].battle_turn_final_result,race[0].result);
    await assert.rejects(pool.query(
      'UPDATE game_encounter_reservations SET battle_turn_final_result=NULL WHERE id=$1',
      [ids.encounterId]),e=>e.code==='23514');
    await assert.rejects(pool.query(
      "UPDATE game_encounter_reservations SET status='reserved' WHERE id=$1",
      [ids.encounterId]),e=>e.code==='23514');
    const receipts=await pool.query(
      "SELECT kind FROM game_action_receipts WHERE account_id=$1 AND kind='wild-turn-finish'",
      [accountId]);
    assert.equal(receipts.rowCount,1);
    const next=await reserveEncounter(pool,{
      accountId,actionId:'turn-finish-skip-next-0001',
      expectedRevision:rev+1,regionId:1});
    assert.equal(next.status,'reserved');
    assert.equal((await finishPaidWildTurnEncounter(pool,{
      ...args,expectedRevision:0,
      entropyKey:Buffer.alloc(32,0x05)})).status,'replay',
      'committed finalization must replay after next encounter without reroll');
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});

test('ONLINE-01C-22: winning turn encounter captures or fails exactly once',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {buildBattleSnapshot,prepareReservedBattle}=
    await import('../src/battlePreparation.mjs');
  const {loadCombatAdapter}=await import('../src/battlePreview.mjs');
  const {createPrivateBattleRandom}=await import('../src/battleEntropy.mjs');
  const {startReservedWildTurnSession}=await import('../src/wildTurnSession.mjs');
  const {applyReservedWildTurn}=await import('../src/wildTurnAction.mjs');
  const {certifyResolvedWildTurn}=await import('../src/wildTurnCertificate.mjs');
  const {payCertifiedWildTurns}=await import('../src/wildTurnSettlement.mjs');
  const {finishPaidWildTurnEncounter}=await import('../src/wildTurnFinalization.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  const core=await loadCombatAdapter();
  const accounts=[];
  try{
    for(const [target,species] of [['captured',10],['failed',4]]){
      const account=await pool.query(
        'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
        ['turn-finish-'+target+'-'+process.pid+'@example.test','x'.repeat(48)]);
      const accountId=account.rows[0].id;
      accounts.push(accountId);
      const first=firstSave('Turn '+target+' CI',4,1740000000000);
      const original=JSON.parse(first.journal.raw);
      original.roster[0].level=20; // deliberately experienced CI fixture
      first.journal.raw=JSON.stringify(original);
      await pool.query(
        'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
        [accountId,JSON.stringify(first)]);
      const booked=await reserveEncounter(pool,{
        accountId,actionId:'turn-final-'+target+'-reserve-0001',
        expectedRevision:0,regionId:1});
      assert.equal(booked.status,'reserved');
      const ids={accountId,encounterId:booked.encounterId};
      // Select a CI-only secret that deterministically exercises capture OR
      // failed throw for a legitimate R1 species. Production never lets
      // callers choose this seed, encounter species, level or capture roll.
      const trialSnapshot=buildBattleSnapshot(first,{
        regionId:1,speciesId:species,level:2});
      assert.ok(trialSnapshot);
      let key=null;
      for(let byte=1;byte<=140;byte++){
        const candidateKey=Buffer.alloc(32,byte);
        const trialSeed=createPrivateBattleRandom(candidateKey,{
          ...ids,phase:'wild-turn-capture'
        }).integer(2**32);
        const projected=core.finalizeFrozenWildEncounter(
          first.journal.raw,trialSnapshot,{
            outcome:'win',wildRemainingHp:0,log:[],frames:[]
          },'poke-ball',trialSeed,1740000000000);
        if(projected?.result?.outcome===target){key=candidateKey;break;}
      }
      assert.ok(key,'a deterministic test seed must exercise '+target);
      assert.equal((await materializeReservedEncounter(pool,{
        ...ids,entropyKey:key})).status,'materialized');
      await pool.query(
        'UPDATE game_encounter_reservations SET species_id=$2,pokemon_level=2 WHERE id=$1',
        [ids.encounterId,species]);
      const prepared=await prepareReservedBattle(pool,ids);
      assert.equal(prepared.status,'prepared');
      const started=await startReservedWildTurnSession(pool,{
        ...ids,expectedRevision:1});
      assert.equal(started.status,'started');
      let rev=1,session=started.turnState,turn=0;
      while(session.phase==='await-player'&&turn<30){
        turn++;
        const applied=await applyReservedWildTurn(pool,{
          ...ids,actionId:'turn-final-'+target+'-step-'+String(turn).padStart(4,'0'),
          expectedRevision:rev,action:{kind:'basic'},entropyKey:key});
        assert.equal(applied.status,'applied');
        rev=applied.revision;
        const row=await pool.query(
          'SELECT battle_turn_state FROM game_encounter_reservations WHERE id=$1',
          [ids.encounterId]);
        session=row.rows[0].battle_turn_state;
      }
      assert.equal(session.phase,'resolved');
      assert.equal(session.outcome,'win','strong starter must win CI-only battle');
      const cert=await certifyResolvedWildTurn(pool,{
        ...ids,actionId:'turn-final-'+target+'-certificate-0001',
        expectedRevision:rev});
      assert.equal(cert.status,'certified');
      rev=cert.revision;
      const payout=await payCertifiedWildTurns(pool,{
        ...ids,actionId:'turn-final-'+target+'-payout-0001',
        expectedRevision:rev,entropyKey:key});
      assert.equal(payout.status,'paid');
      rev=payout.revision;
      const before=await pool.query('SELECT state FROM game_saves WHERE account_id=$1',
        [accountId]);
      const paidRaw=JSON.parse(before.rows[0].state.journal.raw);
      const args={...ids,actionId:'turn-final-'+target+'-ball-0001',
        expectedRevision:rev,choice:'poke-ball',entropyKey:key};
      // A forged payout quote may not authorize capture.
      const payoutRow=await pool.query(
        'SELECT battle_turn_payout_quote FROM game_encounter_reservations WHERE id=$1',
        [ids.encounterId]);
      await pool.query(
        `UPDATE game_encounter_reservations
            SET battle_turn_payout_quote=jsonb_set(battle_turn_payout_quote,'{coins}','99999'::jsonb)
          WHERE id=$1`,[ids.encounterId]);
      assert.equal((await finishPaidWildTurnEncounter(pool,args)).status,
        'invalid-payout','tampered reward quote must block capture');
      await pool.query(
        'UPDATE game_encounter_reservations SET battle_turn_payout_quote=$2::jsonb WHERE id=$1',
        [ids.encounterId,JSON.stringify(payoutRow.rows[0].battle_turn_payout_quote)]);
      // A forged original transcript blocks finalization even after payout.
      const event=await pool.query(
        'SELECT turn_result FROM game_wild_turn_receipts WHERE encounter_id=$1 AND turn_number=1',
        [ids.encounterId]);
      await pool.query(
        `UPDATE game_wild_turn_receipts
            SET turn_result=jsonb_set(turn_result,'{logDelta}','["forged"]'::jsonb)
          WHERE encounter_id=$1 AND turn_number=1`,[ids.encounterId]);
      assert.equal((await finishPaidWildTurnEncounter(pool,args)).status,
        'invalid-history');
      await pool.query(
        'UPDATE game_wild_turn_receipts SET turn_result=$2::jsonb WHERE encounter_id=$1 AND turn_number=1',
        [ids.encounterId,JSON.stringify(event.rows[0].turn_result)]);
      const race=await Promise.all([
        finishPaidWildTurnEncounter(pool,args),
        finishPaidWildTurnEncounter(pool,args)
      ]);
      assert.deepEqual(race.map(x=>x.status).sort(),['finished','replay']);
      assert.deepEqual(race[0].result,race[1].result);
      assert.equal(race[0].result.outcome,target);
      assert.equal(race[0].result.speciesId,species);
      assert.equal(race[0].result.ballId,'poke-ball');
      assert.equal((await finishPaidWildTurnEncounter(pool,{
        ...args,actionId:'turn-final-'+target+'-ball-0002',
        expectedRevision:rev+1})).status,'already-finished');
      assert.equal((await finishPaidWildTurnEncounter(pool,{
        ...args,choice:'skip'})).status,'already-finished');
      const saved=await pool.query(
        'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
      assert.equal(Number(saved.rows[0].revision),rev+1);
      const after=JSON.parse(saved.rows[0].state.journal.raw);
      assert.equal(after.ballPocket.quantities['poke-ball'],
        paidRaw.ballPocket.quantities['poke-ball']-1,
        'exactly one ball must be spent even on a failed capture');
      assert.equal(after.coins,paidRaw.coins);
      assert.equal(after.trainer.xp,paidRaw.trainer.xp);
      assert.equal(after.roster[0].xp,paidRaw.roster[0].xp);
      assert.equal(after.roster[0].affinity,paidRaw.roster[0].affinity);
      assert.deepEqual(after.badges,paidRaw.badges);
      if(target==='captured'){
        assert.equal(race[0].result.caughtUid,paidRaw.nextUid);
        assert.equal(after.roster.length,paidRaw.roster.length+1);
        assert.equal(after.nextUid,paidRaw.nextUid+1);
        assert.equal(after.roster.at(-1).uid,paidRaw.nextUid);
        assert.equal(after.roster.at(-1).pokemonId,species);
        assert.ok(after.seen.includes(species));
        assert.ok(after.caughtSpecies.includes(species));
      }else{
        assert.equal(race[0].result.caughtUid,null);
        assert.equal(after.roster.length,paidRaw.roster.length);
        assert.equal(after.nextUid,paidRaw.nextUid);
        assert.deepEqual(after.caughtSpecies,paidRaw.caughtSpecies);
      }
      const finalized=await pool.query(
        `SELECT status,final_action_id,battle_preview,
                battle_turn_final_action_id,battle_turn_final_choice,
                battle_turn_final_result FROM game_encounter_reservations WHERE id=$1`,
        [ids.encounterId]);
      assert.equal(finalized.rows[0].status,'completed');
      assert.equal(finalized.rows[0].final_action_id,null);
      assert.equal(finalized.rows[0].battle_preview,null);
      assert.equal(finalized.rows[0].battle_turn_final_action_id,args.actionId);
      assert.equal(finalized.rows[0].battle_turn_final_choice,'poke-ball');
      assert.deepEqual(finalized.rows[0].battle_turn_final_result,race[0].result);
      const receipts=await pool.query(
        "SELECT count(*)::int AS n FROM game_action_receipts WHERE account_id=$1 AND kind='wild-turn-finish'",
        [accountId]);
      assert.equal(receipts.rows[0].n,1);
      const next=await reserveEncounter(pool,{
        accountId,actionId:'turn-final-'+target+'-next-0001',
        expectedRevision:rev+1,regionId:1});
      assert.equal(next.status,'reserved',
        'the next encounter must unlock whether capture succeeded or failed');
      assert.equal((await finishPaidWildTurnEncounter(pool,{
        ...args,expectedRevision:0,entropyKey:Buffer.alloc(32,0xdf)})).status,
        'replay','a final receipt must be stable after key rotation');
    }
  }finally{
    for(const accountId of accounts)
      await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});


test('ONLINE-01C-23A: private FRLG four-move equip, frozen turn combat and safe receipts',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {equipPokemonMoves}=await import('../src/pokemonMoveEquipment.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {startReservedWildTurnSession}=await import('../src/wildTurnSession.mjs');
  const {applyReservedWildTurn}=await import('../src/wildTurnAction.mjs');
  const {certifyResolvedWildTurn}=await import('../src/wildTurnCertificate.mjs');
  const {payCertifiedWildTurns}=await import('../src/wildTurnSettlement.mjs');
  const {finishPaidWildTurnEncounter}=await import('../src/wildTurnFinalization.mjs');
  const {loadCombatAdapter}=await import('../src/battlePreview.mjs');
  const core=await loadCombatAdapter();
  const learned=['thunder-shock','quick-attack','thunder-wave','growl'];
  assert.equal(core.frozenValidatedEquippedMoves(25,1,learned),null,
    'level-up moves are not automatically unlocked at level one');
  assert.equal(core.frozenValidatedEquippedMoves(25,20,
    ['thunder-shock','hydro-pump']),null,'cross-species move must fail');
  assert.equal(core.frozenValidatedEquippedMoves(25,20,
    ['thunder-shock','thunder-shock']),null,'duplicate equipment must fail');
  assert.deepEqual(core.frozenValidatedEquippedMoves(25,20,learned)
    .map(x=>x.name),learned);
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const registered=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['move-equipment-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=registered.rows[0].id;
    const save=firstSave('Loadout CI',4,1740000000000);
    const raw=JSON.parse(save.journal.raw);
    // CI-only fixture: experienced Pikachu with its verified FRLG moves.
    raw.roster[0].pokemonId=25;
    raw.roster[0].level=20;
    raw.roster[0].moveName='thunder-shock';
    raw.seen=[25];raw.caughtSpecies=[25];
    save.journal.raw=JSON.stringify(raw);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(save)]);
    const action={accountId,actionId:'move-equip-four-slots-0001',
      expectedRevision:0,pokemonUid:1,moveNames:learned};
    assert.equal((await equipPokemonMoves(pool,{
      ...action,expectedRevision:7})).status,'stale');
    assert.equal((await equipPokemonMoves(pool,{
      ...action,moveNames:['hydro-pump']})).status,'illegal-moves');
    assert.equal((await equipPokemonMoves(pool,{
      ...action,moveNames:['thunder-shock','thunderbolt']})).status,'illegal-moves',
      'future/TM moves are not included in approved online learnset');
    assert.equal((await equipPokemonMoves(pool,{
      ...action,pokemonUid:88})).status,'missing-pokemon');
    assert.equal((await equipPokemonMoves(pool,{
      ...action,moveNames:['thunder-shock','thunder-shock']})).status,'invalid');
    assert.equal((await equipPokemonMoves(pool,{
      ...action,moveNames:['growl']})).status,'illegal-moves',
      'an equipped loadout must preserve at least one offensive move');
    const concurrent=await Promise.all([
      equipPokemonMoves(pool,action),equipPokemonMoves(pool,action)
    ]);
    assert.deepEqual(concurrent.map(x=>x.status).sort(),['equipped','replay']);
    assert.deepEqual(concurrent[0].moveNames,concurrent[1].moveNames);
    assert.equal(concurrent[0].revision,1);
    assert.equal((await equipPokemonMoves(pool,{
      ...action,moveNames:learned.slice().reverse()})).status,'duplicate-action');
    assert.equal((await equipPokemonMoves(pool,{
      ...action,actionId:'move-equip-other-id-0001',expectedRevision:0})).status,'stale');
    const afterEquip=await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
    assert.equal(Number(afterEquip.rows[0].revision),1);
    const fromRaw=JSON.parse(afterEquip.rows[0].state.journal.raw);
    assert.equal(fromRaw.roster[0].moveName,learned[0]);
    assert.deepEqual(fromRaw.roster[0].equippedMoveNames,learned);
    assert.equal(fromRaw.coins,raw.coins);
    assert.equal(fromRaw.trainer.xp,raw.trainer.xp);
    assert.deepEqual(fromRaw.team,raw.team);
    assert.deepEqual(fromRaw.ballPocket,raw.ballPocket);
    assert.deepEqual(fromRaw.badges,raw.badges);
    const receipts=await pool.query(
      'SELECT pokemon_uid,move_names,save_revision FROM game_pokemon_move_equip_receipts WHERE account_id=$1',
      [accountId]);
    assert.equal(receipts.rowCount,1);
    assert.equal(Number(receipts.rows[0].pokemon_uid),1);
    assert.deepEqual(receipts.rows[0].move_names,learned);
    await assert.rejects(pool.query(
      `UPDATE game_pokemon_move_equip_receipts
          SET move_names='[]'::jsonb WHERE account_id=$1`,[accountId]),e=>e.code==='23514');
    const reservation=await reserveEncounter(pool,{
      accountId,actionId:'loadout-pg-reservation-0001',
      expectedRevision:1,regionId:1});
    assert.equal(reservation.status,'reserved');
    const ids={accountId,encounterId:reservation.encounterId};
    const key=Buffer.alloc(32,0x64);
    assert.equal((await equipPokemonMoves(pool,{
      ...action,actionId:'move-equip-in-battle-0001',
      expectedRevision:2,moveNames:['thunder-shock']})).status,'busy',
      'loadout must remain frozen during the whole reservation, even pre-battle');
    assert.equal((await materializeReservedEncounter(pool,{
      ...ids,entropyKey:key})).status,'materialized');
    const prepared=await prepareReservedBattle(pool,ids);
    assert.equal(prepared.status,'prepared');
    assert.equal(prepared.snapshot.version,2);
    assert.deepEqual(prepared.snapshot.activePokemon.moveNames,learned);
    assert.deepEqual(core.canonicalFrozenCombatants(prepared.snapshot)
      .player.moves.map(x=>x.name),learned);
    const forged={...prepared.snapshot,
      activePokemon:{...prepared.snapshot.activePokemon,
        moveNames:['thunder-shock','hydro-pump']}};
    assert.equal(core.canonicalFrozenCombatants(forged),null);
    assert.equal(core.createFrozenWildTurnSession(forged),null);
    const started=await startReservedWildTurnSession(pool,{
      ...ids,expectedRevision:2});
    assert.equal(started.status,'started');
    assert.deepEqual(started.turnState.player.equippedMoves,learned);
    assert.deepEqual(started.actions.filter(a=>a.kind==='move')
      .map(a=>a.moveName),learned);
    const invalid=await applyReservedWildTurn(pool,{
      ...ids,actionId:'loadout-turn-illegal-0001',expectedRevision:2,
      action:{kind:'move',moveName:'hydro-pump'},entropyKey:key});
    assert.equal(invalid.status,'blocked');
    let rev=2,session=started.turnState,ordinal=0;
    while(session.phase==='await-player'&&ordinal<30){
      ordinal++;
      // Opponent and turn RNG vary per reservation. Use an available
      // equipped attack rather than assuming Quick Attack always has SP.
      const legal=core.legalFrozenWildTurnActions(prepared.snapshot,session);
      assert.ok(Array.isArray(legal)&&legal.length>0);
      const desired=ordinal===1?'thunder-wave':'quick-attack';
      const permitted=legal.find(a=>a.kind==='move'&&a.moveName===desired);
      if(ordinal===1)assert.ok(permitted,'Thunder Wave must be legal on the first turn');
      const chosen=permitted?{kind:'move',moveName:desired}:{kind:'basic'};
      assert.ok(legal.some(a=>a.kind===chosen.kind&&(chosen.kind!=='move'||a.moveName===chosen.moveName)));
      const applied=await applyReservedWildTurn(pool,{
        ...ids,actionId:'loadout-pg-turn-'+String(ordinal).padStart(4,'0'),
        expectedRevision:rev,action:chosen,entropyKey:key});
      assert.equal(applied.status,'applied',applied.reason??applied.status);
      rev=applied.revision;
      const current=await pool.query(
        'SELECT battle_turn_state FROM game_encounter_reservations WHERE id=$1',
        [ids.encounterId]);
      session=current.rows[0].battle_turn_state;
    }
    assert.equal(session.phase,'resolved');
    assert.equal(session.outcome,'win','level 20 Pikachu vs R1 should win');
    const certified=await certifyResolvedWildTurn(pool,{
      ...ids,actionId:'loadout-pg-certificate-0001',expectedRevision:rev});
    assert.equal(certified.status,'certified');
    rev=certified.revision;
    const payout=await payCertifiedWildTurns(pool,{
      ...ids,actionId:'loadout-pg-payout-0001',expectedRevision:rev,entropyKey:key});
    assert.equal(payout.status,'paid');
    rev=payout.revision;
    const finish=await finishPaidWildTurnEncounter(pool,{
      ...ids,actionId:'loadout-pg-finish-0001',expectedRevision:rev,
      choice:'skip',entropyKey:key});
    assert.equal(finish.status,'finished');
    rev=finish.revision;
    assert.equal(finish.result.outcome,'skipped');
    const nextEquip=await equipPokemonMoves(pool,{
      ...action,actionId:'move-equip-after-finish-0001',
      expectedRevision:rev,moveNames:['thunder-shock','growl']});
    assert.equal(nextEquip.status,'equipped',
      'completion releases Pokémon equipment writer');
    assert.equal(nextEquip.revision,rev+1);
    const snapshot=await pool.query('SELECT state FROM game_saves WHERE account_id=$1',[accountId]);
    const end=JSON.parse(snapshot.rows[0].state.journal.raw);
    assert.deepEqual(end.roster[0].equippedMoveNames,['thunder-shock','growl']);
    assert.equal(end.roster[0].moveName,'thunder-shock');
    assert.equal(end.roster[0].pokemonId,25);
    assert.deepEqual(end.badges,[]);
    const acctReceipts=await pool.query(
      "SELECT kind FROM game_action_receipts WHERE account_id=$1 AND kind='pokemon-moves-equip'",
      [accountId]);
    assert.equal(acctReceipts.rowCount,2,'only each equipment change is receipted');
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});


test('ONLINE-01C-23 correction: a stored 3-member Gym team has only ONE regional fighter',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {materializeReservedEncounter}=await import('../src/encounterMaterialization.mjs');
  const {prepareReservedBattle}=await import('../src/battlePreparation.mjs');
  const {startReservedWildTurnSession}=await import('../src/wildTurnSession.mjs');
  const {applyReservedWildTurn}=await import('../src/wildTurnAction.mjs');
  const {loadCombatAdapter}=await import('../src/battlePreview.mjs');
  const core=await loadCombatAdapter();
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const inserted=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['regional-one-fighter-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=inserted.rows[0].id;
    const save=firstSave('Regional Single CI',4,1740000000000);
    const raw=JSON.parse(save.journal.raw);
    raw.roster.push({...structuredClone(raw.roster[0]),uid:2,pokemonId:25,
      level:20,moveName:'thunder-shock'});
    raw.roster.push({...structuredClone(raw.roster[0]),uid:3,pokemonId:7,
      level:20,moveName:'tackle'});
    raw.team=[1,2,3];raw.nextUid=4;
    save.journal.raw=JSON.stringify(raw);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(save)]);
    const reserved=await reserveEncounter(pool,{
      accountId,actionId:'regional-single-booking-0001',
      expectedRevision:0,regionId:1});
    assert.equal(reserved.status,'reserved');
    const ids={accountId,encounterId:reserved.encounterId};
    const key=Buffer.alloc(32,0x69);
    assert.equal((await materializeReservedEncounter(pool,{
      ...ids,entropyKey:key})).status,'materialized');
    const prepared=await prepareReservedBattle(pool,ids);
    assert.equal(prepared.status,'prepared');
    assert.equal(prepared.snapshot.version,1);
    assert.equal(prepared.snapshot.activePokemon.uid,1);
    assert.equal(Object.hasOwn(prepared.snapshot,'party'),false);
    assert.equal(Object.hasOwn(prepared.snapshot,'playerParty'),false);
    const started=await startReservedWildTurnSession(pool,{
      ...ids,expectedRevision:1});
    assert.equal(started.status,'started');
    assert.equal(Object.hasOwn(started.turnState,'playerParty'),false);
    assert.equal(started.turnState.player.uid,1);
    assert.equal(started.actions.some(a=>a.kind==='switch'),false);
    assert.equal(core.legalFrozenWildTurnActions(
      prepared.snapshot,started.turnState).some(a=>a.kind==='switch'),false);
    const illegal=await applyReservedWildTurn(pool,{
      ...ids,actionId:'regional-single-switch-0001',
      expectedRevision:1,action:{kind:'switch',toIndex:1},entropyKey:key});
    assert.equal(illegal.status,'invalid');
    const after=await pool.query('SELECT revision,state FROM game_saves WHERE account_id=$1',
      [accountId]);
    assert.equal(Number(after.rows[0].revision),1,
      'invalid bench switch must never consume a turn or save revision');
    assert.deepEqual(JSON.parse(after.rows[0].state.journal.raw).team,[1,2,3]);
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});


test('ONLINE-01C-23B2A: Collection team writer owns ordered UIDs, receipts and R1 solo lead',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {setCollectionTeam}=await import('../src/collectionTeam.mjs');
  const {buildBattleSnapshot}=await import('../src/battlePreparation.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {loadCombatAdapter}=await import('../src/battlePreview.mjs');
  const core=await loadCombatAdapter();
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const inserted=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['collection-team-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=inserted.rows[0].id;
    const save=firstSave('Coleção CI',4,1740000000000);
    const raw=JSON.parse(save.journal.raw);
    raw.roster.push({...structuredClone(raw.roster[0]),uid:2,
      pokemonId:25,level:20,moveName:'thunder-shock'});
    raw.roster.push({...structuredClone(raw.roster[0]),uid:3,
      pokemonId:7,level:10,moveName:'tackle'});
    raw.nextUid=4;
    save.journal.raw=JSON.stringify(raw);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(save)]);
    const action={accountId,expectedRevision:0,
      actionId:'collection-team-set-0001',teamUids:[2,3,1]};
    for(const bad of [
      {...action,teamUids:[]},
      {...action,teamUids:[1,1]},
      {...action,teamUids:[1,2,3,4]},
      {...action,teamUids:[1,'2']},
      {...action,teamUids:[-1]},
      {...action,teamUids:[1,1.2]},
      {...action,actionId:'no'},
      {...action,expectedRevision:-1}
    ])assert.equal((await setCollectionTeam(pool,bad)).status,'invalid');
    assert.equal((await setCollectionTeam(pool,{
      ...action,teamUids:[999]})).status,'missing-pokemon');
    assert.equal((await setCollectionTeam(pool,{
      ...action,expectedRevision:7})).status,'stale');
    const committed=await setCollectionTeam(pool,action);
    assert.deepEqual(committed,{status:'set',revision:1,teamUids:[2,3,1]});
    assert.deepEqual(await setCollectionTeam(pool,action),
      {status:'replay',revision:1,teamUids:[2,3,1]});
    assert.equal((await setCollectionTeam(pool,{
      ...action,teamUids:[3,2,1]})).status,'duplicate-action');
    const row=await pool.query(
      'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
    const stored=row.rows[0].state,game=JSON.parse(stored.journal.raw);
    assert.equal(Number(row.rows[0].revision),1);
    assert.deepEqual(game.team,[2,3,1]);
    assert.deepEqual(game.roster,raw.roster);
    assert.deepEqual(game.trainer,raw.trainer);
    assert.deepEqual(game.badges,raw.badges);
    assert.deepEqual(game.ballPocket,raw.ballPocket);
    assert.equal(game.coins,0);
    const frozen=buildBattleSnapshot(stored,{regionId:1,speciesId:10,level:2});
    assert.equal(frozen.version,1);
    assert.equal(frozen.activePokemon.uid,2,'only selected team[0] fights in regions');
    assert.equal(frozen.activePokemon.speciesId,25);
    assert.equal(Object.hasOwn(frozen,'party'),false);
    assert.equal(Object.hasOwn(core.createFrozenWildTurnSession(frozen),'playerParty'),false);
    assert.equal(core.initialFrozenWildTurnActions(frozen).some(a=>a.kind==='switch'),
      false,'regional combat cannot use either bench member');
    const receipts=await pool.query(
      'SELECT team_uids,save_revision FROM game_collection_team_receipts WHERE account_id=$1',
      [accountId]);
    assert.deepEqual(receipts.rows[0].team_uids,[2,3,1]);
    assert.equal(Number(receipts.rows[0].save_revision),1);
    await assert.rejects(pool.query(
      `UPDATE game_collection_team_receipts
        SET team_uids='[]'::jsonb WHERE account_id=$1`,
      [accountId]),e=>e.code==='23514');

    // Only one CAS writer can win; the others must not mutate the roster.
    const race=await Promise.all([
      setCollectionTeam(pool,{accountId,actionId:'collection-team-race-0002',
        expectedRevision:1,teamUids:[1,2,3]}),
      setCollectionTeam(pool,{accountId,actionId:'collection-team-race-0003',
        expectedRevision:1,teamUids:[3,2,1]})
    ]);
    assert.deepEqual(race.map(r=>r.status).sort(),['set','stale']);
    assert.equal(race.find(r=>r.status==='set').revision,2);
    assert.equal((await setCollectionTeam(pool,action)).status,'replay',
      'an old receipt remains replayable after later revisions');
    assert.equal((await setCollectionTeam(pool,{
      accountId,actionId:race[0].status==='set'?
        'collection-team-race-0002':'collection-team-race-0003',
      expectedRevision:2,teamUids:[2,3,1]})).status,
      'duplicate-action','both winners must reject a changed action payload');
    const afterRace=await pool.query(
      'SELECT state FROM game_saves WHERE account_id=$1',[accountId]);
    const preBattleTeam=JSON.parse(afterRace.rows[0].state.journal.raw).team;
    assert.ok([[1,2,3],[3,2,1]].some(t=>JSON.stringify(t)===JSON.stringify(preBattleTeam)));

    const reserved=await reserveEncounter(pool,{
      accountId,actionId:'collection-team-battle-0001',
      expectedRevision:2,regionId:1});
    assert.equal(reserved.status,'reserved');
    const locked=await setCollectionTeam(pool,{
      accountId,actionId:'collection-team-locked-0001',
      expectedRevision:3,teamUids:[2,3,1]});
    assert.equal(locked.status,'busy',
      'even a leader swap before battle preparation would invalidate snapshot');
    const after=await pool.query(
      'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
    assert.equal(Number(after.rows[0].revision),3);
    assert.deepEqual(JSON.parse(after.rows[0].state.journal.raw).team,
      preBattleTeam);
    assert.equal((await pool.query(
      "SELECT count(*)::int AS n FROM game_action_receipts WHERE account_id=$1 AND kind='collection-team-set'",
      [accountId])).rows[0].n,2);
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});

test('ONLINE-01C-23B2A: Collection changes are forbidden during Gym, expedition and capture',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {setCollectionTeam}=await import('../src/collectionTeam.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const inserted=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['team-locks-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=inserted.rows[0].id;
    const save=firstSave('Gym Locks CI',1,1740000000000);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(save)]);
    const action={accountId,expectedRevision:0,
      actionId:'collection-team-lock-test',teamUids:[1]};
    const cases=[
      {gymSession:{version:1,gymId:'boulder',uids:[1,2,3]}},
      {expedition:{startedAt:1740000000000}},
      {pendingBattle:{regionId:1}},
      {lastBattle:{captureStatus:'available'}},
    ];
    for(const overlay of cases){
      const patched=structuredClone(save);
      patched.journal.raw=JSON.stringify({
        ...JSON.parse(save.journal.raw),...overlay});
      await pool.query(
        'UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',
        [accountId,JSON.stringify(patched)]);
      const result=await setCollectionTeam(pool,action);
      assert.equal(result.status,'busy',JSON.stringify(overlay));
      const observed=await pool.query(
        'SELECT state,revision FROM game_saves WHERE account_id=$1',[accountId]);
      assert.deepEqual(observed.rows[0].state,patched);
      assert.equal(Number(observed.rows[0].revision),0);
    }
    await pool.query('UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',
      [accountId,JSON.stringify(save)]);
    assert.equal((await setCollectionTeam(pool,{...action,teamUids:[2]})).status,
      'missing-pokemon',
      'a UID belonging only to another account is never owned here');
    await pool.query(
      `INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision)
       VALUES($1,$2,'wild-turn',0)`,
      [accountId,'collection-team-collision-001']);
    assert.equal((await setCollectionTeam(pool,{
      ...action,actionId:'collection-team-collision-001'})).status,
      'duplicate-action',
      'an existing ID from another writer cannot be repurposed as a team change');
    assert.deepEqual(await setCollectionTeam(pool,action),
      {status:'set',revision:1,teamUids:[1]});
    const receipt=await pool.query(
      'SELECT kind FROM game_action_receipts WHERE account_id=$1 AND action_id=$2',
      [accountId,action.actionId]);
    assert.equal(receipt.rows[0].kind,'collection-team-set');
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});


test('ONLINE-01C-23B2B: Gym preflight reads the stored Collection trio and canonical owned bonuses',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {setCollectionTeam}=await import('../src/collectionTeam.mjs');
  const {inspectNextGym}=await import('../src/gymPreparation.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const inserted=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['gym-bonus-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=inserted.rows[0].id;
    const save=firstSave('Brock CI',4,1740000000000);
    const raw=JSON.parse(save.journal.raw);
    const baseline=structuredClone(raw.roster[0]);
    raw.roster.push({...structuredClone(baseline),uid:2,
      pokemonId:7,level:20,moveName:'tackle',upgrades:{}});
    raw.roster.push({...structuredClone(baseline),uid:3,
      pokemonId:25,level:20,moveName:'thunder-shock',upgrades:{}});
    raw.seen=[4,7,25];
    raw.nextUid=4;
    save.journal.raw=JSON.stringify(raw);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(save)]);
    const query={accountId,expectedRevision:0};
    assert.equal((await inspectNextGym(pool,query)).status,'unavailable',
      'one Collection member cannot be treated as three Gym participants');
    assert.equal((await inspectNextGym(pool,{...query,
      teamUids:[1,2,3]})).status,'invalid',
      'no Gym-level team input is allowed');
    const selected=await setCollectionTeam(pool,{accountId,
      actionId:'gym-bonus-collection-team-0001',expectedRevision:0,
      teamUids:[2,3,1]});
    assert.equal(selected.status,'set');
    assert.equal((await inspectNextGym(pool,query)).status,'stale');
    const ready=await inspectNextGym(pool,{accountId,expectedRevision:1});
    assert.equal(ready.status,'ready');
    assert.equal(ready.revision,1);
    assert.equal(ready.preparation.gymId,'boulder');
    assert.equal(ready.preparation.leader,'Brock');
    assert.deepEqual(ready.preparation.teamUids,[2,3,1]);
    assert.deepEqual(ready.initialBattle.player.fighters.map(x=>x.uid),[2,3,1]);
    assert.deepEqual(ready.preparation.player.map(x=>x.combatant.speciesId),
      [7,25,4]);
    assert.deepEqual(ready.initialBattle.leader.fighters
      .map(x=>x.combatant.speciesId),[74,27,95]);
    assert.equal(ready.preparation.trainer.activeTitle,'aprendiz');
    assert.deepEqual(ready.preparation.trainer.equipment,[]);
    assert.equal(ready.preparation.trainer.totals.hp,1);
    assert.equal(ready.initialBattle.outcome,'ongoing');
    assert.ok(ready.initialBattle.player.fighters.every(x=>
      x.hp===x.combatant.stats.hp&&x.sp===x.maxSp));
    const checked=await pool.query(
      'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
    assert.equal(Number(checked.rows[0].revision),1);
    assert.deepEqual(checked.rows[0].state,
      {...save,revision:1,journal:{...save.journal,revision:1,
        raw:JSON.stringify({...raw,team:[2,3,1]})}},
      'Gym inspection is absolutely read-only and must never modify the save');
    const count=await pool.query(
      "SELECT count(*)::int AS n FROM game_action_receipts WHERE account_id=$1",
      [accountId]);
    assert.equal(count.rows[0].n,1,
      'only Collection writer created a receipt, no Gym start or prize');

    const setRaw=async(edit)=>{
      const res=await pool.query(
        'SELECT state FROM game_saves WHERE account_id=$1',[accountId]);
      const patched=structuredClone(res.rows[0].state);
      const content=JSON.parse(patched.journal.raw);
      edit(content);
      patched.journal.raw=JSON.stringify(content);
      await pool.query(
        'UPDATE game_saves SET state=$2::jsonb WHERE account_id=$1',
        [accountId,JSON.stringify(patched)]);
    };
    await setRaw(r=>{r.badges=['cascade']});
    assert.equal((await inspectNextGym(pool,{
      accountId,expectedRevision:1})).status,'unavailable',
      'out-of-order badges cannot mint trainer buffs');
    await setRaw(r=>{r.badges=[];r.trainer.title='mestre'});
    assert.equal((await inspectNextGym(pool,{
      accountId,expectedRevision:1})).status,'unavailable',
      'unearned master title cannot be used');
    await setRaw(r=>{r.trainer.title='aprendiz';r.trainer.equipped={hat:'cap'}});
    assert.equal((await inspectNextGym(pool,{
      accountId,expectedRevision:1})).status,'unavailable',
      'legacy equipment without an ownership ledger is not owned');
    await setRaw(r=>{
      r.inventory={version:1,ownedEquipment:{cap:1},extraBagSlots:0};
      r.badges=['boulder'];
    });
    const misty=await inspectNextGym(pool,{accountId,expectedRevision:1});
    assert.equal(misty.status,'ready');
    assert.equal(misty.preparation.gymId,'cascade');
    assert.deepEqual(misty.preparation.trainer.badges,['boulder']);
    assert.deepEqual(misty.preparation.trainer.equipment,
      [{slot:'hat',itemId:'cap'}]);
    assert.equal(misty.preparation.trainer.totals.hp,5,
      'apprentice hp1 + earned Boulder hp2 + owned cap hp2');
    assert.equal(misty.preparation.trainer.totals.defense,4);

    const pending=await reserveEncounter(pool,{accountId,
      actionId:'gym-bonus-regional-reserve-0001',expectedRevision:1,regionId:1});
    assert.equal(pending.status,'reserved');
    assert.equal((await inspectNextGym(pool,{
      accountId,expectedRevision:2})).status,'busy',
      'cannot prepare Gym while a Region encounter awaits capture or settlement');
    const after=await pool.query(
      'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
    assert.equal(Number(after.rows[0].revision),2);
    assert.deepEqual(JSON.parse(after.rows[0].state.journal.raw).team,
      [2,3,1]);
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});


test('ONLINE-01C-23B2C: Gym reservation freezes Collection trio, replays and blocks Regions',async()=>{
  const {firstSave}=await import('../src/initialAdventure.mjs');
  const {setCollectionTeam}=await import('../src/collectionTeam.mjs');
  const {reserveNextGym}=await import('../src/gymReservation.mjs');
  const {reserveEncounter}=await import('../src/encounterReservation.mjs');
  const {inspectNextGym}=await import('../src/gymPreparation.mjs');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId,httpChild;
  try{
    const created=await pool.query(
      'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
      ['gym-reserve-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=created.rows[0].id;
    const save=firstSave('Gym Reserve CI',4,1740000000000);
    const raw=JSON.parse(save.journal.raw);
    const base=structuredClone(raw.roster[0]);
    raw.roster.push({...structuredClone(base),uid:2,pokemonId:7,
      level:20,moveName:'tackle',upgrades:{}});
    raw.roster.push({...structuredClone(base),uid:3,pokemonId:25,
      level:20,moveName:'thunder-shock',upgrades:{}});
    raw.nextUid=4;
    raw.seen=[4,7,25];
    save.journal.raw=JSON.stringify(raw);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(save)]);
    const first={accountId,actionId:'gym-start-private-action-0001',
      expectedRevision:0};
    assert.equal((await reserveNextGym(pool,first)).status,'unavailable');
    assert.equal((await reserveNextGym(pool,{...first,teamUids:[1,2,3]})).status,'invalid');
    assert.equal((await reserveNextGym(pool,{...first,seed:123})).status,'invalid');
    assert.equal((await setCollectionTeam(pool,{accountId,
      actionId:'gym-start-select-in-collection-0001',expectedRevision:0,
      teamUids:[2,3,1]})).status,'set');
    const args={...first,expectedRevision:1};
    const race=await Promise.all([reserveNextGym(pool,args),reserveNextGym(pool,args)]);
    assert.deepEqual(race.map(x=>x.status).sort(),['replay','reserved']);
    assert.equal(race[0].gymReservationId,race[1].gymReservationId);
    assert.equal(race[0].revision,2);
    assert.deepEqual(race[0].teamUids,[2,3,1]);
    assert.equal(race[0].gymId,'boulder');
    // Real test-only HTTP: verified cookie resolves accountId from session;
    // browser cannot choose the trainer, team or a server RNG value.
    const {newSessionToken,tokenDigest,sessionCookie}=await import('../src/auth.mjs');
    await pool.query(
      'INSERT INTO game_profiles(account_id,trainer_name) VALUES($1,$2)',
      [accountId,'Gym Reserve CI']);
    const token=newSessionToken();
    await pool.query(
      `INSERT INTO game_auth_sessions(account_id,token_sha256,expires_at)
       VALUES($1,$2,now()+interval '1 hour')`,
      [accountId,tokenDigest(token)]);
    const authCookie=sessionCookie(token,{secure:false}).split(';')[0];
    const gymBase='http://127.0.0.1:23145';
    httpChild=spawn(process.execPath,['src/server.mjs'],{
      cwd:new URL('../',import.meta.url).pathname,
      env:{...process.env,PORT:'23145',NODE_ENV:'test',
        APP_ORIGIN:origin,ONLINE_REGISTRATION_ENABLED:'true',
        GYM_HMAC_ACTIVE_KEY_ID:'v1',
        GYM_HMAC_KEYRING_JSON:JSON.stringify({
          v1:Buffer.alloc(32,0x72).toString('base64'),
          v2:Buffer.alloc(32,0x73).toString('base64')
        })},
      stdio:'ignore'
    });
    let httpReady=false;
    for(let i=0;i<80;i++){
      try{if((await json(gymBase,'/health')).status===200){
        httpReady=true;break;
      }}catch{}
      await new Promise(done=>setTimeout(done,100));
    }
    assert.equal(httpReady,true,'test Gym HTTP server is ready');
    const reserveReplay=await json(gymBase,'/api/v1/gym/reserve','POST',{
      actionId:args.actionId,expectedRevision:args.expectedRevision
    },{Cookie:authCookie});
    assert.equal(reserveReplay.status,200);
    assert.equal(reserveReplay.data.status,'replay');
    assert.equal(reserveReplay.data.gymReservationId,race[0].gymReservationId);
    assert.deepEqual(reserveReplay.data.teamUids,[2,3,1]);
    const midGymTeam=await json(gymBase,'/api/v1/collection/team','POST',{
      actionId:'gym-mid-battle-team-forbidden-0001',
      expectedRevision:race[0].revision,teamUids:[3,1,2]
    },{Cookie:authCookie});
    assert.equal(midGymTeam.status,409);
    assert.equal(midGymTeam.data.error,'busy',
      'Collection cannot change the frozen Gym trio mid-battle');
    const frozen=await pool.query(
      'SELECT * FROM game_gym_reservations WHERE account_id=$1',[accountId]);
    assert.equal(frozen.rowCount,1);
    assert.deepEqual(frozen.rows[0].team_uids,[2,3,1]);
    assert.equal(frozen.rows[0].frozen_preparation.gymId,'boulder');
    assert.deepEqual(frozen.rows[0].frozen_battle.player.fighters.map(x=>x.uid),
      [2,3,1]);
    assert.equal(frozen.rows[0].frozen_battle.outcome,'ongoing');
    const {startReservedGymTurnSession}=await import('../src/gymTurnSession.mjs');
    const turnZeroArgs={accountId,gymReservationId:race[0].gymReservationId,
      expectedRevision:2};
    assert.equal((await startReservedGymTurnSession(pool,{
      ...turnZeroArgs,seed:42})).status,'invalid',
      'no browser RNG can be injected into Gym sessions');
    assert.equal((await startReservedGymTurnSession(pool,{
      ...turnZeroArgs,expectedRevision:0})).status,'stale');
    const started=await Promise.all([
      startReservedGymTurnSession(pool,turnZeroArgs),
      startReservedGymTurnSession(pool,turnZeroArgs)
    ]);
    assert.deepEqual(started.map(x=>x.status).sort(),['replay','started']);
    assert.deepEqual(started[0].turnState,started[1].turnState);
    assert.equal(started[0].turnState.turn,0);
    const startReplay=await json(gymBase,'/api/v1/gym/start','POST',{
      gymReservationId:race[0].gymReservationId,expectedRevision:0
    },{Cookie:authCookie});
    assert.equal(startReplay.status,200,'start HTTP returns existing turn zero');
    assert.equal(startReplay.data.status,'replay');
    assert.equal(startReplay.data.turnState.turn,0);
    assert.deepEqual(startReplay.data.turnState.player.fighters.map(f=>f.uid),
      [2,3,1]);
    assert.deepEqual(started[0].turnState.player.fighters.map(x=>x.uid),[2,3,1]);
    assert.ok(started[0].actions.some(a=>a.kind==='move'));
    assert.ok(started[0].turnState.player.fighters.every(x=>x.hp===x.combatant.stats.hp));
    const storedTurn=await pool.query(
      'SELECT turn_state,turn_started_at FROM game_gym_reservations WHERE id=$1',
      [race[0].gymReservationId]);
    assert.ok(storedTurn.rows[0].turn_started_at);
    assert.deepEqual(storedTurn.rows[0].turn_state,started[0].turnState);
    assert.equal((await startReservedGymTurnSession(pool,{
      ...turnZeroArgs,expectedRevision:0})).status,'replay',
      'turn-zero retries are immutable even with an old revision');
    const {applyReservedGymTurn}=await import('../src/gymTurnAction.mjs');
    const {createGymEntropyKeyring}=await import('../src/gymEntropyKeyring.mjs');
    const {applyGymTurnWithKeyring,auditGymWithKeyring}=await import(
      '../src/gymKeyedOperations.mjs');
    const key=Buffer.alloc(32,0x72),badKey=Buffer.alloc(32,0x73);
    const versions={v1:key.toString('base64'),v2:badKey.toString('base64')};
    const originalRing=createGymEntropyKeyring({activeId:'v1',keys:versions});
    const rotatedRing=createGymEntropyKeyring({activeId:'v2',keys:versions});
    const turnArgs={accountId,gymReservationId:race[0].gymReservationId,
      actionId:'gym-first-canonical-turn-0001',expectedRevision:2,
      action:{kind:'basic'},entropyKey:key};
    assert.equal((await applyReservedGymTurn(pool,{...turnArgs,
      action:{kind:'switch',toIndex:8}})).status,'invalid');
    assert.equal((await applyReservedGymTurn(pool,{...turnArgs,
      action:{kind:'move',moveName:'illegal-move'}})).status,'blocked');
    const keyedTurnArgs={
      accountId,gymReservationId:race[0].gymReservationId,
      actionId:turnArgs.actionId,expectedRevision:2,action:turnArgs.action
    };
    const turns=await Promise.all([
      json(gymBase,'/api/v1/gym/turn','POST',{
        gymReservationId:keyedTurnArgs.gymReservationId,
        actionId:keyedTurnArgs.actionId,
        expectedRevision:keyedTurnArgs.expectedRevision,
        action:keyedTurnArgs.action
      },{Cookie:authCookie}).then(response=>{
        assert.equal(response.status,200);
        return response.data;
      }),
      applyGymTurnWithKeyring(pool,originalRing,keyedTurnArgs)
    ]);
    assert.deepEqual(turns.map(x=>x.status).sort(),['applied','replay']);
    assert.deepEqual(turns[0].result,turns[1].result);
    assert.equal(turns[0].revision,3);
    assert.equal(turns[0].result.actionNumber,1);
    assert.ok(turns[0].result.turn>=0);
    assert.equal(Object.hasOwn(turns[0].result,'seed'),false);
    assert.equal(Object.hasOwn(turns[0].result,'seedAfter'),false);
    assert.deepEqual(turns[0].result.playerAction,{kind:'basic'});
    const httpReplay=await json(gymBase,'/api/v1/gym/turn','POST',{
      gymReservationId:keyedTurnArgs.gymReservationId,
      actionId:keyedTurnArgs.actionId,expectedRevision:0,
      action:keyedTurnArgs.action
    },{Cookie:authCookie});
    assert.equal(httpReplay.status,200);
    assert.equal(httpReplay.data.status,'replay');
    assert.deepEqual(httpReplay.data.result,turns[0].result);
    assert.equal((await json(gymBase,'/api/v1/gym/turn','POST',{
      gymReservationId:keyedTurnArgs.gymReservationId,
      actionId:'gym-forged-rng-in-body-0001',expectedRevision:3,
      action:{kind:'basic'},seed:1
    },{Cookie:authCookie})).status,400);
    assert.equal((await applyReservedGymTurn(pool,{...turnArgs,
      action:{kind:'focus'}})).status,'duplicate-action');
    assert.equal((await applyReservedGymTurn(pool,{...turnArgs,
      actionId:'gym-first-rotated-key-0001',expectedRevision:3,
      entropyKey:badKey})).status,'entropy-mismatch');
    const logged=await pool.query(
      'SELECT * FROM game_gym_turn_receipts WHERE account_id=$1',[accountId]);
    assert.equal(logged.rowCount,1);
    assert.equal(logged.rows[0].action_number,1);
    assert.deepEqual(logged.rows[0].turn_result,turns[0].result);
    const persisted=await pool.query(
      'SELECT turn_state,turn_entropy_proof FROM game_gym_reservations WHERE id=$1',
      [race[0].gymReservationId]);
    assert.deepEqual(persisted.rows[0].turn_state,turns[0].result.state);
    assert.match(persisted.rows[0].turn_entropy_proof,/^[0-9a-f]{64}$/);
    const pinned=await pool.query(
      'SELECT turn_entropy_key_id FROM game_gym_reservations WHERE id=$1',
      [race[0].gymReservationId]);
    assert.equal(pinned.rows[0].turn_entropy_key_id,'v1',
      'first authoritative turn pins the active server key version');
    assert.equal((await auditGymWithKeyring(pool,rotatedRing,{
      accountId,gymReservationId:race[0].gymReservationId
    })).status,'verified-progress',
      'rotating active key keeps historical replay deterministic');
    assert.equal((await auditGymWithKeyring(pool,
      createGymEntropyKeyring({activeId:'v2',keys:{v2:versions.v2}}),{
      accountId,gymReservationId:race[0].gymReservationId
    })).status,'historical-key-missing',
      'cannot silently replay under a new key after retiring v1');
    const {auditReservedGymBattle}=await import('../src/gymReplayAudit.mjs');
    const audited=await auditReservedGymBattle(pool,{
      accountId,gymReservationId:race[0].gymReservationId,entropyKey:key
    });
    assert.deepEqual(audited,{
      status:'verified-progress',turns:1,outcome:'ongoing',
      gymReservationId:race[0].gymReservationId,eligibleForBadge:false
    });
    assert.equal((await auditReservedGymBattle(pool,{
      accountId,gymReservationId:race[0].gymReservationId,entropyKey:badKey
    })).status,'entropy-mismatch');
    await pool.query(
      `UPDATE game_gym_turn_receipts SET
        turn_result=jsonb_set(turn_result,'{outcome}','"player-win"'::jsonb)
        WHERE gym_reservation_id=$1`,[race[0].gymReservationId]);
    assert.deepEqual((await auditReservedGymBattle(pool,{
      accountId,gymReservationId:race[0].gymReservationId,entropyKey:key
    })).status,'invalid-history');
    await pool.query(
      'UPDATE game_gym_turn_receipts SET turn_result=$2::jsonb WHERE gym_reservation_id=$1',
      [race[0].gymReservationId,JSON.stringify(turns[0].result)]);
    assert.equal((await auditReservedGymBattle(pool,{
      accountId,gymReservationId:race[0].gymReservationId,entropyKey:key
    })).status,'verified-progress');
    assert.equal((await applyReservedGymTurn(pool,{...turnArgs,
      expectedRevision:0})).status,'replay',
      'an old turn can be replayed without new attack or RNG');
    assert.equal((await reserveNextGym(pool,{...args,
      actionId:'gym-start-another-action-0001',expectedRevision:3})).status,'busy');
    assert.equal((await setCollectionTeam(pool,{accountId,
      actionId:'gym-start-change-team-0001',expectedRevision:3,
      teamUids:[1,3,2]})).status,'busy');
    assert.equal((await reserveEncounter(pool,{accountId,
      actionId:'gym-start-region-denied-0001',
      expectedRevision:3,regionId:1})).status,'busy');
    assert.equal((await inspectNextGym(pool,{
      accountId,expectedRevision:3})).status,'busy');
    const {equipPokemonMoves}=await import('../src/pokemonMoveEquipment.mjs');
    assert.equal((await equipPokemonMoves(pool,{
      accountId,actionId:'gym-reserve-loadout-block-0001',
      expectedRevision:3,pokemonUid:3,moveNames:['thunder-shock']
    })).status,'busy','a Gym lock freezes all equipped moves');
    const {applyTrainerInvestment}=await import('../src/trainerInvestment.mjs');
    assert.equal((await applyTrainerInvestment(pool,{
      accountId,actionId:'gym-reserve-stat-block-0001',
      expectedRevision:3,stat:'hp'
    })).status,'busy','a Gym lock freezes trainer bonuses');
    const unchanged=await pool.query(
      'SELECT revision,state FROM game_saves WHERE account_id=$1',[accountId]);
    assert.equal(Number(unchanged.rows[0].revision),3);
    assert.deepEqual(JSON.parse(unchanged.rows[0].state.journal.raw).team,[2,3,1]);
    assert.deepEqual(JSON.parse(unchanged.rows[0].state.journal.raw).badges,[]);
    const receipts=await pool.query(
      "SELECT kind FROM game_action_receipts WHERE account_id=$1 ORDER BY save_revision",
      [accountId]);
    assert.deepEqual(receipts.rows.map(x=>x.kind),
      ['collection-team-set','gym-reserve','gym-turn']);
    const {certifyReservedGymBattle}=await import('../src/gymCertificate.mjs');
    const certArgs={accountId,gymReservationId:race[0].gymReservationId,
      actionId:'gym-first-terminal-certificate-0001',
      expectedRevision:3,entropyKey:key};
    assert.equal((await certifyReservedGymBattle(pool,certArgs)).status,
      'not-terminal','a progress snapshot is never a certified victory');
    assert.equal((await certifyReservedGymBattle(pool,{
      ...certArgs,entropyKey:badKey})).status,'entropy-mismatch',
      'a different historical key cannot certify a Gym');
    // Resolve the original audited Gym engine until a real terminal result.
    // No fake winner, manual HP mutation, artificial DB state or client seed.
    let state=turns[0].result.state,legal=turns[0].result.nextActions;
    let currentRevision=3,extraTurns=0;
    while(state.outcome==='ongoing'&&extraTurns<139){
      const selected=legal.find(a=>a.kind==='move')||
        legal.find(a=>a.kind==='basic')||legal[0];
      assert.ok(selected,'ongoing Gym always requires a legal action');
      const result=await applyReservedGymTurn(pool,{
        accountId,gymReservationId:race[0].gymReservationId,
        actionId:'gym-audited-followup-'+String(++extraTurns).padStart(4,'0'),
        expectedRevision:currentRevision,action:selected,entropyKey:key
      });
      assert.equal(result.status,'applied');
      currentRevision=result.revision;
      state=result.result.state;
      legal=result.result.nextActions;
    }
    assert.notEqual(state.outcome,'ongoing','canonical Gym reached a terminal outcome');
    const certResponse=await json(gymBase,'/api/v1/gym/certify','POST',{
      actionId:certArgs.actionId,expectedRevision:currentRevision,
      gymReservationId:certArgs.gymReservationId
    },{Cookie:authCookie});
    assert.equal(certResponse.status,200);
    const certificate=certResponse.data;
    assert.equal(certificate.status,'certified');
    assert.equal(certificate.certificate.outcome,state.outcome);
    assert.match(certificate.certificate.digest,/^[0-9a-f]{64}$/);
    const certRetry=await json(gymBase,'/api/v1/gym/certify','POST',{
      actionId:certArgs.actionId,expectedRevision:0,
      gymReservationId:certArgs.gymReservationId
    },{Cookie:authCookie});
    assert.equal(certRetry.status,200);
    assert.equal(certRetry.data.status,'replay');
    assert.deepEqual(certRetry.data.certificate,certificate.certificate);
    assert.equal((await certifyReservedGymBattle(pool,{
      ...certArgs,actionId:'gym-second-terminal-certificate-0001',
      expectedRevision:certificate.revision})).status,'already-certified');
    assert.equal((await auditReservedGymBattle(pool,{
      accountId,gymReservationId:race[0].gymReservationId,entropyKey:key
    })).status,'verified-terminal');
    const rewardsStillZero=JSON.parse((await pool.query(
      'SELECT state FROM game_saves WHERE account_id=$1',[accountId]
    )).rows[0].state.journal.raw);
    assert.deepEqual(rewardsStillZero.badges,[],
      'certification cannot grant a Gym badge before a separate payout');
    // Settlement derives the SAME original Gym catalog and trainer XP
    // progression, and credits no badge for loss/draw.
    const {settleCertifiedGym}=await import('../src/gymSettlement.mjs');
    const payoutArgs={accountId,gymReservationId:race[0].gymReservationId,
      actionId:'gym-settle-terminal-outcome-0001',
      expectedRevision:certificate.revision,entropyKey:key};
    assert.equal((await settleCertifiedGym(pool,{
      ...payoutArgs,entropyKey:badKey})).status,'invalid-history');
    const httpPayout=()=>json(gymBase,'/api/v1/gym/settle','POST',{
      actionId:payoutArgs.actionId,expectedRevision:payoutArgs.expectedRevision,
      gymReservationId:payoutArgs.gymReservationId
    },{Cookie:authCookie}).then(response=>{
      assert.equal(response.status,200);
      return response.data;
    });
    const payouts=await Promise.all([
      httpPayout(),httpPayout()
    ]);
    assert.deepEqual(payouts.map(p=>p.status).sort(),['paid','replay']);
    assert.deepEqual(payouts[0].paid,payouts[1].paid);
    assert.equal(payouts[0].paid.outcome,state.outcome);
    assert.equal(payouts[0].paid.badgeId,
      state.outcome==='player-win'?'boulder':null);
    assert.equal(payouts[0].paid.coins,
      state.outcome==='player-win'?1500:0);
    assert.equal(payouts[0].paid.trainerXp,
      state.outcome==='player-win'?120:0);
    const deniedRepeat=await json(gymBase,'/api/v1/gym/settle','POST',{
      actionId:'gym-settle-again-blocked-0001',
      expectedRevision:payouts[0].revision,
      gymReservationId:payoutArgs.gymReservationId
    },{Cookie:authCookie});
    assert.equal(deniedRepeat.status,409);
    assert.equal(deniedRepeat.data.error,'already-paid');
    const afterPayout=JSON.parse((await pool.query(
      'SELECT state FROM game_saves WHERE account_id=$1',[accountId]
    )).rows[0].state.journal.raw);
    assert.deepEqual(afterPayout.badges,state.outcome==='player-win'?['boulder']:[]);
    assert.equal(afterPayout.coins,payouts[0].paid.coins);
    // Completion retains historical certificate for future audit.
    const kept=await pool.query(
      'SELECT certificate_outcome,certificate_digest FROM game_gym_reservations WHERE id=$1',
      [race[0].gymReservationId]);
    assert.equal(kept.rows[0].certificate_outcome,state.outcome);
    assert.equal(kept.rows[0].certificate_digest,certificate.certificate.digest);

  }finally{
    await stopChild(httpChild);
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});
