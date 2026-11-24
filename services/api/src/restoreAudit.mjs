/** ONLINE-01C-23D4: read-only, isolated PostgreSQL restore inventory.
 * This verifies database structure but CANNOT prove backup provenance or PITR.
 * No SQL writes, secrets, account data or tokens are returned.
 */
import pg from 'pg';

const required=['game_accounts','game_profiles','game_auth_sessions',
  'game_email_verifications','game_password_resets','game_saves',
  'game_action_receipts','game_account_mail_outbox',
  'game_gym_reservations','game_schema_migrations'];
const filename=/^\d{3}_[a-z0-9_]+\.sql$/;
export function summarizeRestoreAudit({database,expectedDatabase,migrations,
  tables,invalidConstraints,counts,expectedMigrationCount=25}){
  const blockers=[];
  if(typeof expectedDatabase!=='string'||!expectedDatabase.trim()||
      database!==expectedDatabase)blockers.push('database_name_mismatch');
  if(!Array.isArray(migrations)||migrations.length!==expectedMigrationCount||
      !migrations.every(m=>filename.test(m.name)&&
        /^[a-f0-9]{64}$/.test(m.checksum))||
      new Set(migrations.map(m=>m.name)).size!==migrations.length)
    blockers.push('migration_history_invalid');
  if(!Array.isArray(tables)||required.some(name=>!tables.includes(name)))
    blockers.push('required_tables_missing');
  if(!Number.isSafeInteger(invalidConstraints)||invalidConstraints!==0)
    blockers.push('unvalidated_constraints');
  if(!counts||!['game_accounts','game_saves','game_account_mail_outbox']
    .every(t=>Number.isSafeInteger(counts[t])&&counts[t]>=0))
    blockers.push('aggregate_counts_invalid');
  return {
    pass:blockers.length===0,
    databaseMatched:database===expectedDatabase,
    migrationCount:Array.isArray(migrations)?migrations.length:null,
    expectedMigrationCount,
    requiredTablesPresent:Array.isArray(tables)&&
      required.every(name=>tables.includes(name)),
    unvalidatedConstraints:invalidConstraints,
    counts:counts&&typeof counts==='object'?{
      accounts:counts.game_accounts,saves:counts.game_saves,
      queuedMails:counts.game_account_mail_outbox}:null,
    blockers,
    disclaimer:'Read-only structure check. Not proof of Railway backups, PITR, RPO or RTO.'
  };
}
export async function auditRestoredPg({connectionString,expectedDatabase,
  expectedMigrationCount=25}){
  if(typeof connectionString!=='string'||!connectionString||
    typeof expectedDatabase!=='string'||!expectedDatabase||
    expectedDatabase.toLowerCase()==='railway'||
    expectedDatabase.toLowerCase()==='postgres')
    throw new Error('Explicit isolated target database required');
  const client=new pg.Client({connectionString,connectionTimeoutMillis:5000,
    statement_timeout:10000});
  await client.connect();
  try{
    await client.query('BEGIN READ ONLY');
    const db=(await client.query('SELECT current_database() AS name')).rows[0].name;
    // Check target identity before touching any application table.
    if(db!==expectedDatabase)throw new Error('Restore target identity mismatch');
    const ms=await client.query(
      'SELECT name,checksum FROM game_schema_migrations ORDER BY name');
    const ts=await client.query(`SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'`);
    const checks=await client.query(`SELECT count(*)::int AS total
      FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
      WHERE n.nspname='public' AND NOT c.convalidated`);
    const stats=await client.query(`SELECT
      (SELECT count(*)::int FROM game_accounts) AS game_accounts,
      (SELECT count(*)::int FROM game_saves) AS game_saves,
      (SELECT count(*)::int FROM game_account_mail_outbox) AS game_account_mail_outbox`);
    await client.query('ROLLBACK');
    return summarizeRestoreAudit({
      database:db,expectedDatabase,migrations:ms.rows,
      tables:ts.rows.map(x=>x.table_name),
      invalidConstraints:checks.rows[0].total,counts:stats.rows[0],
      expectedMigrationCount
    });
  }catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}
  finally{await client.end();}
}
