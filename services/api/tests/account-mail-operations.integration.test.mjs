import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {mailKeyring,enqueueAccountMail,processOneAccountMail,
  reconcileAccountMail,accountMailMetrics,claimAccountMail} from '../src/accountMailOutbox.mjs';

const keyring=mailKeyring({activeId:'ci_key',
  keys:{ci_key:Buffer.alloc(32,17).toString('base64')}});
const missingHistoricalKey=mailKeyring({activeId:'new_key',
  keys:{new_key:Buffer.alloc(32,22).toString('base64')}});
test('23D2: stale leases, retry exhaustion and privacy-safe metrics',async()=>{
  assert.ok(process.env.DATABASE_URL,'Only disposable PostgreSQL CI');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let accountId;
  const ids=['expire','exhaust','missing','inflight'];
  try{
    const account=await pool.query(
      'INSERT INTO game_accounts(email,password_hash) VALUES($1,$2) RETURNING id',
      ['mail-ops-'+process.pid+'@example.test','x'.repeat(48)]);
    accountId=account.rows[0].id;
    for(const label of ids){
      const result=await enqueueAccountMail(pool,keyring,{
        accountId,idempotencyKey:'ops/'+label,purpose:'reset',
        to:'ops@example.test',token:randomBytes(32).toString('base64url'),
        origin:'https://game.example.test',
        expiresAt:new Date(Date.now()+30*60*1000)
      });
      assert.equal(result.queued,true);
    }
    // Expiration violates no DB constraint because fixture creation is shifted.
    await pool.query(`UPDATE game_account_mail_outbox
      SET created_at=now()-interval '1 hour',expires_at=now()-interval '1 second'
      WHERE idempotency_key='ops/expire'`);
    await pool.query(`UPDATE game_account_mail_outbox
      SET status='sending',attempt_count=5,lease_until=now()-interval '1 second'
      WHERE idempotency_key='ops/exhaust'`);
    await pool.query(`UPDATE game_account_mail_outbox
      SET status='sending',attempt_count=5,lease_until=now()+interval '10 minutes'
      WHERE idempotency_key='ops/inflight'`);
    const before=await accountMailMetrics(pool);
    assert.equal(before.counts.pending,2);
    assert.equal(before.counts.sending,2);
    assert.equal(typeof before.oldestBacklogSeconds,'number');
    assert.equal(JSON.stringify(before).includes('ops@example.test'),false);
    assert.equal(JSON.stringify(before).includes('ops/'),false);
    const [first,second]=await Promise.all([
      reconcileAccountMail(pool),reconcileAccountMail(pool)]);
    assert.equal(first.expired+second.expired,1);
    assert.equal(first.dead+second.dead,1);
    const stale=await pool.query(`SELECT idempotency_key,status FROM game_account_mail_outbox
      WHERE idempotency_key IN ('ops/expire','ops/exhaust','ops/inflight')
      ORDER BY idempotency_key`);
    assert.deepEqual(stale.rows,[
      {idempotency_key:'ops/exhaust',status:'dead'},
      {idempotency_key:'ops/expire',status:'expired'},
      {idempotency_key:'ops/inflight',status:'sending'}
    ]);
    const blocked=await processOneAccountMail(pool,{keyring:missingHistoricalKey,
      from:'contas@example.test',providerKey:'re_fake_ci',
      send:async()=>{throw Error('should not send without historical key');}});
    assert.equal(blocked.status,'blocked-key');
    const row=await pool.query(`SELECT status,attempt_count,
      lease_until,available_at>now() AS delayed
      FROM game_account_mail_outbox WHERE idempotency_key='ops/missing'`);
    assert.deepEqual(
      {status:row.rows[0].status,attempt_count:row.rows[0].attempt_count,
        lease_until:row.rows[0].lease_until,delayed:row.rows[0].delayed},
      {status:'pending',attempt_count:0,lease_until:null,delayed:true});
    assert.equal(await claimAccountMail(pool),null,
      'expired, dead, future leased and delayed messages are ineligible');
    const after=await accountMailMetrics(pool);
    assert.deepEqual(after.counts,
      {pending:1,sending:1,delivered:0,expired:1,dead:1});
    assert.equal(after.backlog,0);
    // Release the fixture lease; a failed fifth claim must be reconciled dead.
    await pool.query(`UPDATE game_account_mail_outbox
      SET lease_until=now()-interval '1 second'
      WHERE idempotency_key='ops/inflight'`);
    assert.deepEqual(await reconcileAccountMail(pool),{expired:0,dead:1});
    assert.deepEqual(await reconcileAccountMail(pool),{expired:0,dead:0},
      'maintenance is repeatable and does not re-finalize messages');
  }finally{
    if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);
    await pool.end();
  }
});
