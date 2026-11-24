import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {signProxyIdentity} from '../src/proxyIdentity.mjs';
import {rateDigest} from '../src/authSecurity.mjs';

test('23E13: real auth routes, signed subjects and atomic replay across two API processes',async()=>{
  assert.equal(process.env.NODE_ENV,'test');
  const db=new URL(process.env.DATABASE_URL);
  assert.equal(db.protocol,'postgresql:');assert.equal(db.hostname,'127.0.0.1');
  assert.equal(db.port,'55432');assert.equal(db.pathname,'/kanto_ci');assert.equal(db.username,'kanto_ci');
  const suffix=randomBytes(8).toString('hex'),schema='proxy_http_ci_'+suffix;
  const pool=new pg.Pool({connectionString:db.href});
  let created=false;const children=[];
  const signingKey=randomBytes(32),subjectKey=randomBytes(32),secret=randomBytes(32).toString('hex');
  const origin='http://127.0.0.1:43172',path='/api/v1/auth/login';
  const body=(n)=>Buffer.from(JSON.stringify({email:'proxy-'+suffix+'-'+n+'@example.test',password:'no-account'}));
  const sign=(ip,bytes,route=path)=>signProxyIdentity({trustedClientIp:ip,subjectKey,signingKey,method:'POST',path:route,body:bytes});
  const call=async(port,bytes,assertion,extra={})=>{
    const res=await fetch('http://127.0.0.1:'+port+path,{method:'POST',headers:{
      'Content-Type':'application/json',Origin:origin,...(assertion?{'X-Kanto-Proxy-Identity':assertion}:{}),...extra},body:bytes});
    await res.json();return res.status;
  };
  try{
    assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'kanto_ci');
    await pool.query('CREATE SCHEMA '+schema);created=true;
    const fixture=new pg.Pool({connectionString:db.href,options:'-c search_path='+schema});
    try{await fixture.query(await readFile(new URL('./fixtures/proxy-nonce-test-schema.sql',import.meta.url),'utf8'));}
    finally{await fixture.end();}
    db.searchParams.set('options','-c search_path='+schema+',public');
    for(const port of [43172,43173]){
      const child=spawn(process.execPath,['src/server.mjs'],{cwd:new URL('../',import.meta.url).pathname,
        env:{...process.env,DATABASE_URL:db.href,NODE_ENV:'test',ONLINE_REGISTRATION_ENABLED:'true',
          ACCOUNT_DRILL_LOOPBACK_ONLY:'true',ACCOUNT_MAIL_MODE:'off',APP_ORIGIN:origin,PORT:String(port),
          AUTH_RATE_LIMIT_SECRET:secret,ONLINE_SIGNED_QUOTA_TEST_ONLY:'true',
          ONLINE_SIGNED_QUOTA_TEST_KEY:signingKey.toString('hex')},stdio:'ignore'});
      children.push(child);
      let ready=false;
      for(let i=0;i<100;i++){
        try{if((await fetch('http://127.0.0.1:'+port+'/health')).ok){ready=true;break;}}catch{}
        if(child.exitCode!==null)break;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      assert.ok(ready,'API harness failed to start');
    }
    const first=body(0),a=sign('192.0.2.10',first);
    assert.equal(await call(43172,first,null,{'X-Real-IP':'192.0.2.10'}),403);
    assert.equal(await call(43172,body(999),a),403);
    assert.equal(await call(43172,first,a,{Origin:'https://invalid.example'}),400);
    const race=await Promise.all([call(43172,first,a),call(43173,first,a)]);
    assert.deepEqual(race.sort(),[401,403]);
    assert.equal(await call(43173,first,a),403);
    for(let i=1;i<30;i++){
      const bytes=body(i);
      assert.equal(await call(i%2?43172:43173,bytes,sign('192.0.2.10',bytes),{'X-Real-IP':'198.51.100.1'}),401);
    }
    const blocked=body(30);
    assert.equal(await call(43173,blocked,sign('192.0.2.10',blocked)),429);
    const other=body(31);
    assert.equal(await call(43172,other,sign('192.0.2.11',other)),401);
    // Per-email quota remains shared even if caller has a different signed subject.
    const same=body(32);
    for(let i=0;i<6;i++)assert.equal(await call(43172,same,sign('198.51.100.'+(i+1),same)),401);
    assert.equal(await call(43173,same,sign('198.51.100.7',same)),429);
    const counts=await pool.query('SELECT attempts FROM game_auth_throttles WHERE scope=$1 AND subject_digest=$2',
      ['login-email',rateDigest('login-email','proxy-'+suffix+'-32@example.test',secret)]);
    assert.equal(counts.rows[0].attempts,7);
    // Test-only flag cannot enable auth in production.
    const child=spawn(process.execPath,['src/server.mjs'],{cwd:new URL('../',import.meta.url).pathname,
      env:{...process.env,DATABASE_URL:db.href,NODE_ENV:'production',ONLINE_REGISTRATION_ENABLED:'true',
        ACCOUNT_MAIL_MODE:'off',APP_ORIGIN:origin,PORT:'43174',ONLINE_SIGNED_QUOTA_TEST_ONLY:'true',
        ONLINE_SIGNED_QUOTA_TEST_KEY:signingKey.toString('hex')},stdio:'ignore'});
    children.push(child);
    let ready=false;
    for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:43174/health')).ok){ready=true;break;}}catch{}
      if(child.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,100));}
    assert.ok(ready);
    assert.equal(await call(43174,other,sign('192.0.2.11',other)),503);
  }finally{
    for(const child of children){if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill();await exited;}}
    if(created)await pool.query('DROP SCHEMA '+schema+' CASCADE');
    await pool.end();
  }
});
