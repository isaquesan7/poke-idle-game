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
    assert.equal(migrations.rows.length,13,'all migrations applied exactly once');
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
