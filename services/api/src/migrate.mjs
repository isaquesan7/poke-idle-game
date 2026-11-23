/** ONLINE-01: migration SQL transactionnelle + checksum.
 * Exécuter exclusivement à partir de l'API avec DATABASE_URL privé.
 * Jamais déclenché par une requête HTTP ou un navigateur.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import pg from 'pg';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL ausente.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,
  connectionTimeoutMillis:5000});
const migrations=['001_online_foundation.sql','002_auth_limits_verification.sql',
  '003_password_reset.sql','004_encounter_reservations.sql'];
await client.connect();
try{
  await client.query('BEGIN');
  // Exclusion mutuelle même si deux déploiements exécutent la migration.
  await client.query('SELECT pg_advisory_xact_lock(77491001)');
  await client.query(`CREATE TABLE IF NOT EXISTS game_schema_migrations(
    name text PRIMARY KEY,
    checksum char(64) NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now())`);
  for(const file of migrations){
    const sql=await readFile(new URL('../sql/'+file,import.meta.url),'utf8');
    const checksum=createHash('sha256').update(sql).digest('hex');
    const applied=await client.query(
      'SELECT checksum FROM game_schema_migrations WHERE name=$1 FOR UPDATE',[file]);
    if(applied.rowCount){
      if(applied.rows[0].checksum!==checksum)
        throw new Error('Migration alterada após aplicação: '+file);
      console.log('ONLINE-01 migration já aplicada: '+file);
    }else{
      await client.query(sql);
      await client.query(
        'INSERT INTO game_schema_migrations(name,checksum) VALUES($1,$2)',
        [file,checksum]);
      console.log('ONLINE-01 migration aplicada: '+file);
    }
  }
  await client.query('COMMIT');
}catch(error){
  await client.query('ROLLBACK');
  throw error;
}finally{await client.end();}
