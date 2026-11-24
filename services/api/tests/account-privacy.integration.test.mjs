import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {exportAccountData} from '../src/accountPrivacy.mjs';

test('23D8: internal account portability draft exports scoped gameplay, never credentials',async()=>{
  assert.ok(process.env.DATABASE_URL,'Disposable PostgreSQL CI only');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  const accountId=randomUUID(),outsiderId=randomUUID();
  const email='privacy-'+accountId+'@example.test';
  try{
    for(const id of [accountId,outsiderId]){
      await pool.query('INSERT INTO game_accounts(id,email,password_hash) VALUES($1,$2,$3)',
        [id,id===accountId?email:'other-'+id+'@example.test','x'.repeat(80)]);
      await pool.query('INSERT INTO game_profiles(account_id,trainer_name) VALUES($1,$2)',
        [id,id===accountId?'Treinador Privado':'Outro Treinador']);
    }
    await pool.query(
      'INSERT INTO game_auth_sessions(account_id,token_sha256,expires_at) VALUES($1,$2,now()+interval \'7 days\')',
      [accountId,randomBytes(32)]);
    const state={trainer:{level:9},pokemon:[{uid:'owned-uid',level:3}]};
    await pool.query(
      'INSERT INTO game_saves(account_id,revision,state) VALUES($1,$2,$3)',
      [accountId,12,state]);
    await pool.query(
      'INSERT INTO game_saves(account_id,revision,state) VALUES($1,$2,$3)',
      [outsiderId,28,{trainer:{level:99},pokemon:[{uid:'outsider-uid'}]}]);
    await pool.query(
      'INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision) VALUES($1,$2,$3,$4)',
      [accountId,'privacy-action-23d8','trainer-invest',12]);
    await pool.query(
      'INSERT INTO game_action_receipts(account_id,action_id,kind,save_revision) VALUES($1,$2,$3,$4)',
      [outsiderId,'outsider-action-23d8','trainer-invest',28]);
    const exported=await exportAccountData(pool,{accountId});
    assert.equal(exported.account.id,accountId);
    assert.equal(exported.account.email,email);
    assert.equal(exported.profile.trainerName,'Treinador Privado');
    assert.equal(exported.gameplay.revision,'12');
    assert.deepEqual(exported.gameplay.state,state);
    assert.deepEqual(exported.actions.map(x=>x.actionId),['privacy-action-23d8']);
    const json=JSON.stringify(exported);
    for(const secret of ['password_hash','token_sha256','encrypted_payload',
      'outsider-uid','Outro Treinador','outsider-action-23d8']){
      assert.ok(!json.includes(secret),'export must exclude '+secret);
    }
    const outsider=await exportAccountData(pool,{accountId:outsiderId});
    assert.equal(outsider.gameplay.revision,'28');
    await pool.query('UPDATE game_accounts SET disabled_at=now() WHERE id=$1',
      [outsiderId]);
    assert.equal(await exportAccountData(pool,{accountId:outsiderId}),null,
      'disabled accounts cannot use active-account portability');
    assert.equal((await exportAccountData(pool,{accountId:randomUUID()})),null);
    assert.equal((await pool.query('SELECT count(*)::int AS total FROM game_accounts WHERE id=$1',
      [accountId])).rows[0].total,1,'export is read-only');
    await assert.rejects(exportAccountData(pool,{accountId:"' OR true --"}),TypeError);
  }finally{
    await pool.query('DELETE FROM game_accounts WHERE id IN ($1,$2)',[accountId,outsiderId]);
    await pool.end();
  }
});
