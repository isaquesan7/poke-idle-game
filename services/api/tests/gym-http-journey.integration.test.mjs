/** ONLINE-01C-23C6 — FULL HTTP-ONLY Gym journey in disposable CI.
 * Fixture provisioning is the ONLY direct DB write prior to gameplay:
 * test accounts, verified cookie and a three-Pokemon roster. ALL gameplay
 * actions go through authenticated HTTP as a browser would.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import pg from 'pg';
import {firstSave} from '../src/initialAdventure.mjs';
import {newSessionToken,tokenDigest,sessionCookie} from '../src/auth.mjs';

const origin='http://127.0.0.1:43142';
const api='http://127.0.0.1:43148';
async function request(path,method='GET',body,cookie){
  const response=await fetch(api+path,{
    method,redirect:'manual',
    headers:{...(body?{'Content-Type':'application/json',Origin:origin}:{}),
      ...(cookie?{Cookie:cookie}:{})},
    body:body?JSON.stringify(body):undefined
  });
  return {status:response.status,data:await response.json()};
}
async function createVerifiedFixture(pool,label,withTeam){
  const user=await pool.query(
    'INSERT INTO game_accounts(email,password_hash,email_verified_at) VALUES($1,$2,now()) RETURNING id',
    [label+'-'+process.pid+'@example.test','x'.repeat(48)]);
  const accountId=user.rows[0].id;
  await pool.query('INSERT INTO game_profiles(account_id,trainer_name) VALUES($1,$2)',
    [accountId,'Jornada Gym CI']);
  const token=newSessionToken();
  await pool.query(
    `INSERT INTO game_auth_sessions(account_id,token_sha256,expires_at)
      VALUES($1,$2,now()+interval '2 hour')`,
    [accountId,tokenDigest(token)]);
  if(withTeam){
    const save=firstSave('Jornada Gym CI',4,1740000000000);
    const raw=JSON.parse(save.journal.raw);
    const base=structuredClone(raw.roster[0]);
    // Server test fixture only: build already-owned high-level Pokemon so
    // battle reaches real terminal WIN, without overriding battle HP/RNG.
    raw.roster[0].level=100;
    raw.roster.push({...structuredClone(base),uid:2,pokemonId:7,
      level:100,moveName:'tackle',upgrades:{}});
    raw.roster.push({...structuredClone(base),uid:3,pokemonId:1,
      level:100,moveName:'tackle',upgrades:{}});
    raw.nextUid=4;
    raw.seen=[4,7,1];
    raw.caughtSpecies=[4,7,1];
    save.journal.raw=JSON.stringify(raw);
    await pool.query(
      'INSERT INTO game_saves(account_id,schema_version,revision,state) VALUES($1,2,0,$2::jsonb)',
      [accountId,JSON.stringify(save)]);
  }
  return {accountId,cookie:sessionCookie(token,{secure:false}).split(';')[0]};
}
test('ONLINE-01C-23C6: Collection → Brock 3v3 → certified victory → single badge via authenticated HTTP',async()=>{
  assert.ok(process.env.DATABASE_URL,'Disposable PostgreSQL CI only');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  let child,owner,outsider;
  const post=(path,data,cookie=owner.cookie)=>request(path,'POST',data,cookie);
  try{
    owner=await createVerifiedFixture(pool,'gym-journey-owner',true);
    outsider=await createVerifiedFixture(pool,'gym-journey-outsider',false);
    child=spawn(process.execPath,['src/server.mjs'],{
      cwd:new URL('../',import.meta.url).pathname,
      env:{...process.env,PORT:'43148',APP_ORIGIN:origin,NODE_ENV:'test',
        ONLINE_REGISTRATION_ENABLED:'true',
        GYM_HMAC_ACTIVE_KEY_ID:'v1',
        GYM_HMAC_KEYRING_JSON:JSON.stringify({
          v1:Buffer.alloc(32,0x72).toString('base64')
        })},
      stdio:'ignore'
    });
    let ready=false;
    for(let n=0;n<140;n++){
      try{if((await request('/health')).status===200){ready=true;break;}}
      catch{}
      if(child.exitCode!==null)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(ready,'isolated test-only HTTP API must start');
    const before=await request('/api/v1/save','GET',undefined,owner.cookie);
    assert.equal(before.status,200);
    assert.equal(before.data.revision,0);
    assert.deepEqual(JSON.parse(before.data.state.journal.raw).team,[1]);
    const premature=await post('/api/v1/gym/reserve',{
      actionId:'journey-reserve-premature-0001',expectedRevision:0
    });
    assert.equal(premature.status,409);
    assert.equal(premature.data.error,'unavailable',
      'must select three Pokemon in Collection before Gym');
    const chosen=await post('/api/v1/collection/team',{
      actionId:'journey-collection-setup-0001',expectedRevision:0,
      teamUids:[2,3,1]
    });
    assert.equal(chosen.status,200);
    assert.equal(chosen.data.status,'set');
    assert.equal(chosen.data.revision,1);
    assert.deepEqual(chosen.data.teamUids,[2,3,1]);
    const reserve=await post('/api/v1/gym/reserve',{
      actionId:'journey-reserve-brock-0001',expectedRevision:1
    });
    assert.equal(reserve.status,200);
    assert.equal(reserve.data.status,'reserved');
    assert.equal(reserve.data.gymId,'boulder');
    assert.deepEqual(reserve.data.teamUids,[2,3,1]);
    const gymReservationId=reserve.data.gymReservationId;
    assert.equal((await post('/api/v1/collection/team',{
      actionId:'journey-mid-gym-team-denied-0001',expectedRevision:2,
      teamUids:[1,3,2]
    })).data.error,'busy','no lineup changes after reserving Gym');
    assert.equal((await post('/api/v1/gym/start',{
      gymReservationId,expectedRevision:2
    },outsider.cookie)).status,404,'other verified account cannot open Gym');
    const started=await post('/api/v1/gym/start',{
      gymReservationId,expectedRevision:2
    });
    assert.equal(started.status,200);
    assert.equal(started.data.status,'started');
    assert.deepEqual(started.data.turnState.player.fighters.map(x=>x.uid),[2,3,1]);
    assert.equal(started.data.turnState.turn,0);
    assert.ok(started.data.turnState.player.fighters.every(x=>x.hp>0&&x.sp===x.maxSp));
    assert.ok(started.data.actions.length>0);
    let turnState=started.data.turnState,actions=started.data.actions;
    let revision=2,turns=0,firstTurn;
    while(turnState.outcome==='ongoing'&&turns<140){
      const action=actions.find(x=>x.kind==='move')||
        actions.find(x=>x.kind==='basic')||actions[0];
      assert.ok(action,'canonical engine must offer legal action');
      const payload={gymReservationId,expectedRevision:revision,
        actionId:'journey-turn-'+String(++turns).padStart(4,'0'),action};
      const result=await post('/api/v1/gym/turn',payload);
      assert.equal(result.status,200,'Gym turn HTTP: '+JSON.stringify(result.data));
      assert.equal(result.data.status,'applied');
      if(!firstTurn)firstTurn={payload,result:result.data};
      revision=result.data.revision;
      turnState=result.data.result.state;
      actions=result.data.result.nextActions;
    }
    assert.equal(turnState.outcome,'player-win',
      'high-level legitimate test roster defeats Brock through the real 3v3 engine');
    assert.ok(turns>=1&&turns<=140);
    const pinned=await pool.query(
      'SELECT turn_entropy_key_id FROM game_gym_reservations WHERE id=$1',
      [gymReservationId]);
    assert.equal(pinned.rows[0].turn_entropy_key_id,'v1');
    const turnReplay=await post('/api/v1/gym/turn',firstTurn.payload);
    assert.equal(turnReplay.status,200);
    assert.equal(turnReplay.data.status,'replay');
    assert.deepEqual(turnReplay.data.result,firstTurn.result.result);
    const beforeCertificate=await request('/api/v1/save','GET',undefined,owner.cookie);
    assert.deepEqual(JSON.parse(beforeCertificate.data.state.journal.raw).badges,[]);
    const certArgs={gymReservationId,expectedRevision:revision,
      actionId:'journey-terminal-cert-0001'};
    assert.equal((await post('/api/v1/gym/certify',certArgs,outsider.cookie)).status,
      404,'other account cannot certify player victory');
    const cert=await post('/api/v1/gym/certify',certArgs);
    assert.equal(cert.status,200);
    assert.equal(cert.data.status,'certified');
    assert.equal(cert.data.certificate.outcome,'player-win');
    assert.equal(cert.data.certificate.turns,turns);
    assert.match(cert.data.certificate.digest,/^[0-9a-f]{64}$/);
    const certRepeat=await post('/api/v1/gym/certify',{
      ...certArgs,expectedRevision:0
    });
    assert.equal(certRepeat.status,200);
    assert.equal(certRepeat.data.status,'replay');
    const payoutArgs={gymReservationId,actionId:'journey-badge-payout-0001',
      expectedRevision:cert.data.revision};
    assert.equal((await post('/api/v1/gym/settle',payoutArgs,outsider.cookie))
      .status,404,'other account cannot claim Gym payout');
    const paid=await Promise.all([
      post('/api/v1/gym/settle',payoutArgs),
      post('/api/v1/gym/settle',payoutArgs)
    ]);
    assert.deepEqual(paid.map(x=>x.status),[200,200]);
    assert.deepEqual(paid.map(x=>x.data.status).sort(),['paid','replay']);
    assert.ok(paid.every(x=>x.data.paid.badgeId==='boulder'&&
      x.data.paid.coins===1500&&x.data.paid.trainerXp===120));
    const finalSave=await request('/api/v1/save','GET',undefined,owner.cookie);
    assert.equal(finalSave.status,200);
    const raw=JSON.parse(finalSave.data.state.journal.raw);
    assert.deepEqual(raw.badges,['boulder']);
    assert.deepEqual(raw.team,[2,3,1]);
    assert.equal(raw.coins,1500);
    assert.equal(raw.trainer.xp,120);
    assert.equal((await post('/api/v1/gym/settle',{
      ...payoutArgs,actionId:'journey-attempt-second-payout-0001',
      expectedRevision:finalSave.data.revision
    })).data.error,'already-paid');
    const sealed=await pool.query(
      `SELECT status,certificate_digest,payout_receipt,team_uids
         FROM game_gym_reservations WHERE id=$1`,[gymReservationId]);
    assert.equal(sealed.rows[0].status,'completed');
    assert.equal(sealed.rows[0].certificate_digest,cert.data.certificate.digest);
    assert.deepEqual(sealed.rows[0].team_uids,[2,3,1]);
    assert.equal(sealed.rows[0].payout_receipt.badgeId,'boulder');
    const badgeReceipts=await pool.query(
      "SELECT count(*)::int AS n FROM game_action_receipts WHERE account_id=$1 AND kind='gym-payout'",
      [owner.accountId]);
    assert.equal(badgeReceipts.rows[0].n,1,'exactly one durable payout receipt');
    const outsiderSave=await request('/api/v1/save','GET',undefined,outsider.cookie);
    assert.equal(outsiderSave.status,404,'other account save remains untouched');
  }finally{
    child?.kill('SIGTERM');
    if(owner)await pool.query('DELETE FROM game_accounts WHERE id=$1',[owner.accountId]);
    if(outsider)await pool.query('DELETE FROM game_accounts WHERE id=$1',[outsider.accountId]);
    await pool.end();
  }
});
