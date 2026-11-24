import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {cleanExpiredProxyNonces} from '../src/proxyNonceMaintenance.mjs';
import {signProxyIdentity} from '../src/proxyIdentity.mjs';
import {consumeProxyIdentity,pruneProxyIdentityNonces} from '../src/proxyNonceGuard.mjs';

test('23E11: atomic cross-pool nonce consumption, freshness and bounded cleanup',async()=>{
  // This test is intentionally limited to the existing disposable CI service.
  assert.equal(process.env.NODE_ENV,'test');
  const url=new URL(process.env.DATABASE_URL);
  assert.equal(url.protocol,'postgresql:');
  assert.equal(url.hostname,'127.0.0.1');
  assert.equal(url.port,'55432');
  assert.equal(url.pathname,'/kanto_ci');
  assert.equal(url.username,'kanto_ci');
  const schema='proxy_nonce_ci_'+randomBytes(8).toString('hex');
  const admin=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let a,b,created=false;
  try{
    const db=await admin.query('SELECT current_database() AS name');
    assert.equal(db.rows[0].name,'kanto_ci');
    await admin.query('CREATE SCHEMA '+schema);created=true;
    const config={connectionString:process.env.DATABASE_URL,options:'-c search_path='+schema};
    a=new pg.Pool(config);b=new pg.Pool(config);
    await a.query(await readFile(new URL('../sql/026_proxy_identity_nonces.sql',import.meta.url),'utf8'));
    const signingKey=Buffer.alloc(32,1),subjectKey=Buffer.alloc(32,2);
    const method='POST',path='/api/v1/auth/login',body=Buffer.from('{}');
    const signed=(ip,nowMs=Date.now())=>{
      const assertion=signProxyIdentity({trustedClientIp:ip,signingKey,subjectKey,method,path,body,nowMs});
      return {assertion,signingKey,method,path,body,nowMs};
    };
    const first=signed('192.0.2.1');
    const results=await Promise.all(Array.from({length:16},(_,i)=>consumeProxyIdentity(i%2?a:b,first)));
    const accepted=results.filter(Boolean);
    assert.equal(accepted.length,1);
    assert.equal(await consumeProxyIdentity(b,first),null);
    const fresh=await consumeProxyIdentity(b,signed('192.0.2.1'));
    assert.equal(fresh.subject,accepted[0].subject);
    const other=await consumeProxyIdentity(a,signed('192.0.2.2'));
    assert.notEqual(other.subject,fresh.subject);
    // Even a deliberately stale application clock cannot override DB freshness.
    assert.equal(await consumeProxyIdentity(a,signed('192.0.2.1',Date.now()-60000)),null);
    assert.equal(await consumeProxyIdentity(b,signed('192.0.2.1',Date.now()+60000)),null);
    assert.equal(await consumeProxyIdentity(a,{...signed('192.0.2.1'),body:Buffer.from('tampered')}),null);
    const before=await a.query('SELECT count(*)::int AS n FROM game_proxy_identity_nonces');
    assert.equal(before.rows[0].n,3);
    const expired=randomBytes(32),recentlyExpired=randomBytes(32);
    await a.query(`INSERT INTO game_proxy_identity_nonces VALUES
      ($1,statement_timestamp()-interval '10 minutes'),
      ($2,statement_timestamp()-interval '1 minute')`,[expired,recentlyExpired]);
    assert.equal(await pruneProxyIdentityNonces(b,{limit:1}),1);
    assert.equal(await pruneProxyIdentityNonces(a),0);
    const after=await a.query('SELECT count(*)::int AS n FROM game_proxy_identity_nonces');
    assert.equal(after.rows[0].n,4);
    // Bounded cleanup across real pools, with fresh/recent rows protected.
    await a.query(`INSERT INTO game_proxy_identity_nonces(nonce_digest,expires_at)
      SELECT decode(lpad(to_hex(i),64,'0'),'hex'),statement_timestamp()-interval '10 minutes'
      FROM generate_series(1,11) i`);
    const sweep=await cleanExpiredProxyNonces(a,{batchSize:3,maxBatches:2});
    assert.deepEqual(sweep,{removed:6,batches:2,mayHaveBacklog:true});
    const rest=await Promise.all([cleanExpiredProxyNonces(a,{batchSize:2}),cleanExpiredProxyNonces(b,{batchSize:2})]);
    assert.equal(rest.reduce((sum,r)=>sum+r.removed,0),5);
    assert.equal((await a.query('SELECT count(*)::int AS n FROM game_proxy_identity_nonces')).rows[0].n,4);
    await assert.rejects(()=>a.query(`INSERT INTO game_proxy_identity_nonces VALUES
      ($1,'infinity'::timestamptz)`,[randomBytes(32)]),e=>e.code==='23514');
    await assert.rejects(()=>pruneProxyIdentityNonces(a,{limit:501}));
    await assert.rejects(()=>consumeProxyIdentity({query:async()=>{throw Error('DB unavailable');}},signed('192.0.2.1')),/DB unavailable/);
  }finally{
    if(a)await a.end();if(b)await b.end();
    if(created)await admin.query('DROP SCHEMA '+schema+' CASCADE');
    await admin.end();
  }
});
