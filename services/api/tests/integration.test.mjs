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
    assert.equal((await json(origin,'/api/v1/save','PUT',
      {coins:999999,badges:['boulder']},{Cookie:sessionCookie})).status,404,
      'clients cannot post arbitrary saves/rewards');
    const proof=await pool.query(
      'SELECT password_hash FROM game_accounts WHERE id=$1',[register.data.id]);
    assert.equal(proof.rowCount,1);
    assert.notEqual(proof.rows[0].password_hash,user.password);
    const saves=await pool.query('SELECT account_id FROM game_saves WHERE account_id=$1',
      [register.data.id]);
    assert.equal(saves.rowCount,0,'no import and no client-originated writes');
    const sessions=await pool.query(
      'SELECT octet_length(token_sha256) AS bytes FROM game_auth_sessions WHERE account_id=$1',
      [register.data.id]);
    assert.equal(sessions.rows[0].bytes,32);
    assert.equal((await json(origin,'/api/v1/auth/logout','POST',{},
      {Cookie:sessionCookie})).status,200);
    assert.equal((await json(origin,'/api/v1/me','GET',undefined,
      {Cookie:sessionCookie})).status,401);
    const migrations=await pool.query(
      'SELECT name FROM game_schema_migrations');
    assert.equal(migrations.rows.length,1,'migration applied exactly once');
  }finally{
    child.kill('SIGTERM');
    await pool.end();
  }
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
