import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {issueVerification} from '../src/authSecurity.mjs';
import {mailKeyring,enqueueAccountMail,claimAccountMail,
  processOneAccountMail,reconcileAccountMail,accountMailMetrics,
  evaluateAccountMailAlerts} from '../src/accountMailOutbox.mjs';

const ring=mailKeyring({activeId:'ci_key',
  keys:{ci_key:Buffer.alloc(32,0x42).toString('base64')}});
async function queueVerification(pool,accountId,action){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const token=await issueVerification(client,accountId);
    const expires=(await client.query(
      'SELECT expires_at FROM game_email_verifications WHERE account_id=$1 AND token_sha256=$2',
      [accountId,createHash('sha256').update(token).digest()])).rows[0].expires_at;
    await enqueueAccountMail(client,ring,{accountId,idempotencyKey:action,
      purpose:'verify',to:'restart@example.test',token,
      origin:'https://game.example.test',expiresAt:expires});
    await client.query('COMMIT');
    return token;
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}
test('23D3: alert evaluation is deterministic and contains no PII',()=>{
  const neutral={counts:{dead:0},backlog:0,oldestBacklogSeconds:0};
  assert.deepEqual(evaluateAccountMailAlerts(neutral),
    {backlog:false,stale:false,dead:false});
  assert.deepEqual(evaluateAccountMailAlerts({
    counts:{dead:2},backlog:26,oldestBacklogSeconds:360
  }),{backlog:true,stale:true,dead:true});
  assert.deepEqual(evaluateAccountMailAlerts({
    counts:{dead:0},backlog:0,oldestBacklogSeconds:9999
  }),{backlog:false,stale:false,dead:false});
  assert.throws(()=>evaluateAccountMailAlerts(neutral,{backlogLimit:-1}));
  assert.throws(()=>evaluateAccountMailAlerts({counts:{dead:-1},backlog:0,oldestBacklogSeconds:0}));
});
test('23D3: worker restart and lost lease do not produce false local delivery receipts',async()=>{
  assert.ok(process.env.DATABASE_URL,'Disposable PostgreSQL only');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  const opts={keyring:ring,from:'contas@example.test',providerKey:'re_fake_ci'};
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash) VALUES($1,$2) RETURNING id',
      ['restart-23d3-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    await queueVerification(pool,accountId,'verify/restart-001');
    const crashedClaim=await claimAccountMail(pool);
    assert.ok(crashedClaim);
    assert.equal(crashedClaim.attempt_count,1);
    // Simulate process termination: its lease expires, but its claim is
    // durably persisted in PostgreSQL (no in-memory replay).
    await pool.query(`UPDATE game_account_mail_outbox
      SET lease_until=now()-interval '1 second'
      WHERE id=$1`,[crashedClaim.id]);
    let sent=0;
    const recovered=await processOneAccountMail(pool,{...opts,
      send:async(url,request)=>{
        sent++;
        assert.equal(request.headers['Idempotency-Key'],'verify/restart-001');
        return {ok:true,status:200,json:async()=>({id:'recover-1'})};
      }});
    assert.equal(recovered.status,'delivered');
    assert.equal(sent,1);
    const persisted=await pool.query(`SELECT status,attempt_count,provider_receipt
      FROM game_account_mail_outbox WHERE id=$1`,[crashedClaim.id]);
    assert.deepEqual(persisted.rows,[{
      status:'delivered',attempt_count:2,provider_receipt:'recover-1'}]);

    // A provider can accept the message while the lease is reclaimed by
    // another worker. The stale worker MUST report lost-lease instead of
    // lying that it committed the delivery receipt.
    await queueVerification(pool,accountId,'verify/restart-002');
    let otherClaim;
    const stale=await processOneAccountMail(pool,{...opts,
      send:async()=>{
        await pool.query(`UPDATE game_account_mail_outbox
          SET lease_until=now()-interval '1 second'
          WHERE idempotency_key='verify/restart-002'`);
        otherClaim=await claimAccountMail(pool);
        assert.ok(otherClaim);
        assert.equal(otherClaim.attempt_count,2);
        return {ok:true,status:200,json:async()=>({id:'provider-accepted-stale'})};
      }});
    assert.equal(stale.status,'lost-lease');
    const stillLeased=await pool.query(`SELECT status,attempt_count,provider_receipt
      FROM game_account_mail_outbox WHERE id=$1`,[otherClaim.id]);
    assert.deepEqual(stillLeased.rows,[{
      status:'sending',attempt_count:2,provider_receipt:null}]);
    const metrics=await accountMailMetrics(pool);
    assert.equal(metrics.counts.sending,1);
    assert.equal(metrics.counts.delivered,1);
    assert.equal(metrics.backlog,0,'inflight lease is excluded');
    assert.equal((await reconcileAccountMail(pool)).dead,0);
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});
