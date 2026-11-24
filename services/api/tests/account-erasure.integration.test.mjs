import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {inspectAccountErasureGraph} from '../src/accountErasureAudit.mjs';

test('23D9: PG18 FK graph is cascade-safe and disposable account delete is rolled back',async()=>{
  assert.ok(process.env.DATABASE_URL,'Only a disposable PostgreSQL integration database');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  const accountId=randomUUID();
  try{
    const inspection=await inspectAccountErasureGraph(pool);
    assert.equal(inspection.readyForIsolatedDeletionDrill,true,
      JSON.stringify(inspection.blockers));
    assert.ok(inspection.coveredTables.includes('game_account_mail_outbox'));
    assert.ok(inspection.coveredTables.includes('game_gym_turn_receipts'));
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const email='erase-dryrun-'+accountId+'@example.test';
      await client.query(
        'INSERT INTO game_accounts(id,email,password_hash) VALUES($1,$2,$3)',
        [accountId,email,'x'.repeat(80)]);
      await client.query(
        'INSERT INTO game_profiles(account_id,trainer_name) VALUES($1,$2)',
        [accountId,'Erase CI Only']);
      await client.query(
        'INSERT INTO game_saves(account_id,revision,state) VALUES($1,$2,$3)',
        [accountId,8,{trainer:{level:2}}]);
      await client.query(
        `INSERT INTO game_auth_sessions(account_id,token_sha256,expires_at)
          VALUES($1,$2,now()+interval '7 days')`,
        [accountId,randomBytes(32)]);
      await client.query(
        `INSERT INTO game_email_verifications(account_id,token_sha256,expires_at)
          VALUES($1,$2,now()+interval '24 hours')`,
        [accountId,randomBytes(32)]);
      await client.query(
        `INSERT INTO game_account_mail_outbox
          (account_id,idempotency_key,purpose,encrypted_payload,
           payload_fingerprint,key_id,expires_at)
          VALUES($1,$2,'verify',$3,$4,'active',
            now()+interval '24 hours')`,
        [accountId,'verify/'+accountId,randomBytes(44),randomBytes(32)]);
      const count=async table=>{
        const result=await client.query(
          'SELECT count(*)::int AS total FROM '+table+' WHERE account_id=$1',
          [accountId]);
        return result.rows[0].total;
      };
      const tables=['game_profiles','game_saves','game_auth_sessions',
        'game_email_verifications','game_account_mail_outbox'];
      for(const table of tables)assert.equal(await count(table),1);
      const deleted=await client.query(
        'DELETE FROM game_accounts WHERE id=$1 RETURNING id',[accountId]);
      assert.equal(deleted.rowCount,1);
      for(const table of tables)assert.equal(await count(table),0,
        'CASCADE must remove '+table+' inside isolated test transaction');
      await client.query('ROLLBACK');
      const persisted=await pool.query(
        'SELECT count(*)::int AS total FROM game_accounts WHERE id=$1',[accountId]);
      assert.equal(persisted.rows[0].total,0,
        'dry-run must never commit account fixture or its deletion');
    }catch(error){
      try{await client.query('ROLLBACK');}catch{}
      throw error;
    }finally{client.release();}
  }finally{await pool.end();}
});
