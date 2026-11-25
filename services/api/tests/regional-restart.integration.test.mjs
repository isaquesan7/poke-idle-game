/** D6L — restart real API processes against the same disposable PostgreSQL.
 * Never run against production. Only fixtures use direct DB writes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {disposableOnlineDatabase} from '../src/onlineFeatureGate.mjs';
import {firstSave} from '../src/initialAdventure.mjs';
import {newSessionToken,tokenDigest,sessionCookie} from '../src/auth.mjs';
import {createPrivateBattleKeyProof} from '../src/battleEntropy.mjs';

const origin='http://127.0.0.1:43142',api='http://127.0.0.1:43168';
const key='39'.repeat(32),incorrect='a1'.repeat(32);
test('D6L: real API restart retains regional session, rejects wrong key, replays and settles once',async()=>{
 assert.equal(process.env.NODE_ENV,'test');
 assert.equal(disposableOnlineDatabase(),true,'Disposable loopback PostgreSQL required');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 let child,accountId,cookie;
 const pids=[];
 async function call(path,data){
  const response=await fetch(api+path,{method:data?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(data?{Origin:origin,'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(3000)});
  return {status:response.status,data:await response.json()};
 }
 async function stop(){
  if(child&&child.exitCode===null&&child.signalCode===null){
   const done=once(child,'exit');child.kill('SIGKILL');await done;
  }
  child=undefined;
 }
 async function launch(secret){
  await stop();
  child=spawn(process.execPath,['src/server.mjs'],{cwd:new URL('../',import.meta.url).pathname,
   env:{...process.env,PORT:'43168',NODE_ENV:'test',APP_ORIGIN:origin,ONLINE_REGISTRATION_ENABLED:'true',ACCOUNT_DRILL_LOOPBACK_ONLY:'true',ACCOUNT_MAIL_MODE:'off',ONLINE_REGIONAL_EXPANSION_CI_ONLY:'false',WILD_CI_ENTROPY_HEX:secret},stdio:'ignore'});
  pids.push(child.pid);
  for(let i=0;i<100;i++){
   try{if((await call('/health')).status===200)return;}catch{}
   if(child.exitCode!==null||child.signalCode!==null)break;
   await new Promise(r=>setTimeout(r,100));
  }
  assert.fail('Isolated API failed to start');
 }
 const read=async()=> (await pool.query(`SELECT s.revision,s.state,e.species_id,e.pokemon_level,e.battle_turn_entropy_proof,e.battle_turn_state,e.status,e.battle_turn_payout_action_id,e.battle_turn_final_action_id,
 (SELECT count(*)::int FROM game_wild_turn_receipts WHERE account_id=s.account_id) AS turns,
 (SELECT count(*)::int FROM game_action_receipts WHERE account_id=s.account_id) AS receipts
 FROM game_saves s JOIN game_encounter_reservations e ON e.account_id=s.account_id WHERE s.account_id=$1`,[accountId])).rows[0];
 const post=async(kind,data,expected='applied')=>{
  const result=await call('/api/v1/region/'+kind,data);
  assert.equal(result.status,200,kind+': '+result.data.status);
  assert.equal(result.data.status,expected);return result.data;
 };
 try{
  accountId=(await pool.query('INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',['restart-d6l-'+randomUUID()+'@example.test','x'.repeat(48)])).rows[0].id;
  await pool.query('INSERT INTO game_profiles(account_id,trainer_name) VALUES($1,$2)',[accountId,'Restart CI']);
  const token=newSessionToken();
  await pool.query("INSERT INTO game_auth_sessions(account_id,token_sha256,expires_at) VALUES($1,$2,now()+interval '2 hours')",[accountId,tokenDigest(token)]);
  cookie=sessionCookie(token,{secure:false}).split(';')[0];
  await pool.query('INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',[accountId,JSON.stringify(firstSave('Restart CI',4,1740000000000))]);
  await launch(key);
  const reserved=await post('reserve',{actionId:randomUUID(),expectedRevision:0,regionId:1},'reserved');
  const encounterId=reserved.encounter.id;
  const started=await post('start',{encounterId,expectedRevision:reserved.revision},'started');
  const first={encounterId,actionId:randomUUID(),expectedRevision:started.revision,action:{kind:'basic'}};
  let current=await post('turn',first);
  const before=await read();
  assert.equal(before.turns,1);
  assert.equal(before.battle_turn_entropy_proof,createPrivateBattleKeyProof(Buffer.from(key,'hex'),{accountId,encounterId}));
  await launch(incorrect);
  const replayDenied=await call('/api/v1/region/turn',first);
  assert.equal(replayDenied.status,409);assert.equal(replayDenied.data.status,'historical-key-missing');
  assert.deepEqual(await read(),before,'wrong key cannot modify progress or receipts');
  await launch(key);
  const restored=await call('/api/v1/region/current');
  assert.equal(restored.status,200);
  assert.equal(restored.data.revision,current.revision);
  assert.deepEqual(restored.data.encounter,current.encounter);
  const replay=await post('turn',first,'replay');
  assert.equal(replay.revision,current.revision);
  assert.deepEqual(await read(),before);
  let turns=1;
  while(current.encounter.phase==='await-player'&&turns<30){
   current=await post('turn',{encounterId,actionId:randomUUID(),expectedRevision:current.revision,action:{kind:'basic'}});turns++;
  }
  assert.equal(current.encounter.phase,'resolved');
  const cert=await post('certify',{encounterId,actionId:randomUUID(),expectedRevision:current.revision},'certified');
  const args={encounterId,actionId:randomUUID(),expectedRevision:cert.revision};
  const paid=await post('settle',args,'paid');
  const paidRow=await read();
  await launch(key);
  const paidReplay=await post('settle',args,'replay');
  assert.equal(paidReplay.revision,paid.revision);
  assert.deepEqual(await read(),paidRow,'restart after payout cannot duplicate rewards');
  const finished=await post('finish',{encounterId,actionId:randomUUID(),expectedRevision:paid.revision,choice:'skip'},'finished');
  assert.equal(finished.encounter,null);
  const final=await read();
  assert.equal(final.status,'completed');assert.equal(final.turns,turns);
  assert.equal(final.battle_turn_entropy_proof,before.battle_turn_entropy_proof);
  assert.ok(final.battle_turn_payout_action_id&&final.battle_turn_final_action_id);
  assert.equal(new Set(pids).size,4,'four distinct API processes');
 }finally{await stop();if(accountId)await pool.query('DELETE FROM game_accounts WHERE id=$1',[accountId]);await pool.end();}
});
