import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import pg from 'pg';
import {mailKeyring,enqueueAccountMail,processOneAccountMail,claimAccountMail,
  decryptMailPayload,encryptMailPayload,reconcileAccountMail,accountMailMetrics} from '../src/accountMailOutbox.mjs';

const ring=mailKeyring({activeId:'testkey',
  keys:{testkey:Buffer.alloc(32,31).toString('base64')}});
const accountEmail='outbox-'+process.pid+'@example.test';
const recipient='recipient@ci.example.test';
const expiry=()=>new Date(Date.now()+30*60*1000);
function message(accountId,key,token,expiresAt=expiry()){
  return {accountId,idempotencyKey:key,purpose:'reset',
    to:recipient,token,origin:'https://game.example.test',expiresAt};
}
const token=()=>randomBytes(32).toString('base64url');

test('ONLINE-01C-23D0: encryption tamper failure and fail-closed keyring',()=>{
  assert.throws(()=>mailKeyring({activeId:'absent',keys:{other:Buffer.alloc(32).toString('base64')}}));
  assert.throws(()=>mailKeyring({activeId:'short',keys:{short:'abcd'}}));
  const data={to:recipient,token:token(),origin:'https://game.example.test'};
  const encrypted=encryptMailPayload(data,ring.keys.get('testkey'));
  assert.ok(!encrypted.includes(Buffer.from(recipient)));
  assert.deepEqual(decryptMailPayload(encrypted,ring.keys.get('testkey')),data);
  const tampered=Buffer.from(encrypted);tampered[tampered.length-1]^=1;
  assert.throws(()=>decryptMailPayload(tampered,ring.keys.get('testkey')));
});

test('ONLINE-01C-23D0: transactional queue, leases, idempotency, retry and isolated delivery',async()=>{
  assert.ok(process.env.DATABASE_URL,'Disposable PostgreSQL 18 CI only');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash) VALUES($1,$2) RETURNING id',
      [accountEmail,'x'.repeat(48)]);
    await pool.query('UPDATE game_accounts SET email_verified_at=now() WHERE id=$1',[account.rows[0].id]);
    accountId=account.rows[0].id;
    const expiresAt=expiry(), first=message(accountId,'reset/outbox-001',token(),expiresAt);
    await pool.query(`INSERT INTO game_password_resets(account_id,token_sha256,expires_at)
      VALUES($1,$2,$3)`,[accountId,createHash('sha256').update(first.token).digest(),expiresAt]);
    // Rolled back enqueue must be absent, just like rolled-back token issuance.
    const rollbackClient=await pool.connect();
    try{
      await rollbackClient.query('BEGIN');
      assert.equal((await enqueueAccountMail(rollbackClient,ring,first)).queued,true);
      await rollbackClient.query('ROLLBACK');
    }finally{rollbackClient.release();}
    assert.equal((await pool.query(
      'SELECT count(*)::int AS n FROM game_account_mail_outbox WHERE account_id=$1',
      [accountId])).rows[0].n,0);
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      assert.equal((await enqueueAccountMail(client,ring,first)).queued,true);
      assert.equal((await enqueueAccountMail(client,ring,first)).queued,false);
      await assert.rejects(
        enqueueAccountMail(client,ring,{...first,token:token()}),
        /idempotency conflict/);
      // PostgreSQL exceptions are not expected for conflicts, transaction remains valid.
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
    const pending=await pool.query(
      'SELECT status,encrypted_payload,payload_fingerprint FROM game_account_mail_outbox WHERE account_id=$1',
      [accountId]);
    assert.equal(pending.rowCount,1);
    assert.equal(pending.rows[0].status,'pending');
    assert.ok(!pending.rows[0].encrypted_payload.includes(Buffer.from(recipient)));
    assert.ok(!pending.rows[0].encrypted_payload.includes(Buffer.from(first.token)));
    assert.equal(pending.rows[0].payload_fingerprint.length,32);
    const races=await Promise.all([claimAccountMail(pool),claimAccountMail(pool)]);
    assert.equal(races.filter(Boolean).length,1,'only one claim for one message');
    // Mark lease stale to simulate crashed process. Next claim retries with same key.
    await pool.query(`
      UPDATE game_account_mail_outbox
         SET status='pending',lease_until=NULL,available_at=now()
       WHERE account_id=$1`,[accountId]);
    const failure=await processOneAccountMail(pool,{keyring:ring,
      from:'Poke Idle <contas@example.test>',providerKey:'re_fake_ci',
      send:async()=>({ok:false,status:503,json:async()=>({})})});
    assert.equal(failure.status,'retry');
    await pool.query(`
      UPDATE game_account_mail_outbox SET available_at=now()-interval '1 second'
      WHERE account_id=$1`,[accountId]);
    let calls=0;
    const success=await processOneAccountMail(pool,{keyring:ring,
      from:'Poke Idle <contas@example.test>',providerKey:'re_fake_ci',
      send:async(url,request)=>{
        calls++;
        assert.equal(url,'https://api.resend.com/emails');
        assert.equal(request.headers['Idempotency-Key'],first.idempotencyKey);
        const body=JSON.parse(request.body);
        assert.deepEqual(body.to,[recipient]);
        assert.ok(body.text.includes(first.token));
        return {ok:true,status:200,json:async()=>({id:'ci-receipt-1'})};
      }});
    assert.equal(success.status,'delivered');
    assert.equal(calls,1);
    assert.equal((await processOneAccountMail(pool,{keyring:ring,
      from:'Poke Idle <contas@example.test>',providerKey:'re_fake_ci',
      send:async()=>{throw Error('must not resend');}})).status,'idle');
    const end=await pool.query(
      'SELECT status,attempt_count,provider_receipt FROM game_account_mail_outbox WHERE account_id=$1',
      [accountId]);
    assert.deepEqual(end.rows,[{status:'delivered',attempt_count:3,provider_receipt:'ci-receipt-1'}]);
    // A queued-but-expired token is never delivered.
    const second=message(accountId,'reset/outbox-002',token(),expiry());
    await enqueueAccountMail(pool,ring,second);
    await pool.query(`
      UPDATE game_account_mail_outbox SET created_at=now()-interval '1 hour',
        expires_at=now()-interval '1 second'
      WHERE idempotency_key=$1`,[second.idempotencyKey]);
    const removed=await reconcileAccountMail(pool);
    assert.deepEqual(removed,{expired:1,dead:0});
    const expired=await processOneAccountMail(pool,{keyring:ring,
      from:'Poke Idle <contas@example.test>',providerKey:'re_fake_ci',
      send:async()=>{throw Error('expired mail must not be sent');}});
    assert.equal(expired.status,'idle');
    assert.equal((await accountMailMetrics(pool)).counts.expired,1);
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});
