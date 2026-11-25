/** D6N: exercise candidate SQL together with a disposable, checksum-verified ledger.
 * Production migration registry and runtime are unchanged. This is a test harness.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {disposableOnlineDatabase} from '../src/onlineFeatureGate.mjs';
const candidates=['026_proxy_identity_nonces.sql','027_regional_turn_binding.sql'];
const sqlFile=name=>readFile(new URL('../sql/'+name,import.meta.url),'utf8');
const checksum=sql=>createHash('sha256').update(sql).digest('hex');
const ledger=client=>client.query('SELECT name,checksum FROM game_schema_migrations ORDER BY name').then(r=>r.rows);
async function apply(client,name){
 const sql=await sqlFile(name),hash=checksum(sql);
 const prior=await client.query('SELECT checksum FROM game_schema_migrations WHERE name=$1 FOR UPDATE',[name]);
 if(prior.rowCount){assert.equal(prior.rows[0].checksum,hash,'checksum mismatch');return;}
 await client.query(sql);
 await client.query('INSERT INTO game_schema_migrations(name,checksum) VALUES($1,$2)',[name,hash]);
}
async function transaction(client,fn){
 await client.query('BEGIN');
 try{await client.query('SELECT pg_advisory_xact_lock(77491001)');await fn();await client.query('COMMIT');}
 catch(error){await client.query('ROLLBACK');throw error;}
}
test('D6N: candidate 026/027 ledger atomicity, replay, checksum and schema isolation',async()=>{
 assert.equal(process.env.NODE_ENV,'test');
 assert.equal(disposableOnlineDatabase(),true);
 const schema='release_sql_ci_'+randomBytes(8).toString('hex');
 const admin=new pg.Client({connectionString:process.env.DATABASE_URL});
 let client,created=false;
 await admin.connect();
 try{
  const db=await admin.query("SELECT current_database() AS db,current_setting('server_version_num')::int AS version");
  assert.equal(db.rows[0].db,'kanto_ci');
  assert.ok(db.rows[0].version>=180000&&db.rows[0].version<190000);
  const baseline=(await admin.query('SELECT name,checksum FROM public.game_schema_migrations ORDER BY name')).rows;
  assert.equal(baseline.length,25);
  for(let i=0;i<baseline.length;i++){
   assert.match(baseline[i].name,new RegExp('^'+String(i+1).padStart(3,'0')+'_[a-z0-9_]+\\.sql$'));
   assert.equal(checksum(await sqlFile(baseline[i].name)),baseline[i].checksum);
  }
  await admin.query('CREATE SCHEMA '+schema);created=true;
  client=new pg.Client({connectionString:process.env.DATABASE_URL,options:'-c search_path='+schema});
  await client.connect();
  assert.equal((await client.query('SELECT current_schema() AS name')).rows[0].name,schema);
  await transaction(client,async()=>{
   await client.query('CREATE TABLE game_schema_migrations(name text PRIMARY KEY,checksum char(64) NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
   for(const {name} of baseline)await apply(client,name);
  });
  assert.deepEqual(await ledger(client),baseline);
  const constraint=async()=> (await client.query("SELECT pg_get_constraintdef(oid) AS definition,convalidated FROM pg_constraint WHERE conrelid='game_encounter_reservations'::regclass AND conname='game_encounter_turn_mode_exclusive'")).rows[0];
  const before=await constraint();
  assert.equal(before.convalidated,true);
  // Force a real failure on the second SQL file; the first file and its ledger
  // receipt must roll back, including the injected DDL in this transaction.
  await assert.rejects(transaction(client,async()=>{
   await apply(client,candidates[0]);
   await client.query('ALTER TABLE game_encounter_reservations DROP CONSTRAINT game_encounter_turn_mode_exclusive');
   await apply(client,candidates[1]);
  }),e=>e.code==='42704');
  assert.deepEqual(await ledger(client),baseline);
  assert.equal((await client.query("SELECT to_regclass('game_proxy_identity_nonces') AS relation")).rows[0].relation,null);
  assert.deepEqual(await constraint(),before);
  await transaction(client,async()=>{for(const name of candidates)await apply(client,name);});
  const expected=[...baseline];
  for(const name of candidates)expected.push({name,checksum:checksum(await sqlFile(name))});
  assert.deepEqual(await ledger(client),expected);
  const after=await constraint();
  assert.equal(after.convalidated,true);
  assert.match(after.definition,/battle_turn_state.*regionId.*region_id/s);
  assert.match(after.definition,/battle_snapshot.*regionId.*region_id/s);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND NOT convalidated")).rows[0].n,0);
  const cols=(await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='game_proxy_identity_nonces' ORDER BY column_name")).rows.map(r=>r.column_name);
  assert.deepEqual(cols,['expires_at','nonce_digest']);
  assert.ok((await client.query("SELECT to_regclass('game_proxy_identity_nonces_expiry_idx') AS idx")).rows[0].idx);
  // Exact replay is a no-op. A stale checksum is refused, not rewritten.
  await transaction(client,async()=>{for(const name of candidates)await apply(client,name);});
  assert.deepEqual(await ledger(client),expected);
  await assert.rejects(transaction(client,async()=>{
   await client.query('UPDATE game_schema_migrations SET checksum=$1 WHERE name=$2',['0'.repeat(64),candidates[0]]);
   await apply(client,candidates[0]);
  }),/checksum mismatch/);
  assert.deepEqual(await ledger(client),expected);
  assert.deepEqual((await admin.query('SELECT name,checksum FROM public.game_schema_migrations ORDER BY name')).rows,baseline);
 }finally{
  if(client)await client.end();
  if(created)await admin.query('DROP SCHEMA '+schema+' CASCADE');
  await admin.end();
 }
});
