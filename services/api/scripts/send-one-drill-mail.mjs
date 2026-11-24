/** Delivers at most ONE pending outbox message in a deliberately isolated
 * local manual test. Never run in CI, Railway or a production database.
 * 'provider-accepted' is not evidence of delivery or inbox receipt.
 */
import pg from 'pg';
import {processOneAccountMail} from '../src/accountMailOutbox.mjs';
import {readIsolatedMailDrillConfig,restrictDrillTransport} from '../src/isolatedMailDrill.mjs';
let pool;
try{
  const config=readIsolatedMailDrillConfig(process.env);
  pool=new pg.Pool({connectionString:config.connectionString,
    max:2,connectionTimeoutMillis:5000,statement_timeout:10000});
  const identity=(await pool.query('SELECT current_database() AS name')).rows[0];
  if(identity.name!=='kanto_mail_drill')throw new Error('Wrong drill database');
  const inventory=(await pool.query(
    `SELECT count(*)::int AS total,
        count(*) FILTER (WHERE email=$1)::int AS controlled
       FROM game_accounts`,[config.recipient])).rows[0];
  if(inventory.total!==1||inventory.controlled!==1)
    throw new Error('Drill database must contain exactly one controlled test account');
  const result=await processOneAccountMail(pool,{
    keyring:config.keyring,from:config.from,providerKey:config.providerKey,
    send:restrictDrillTransport(config)});
  if(result.status!=='delivered'){
    console.error('Manual drill did not obtain a provider receipt: '+result.status);
    process.exitCode=1;
  }else{
    const receipt=(await pool.query(
      'SELECT purpose,provider_receipt,delivered_at FROM game_account_mail_outbox WHERE id=$1',
      [result.id])).rows[0];
    if(!receipt||typeof receipt.provider_receipt!=='string'||
      !/^[A-Za-z0-9_.:-]{6,128}$/.test(receipt.provider_receipt))
      throw new Error('Invalid receipt');
    console.log(JSON.stringify({status:'provider-accepted',
      purpose:receipt.purpose,providerMessageId:receipt.provider_receipt,
      acknowledgedAtUtc:new Date(receipt.delivered_at).toISOString(),
      inboxVerified:false,deliveryEventVerified:false,registrationEnabledInProduction:false}));
  }
}catch{
  // Do not emit stack traces containing addresses, credentials or query parameters.
  console.error('Manual mail drill refused or failed. Check the private configuration and isolated database.');
  process.exitCode=1;
}finally{if(pool)await pool.end();}
