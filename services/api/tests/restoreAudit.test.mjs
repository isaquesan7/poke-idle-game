import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRestoreAudit} from '../src/restoreAudit.mjs';

const valid=()=>{
  const names=['game_accounts','game_profiles','game_auth_sessions',
    'game_email_verifications','game_password_resets','game_saves',
    'game_action_receipts','game_account_mail_outbox',
    'game_gym_reservations','game_schema_migrations'];
  return {database:'kanto_ci_restore',expectedDatabase:'kanto_ci_restore',
    expectedMigrationCount:25,invalidConstraints:0,tables:names,
    migrations:Array.from({length:25},(_,i)=>({
      name:String(i+1).padStart(3,'0')+'_migration.sql',
      checksum:'a'.repeat(64)})),
    counts:{game_accounts:0,game_saves:0,game_account_mail_outbox:0}};
};
test('23D4: audit passes an isolated complete metadata inventory',()=>{
  const result=summarizeRestoreAudit(valid());
  assert.equal(result.pass,true);
  assert.deepEqual(result.blockers,[]);
  assert.deepEqual(result.counts,{accounts:0,saves:0,queuedMails:0});
});
test('23D4: fail-closed for wrong database and migration count',()=>{
  const wrong=valid();wrong.database='railway';
  assert.equal(summarizeRestoreAudit(wrong).pass,false);
  assert.ok(summarizeRestoreAudit(wrong).blockers.includes('database_name_mismatch'));
  const missing=valid();missing.migrations.pop();
  assert.ok(summarizeRestoreAudit(missing).blockers.includes('migration_history_invalid'));
});
test('23D4: missing tables and invalid constraints block approval',()=>{
  const wrong=valid();wrong.tables.pop();wrong.invalidConstraints=2;
  const r=summarizeRestoreAudit(wrong);
  assert.ok(r.blockers.includes('required_tables_missing'));
  assert.ok(r.blockers.includes('unvalidated_constraints'));
});
test('23D4: garbage, duplicate migrations and invalid counts cannot pass',()=>{
  const d=valid();
  d.migrations[1].name=d.migrations[0].name;
  d.counts.game_saves=-1;
  const r=summarizeRestoreAudit(d);
  assert.ok(r.blockers.includes('migration_history_invalid'));
  assert.ok(r.blockers.includes('aggregate_counts_invalid'));
  assert.equal(JSON.stringify(r).includes('password'),false);
});
