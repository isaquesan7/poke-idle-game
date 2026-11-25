/** Explicit operator command; never invoked by HTTP or API startup. */
import pg from 'pg';
import {assertHomologationApiScope,HOMOLOGATION_OWNER} from './homologation.mjs';
import {validateTrainerName} from './auth.mjs';
assertHomologationApiScope();
if(process.env.ONLINE_HOMOLOGATION_ENABLED!=='false')
 throw Error('Owner provisioning requires closed homologation');
const hash=process.env.ONLINE_HOMOLOGATION_OWNER_PASSWORD_HASH;
if(!/^scrypt-v1\$[a-f0-9]{48}\$[a-f0-9]{128}$/.test(hash??''))
 throw Error('Owner password hash required');
const name=validateTrainerName(process.env.ONLINE_HOMOLOGATION_TRAINER_NAME??'Treinador');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
await client.connect();
try{
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(77491001)');
 const rows=(await client.query('SELECT id,email,password_hash,email_verified_at,disabled_at FROM game_accounts LIMIT 2 FOR UPDATE')).rows;
 if(rows.length===0){
  const {rows:[owner]}=await client.query(
   'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',[HOMOLOGATION_OWNER,hash]);
  await client.query('INSERT INTO game_profiles(account_id,trainer_name) VALUES($1,$2)',[owner.id,name]);
 }else{
  if(rows.length!==1||rows[0].email!==HOMOLOGATION_OWNER||rows[0].password_hash!==hash||
    !rows[0].email_verified_at||rows[0].disabled_at)
   throw Error('Existing accounts do not match private owner; no changes made');
  const profile=await client.query('SELECT 1 FROM game_profiles WHERE account_id=$1',[rows[0].id]);
  if(profile.rowCount!==1)throw Error('Owner profile missing; no changes made');
 }
 await client.query('COMMIT');
 console.log('Private homologation owner provisioned');
}catch{
 await client.query('ROLLBACK');
 throw Error('Owner provisioning refused; transaction rolled back');
}finally{await client.end();}
