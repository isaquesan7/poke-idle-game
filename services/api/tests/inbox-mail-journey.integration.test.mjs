import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import pg from 'pg';
import {randomBytes,randomUUID} from 'node:crypto';
import {mailKeyring,processOneAccountMail} from '../src/accountMailOutbox.mjs';
import {restrictDrillTransport} from '../src/isolatedMailDrill.mjs';
import {runInboxJourney,tokenFromInboxLink} from '../src/inboxMailJourney.mjs';

const origin='https://127.0.0.1:43223';
test('23E7: inbox URL parser rejects foreign, malformed, duplicated and wrong-purpose tokens',()=>{
  const token='a'.repeat(43);
  const link=origin+'/verify-email?token='+token;
  assert.equal(tokenFromInboxLink(link,origin,'verify'),token);
  for(const bad of [link+'&token='+token,link+'#x',link+'&extra=1',
    link.replace('127.0.0.1','other.example.org'),link.replace('/verify-email','/reset-password'),
    link.replace('https:','http:'),link.replace(token,'short'),
    link.replace('127.0.0.1','user@127.0.0.1')])
    assert.throws(()=>tokenFromInboxLink(bad,origin,'verify'));
});
test('23E7: API and outbox use both delivered links, without disclosing tokens in API responses',async()=>{
  assert.ok(process.env.DATABASE_URL,'disposable CI database required');
  const key=randomBytes(32).toString('base64');
  const keyring=mailKeyring({activeId:'drill',keys:{drill:key}});
  const recipient='mail-journey-'+randomUUID()+'@example.test';
  const from='onboarding@resend.dev';
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
  const child=spawn(process.execPath,['src/server.mjs'],{
    cwd:new URL('../',import.meta.url),env:{...process.env,
      NODE_ENV:'test',PORT:'0',ACCOUNT_DRILL_LOOPBACK_ONLY:'true',
      APP_ORIGIN:origin,ONLINE_REGISTRATION_ENABLED:'true',ACCOUNT_MAIL_MODE:'outbox',
      ACCOUNT_MAIL_ACTIVE_KEY_ID:'drill',ACCOUNT_MAIL_KEYRING_JSON:JSON.stringify({drill:key}),
      AUTH_RATE_LIMIT_SECRET:randomBytes(32).toString('hex')},
    stdio:['ignore','pipe','ignore']});
  try{
    const port=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('startup timeout')),15000);
      let buffer='';
      child.stdout.on('data',chunk=>{
        buffer+=chunk.toString();
        const match=/ONLINE-01 API na porta (\d+); registro habilitado/.exec(buffer);
        if(match){clearTimeout(timer);resolve(Number(match[1]));}
      });
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',()=>{clearTimeout(timer);reject(new Error('API exited'));});
    });
    async function request(path,body,cookie){
      const r=await fetch('http://127.0.0.1:'+port+path,{
        method:body?'POST':'GET',redirect:'error',
        headers:{...(body?{'Content-Type':'application/json',Origin:origin}:{}),
          ...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
      return {status:r.status,headers:r.headers,data:await r.json()};
    }
    const inbox=[];
    // Hermetic provider. No real network calls or secret values in CI.
    const send=restrictDrillTransport({recipient,origin,from},async(_url,opts)=>{
      const body=JSON.parse(opts.body);
      const link=body.text.match(/https:\/\/[^\s]+/g)[0];
      inbox.push(link);
      return {ok:true,json:async()=>({id:'fake-receipt-'+inbox.length})};
    });
    const report=await runInboxJourney({request,recipient,origin,
      password:randomBytes(32).toString('base64url'),
      replacement:randomBytes(32).toString('base64url'),
      sendOne:async purpose=>{
        const r=await processOneAccountMail(pool,{keyring,from,providerKey:'re_fake_ci',send});
        assert.equal(r.status,'delivered');
        const receipt=(await pool.query('SELECT purpose,provider_receipt FROM game_account_mail_outbox WHERE id=$1',[r.id])).rows[0];
        assert.equal(receipt.purpose,purpose);
        return {providerMessageId:receipt.provider_receipt};
      },
      readLink:async purpose=>inbox[purpose==='verify'?0:1]});
    assert.equal(inbox.length,2);
    assert.equal(report.httpJourneyPassed,true);
    assert.equal(report.inboxLinksConsumed,true);
    assert.equal(report.oldSessionRevoked,true);
    assert.equal(report.providerDeliveryEventVerified,false);
    assert.equal(report.senderDomainVerified,false);
    assert.equal(report.publicRegistrationAuthorized,false);
    assert.ok(!JSON.stringify(report).includes('token='));
    const rows=await pool.query(`SELECT m.purpose,m.status FROM game_account_mail_outbox m
      JOIN game_accounts a ON a.id=m.account_id WHERE a.email=$1 ORDER BY m.purpose`,[recipient]);
    assert.deepEqual(rows.rows,[{purpose:'reset',status:'delivered'},{purpose:'verify',status:'delivered'}]);
  }finally{
    if(child.exitCode===null&&child.signalCode===null){
      const done=once(child,'exit');child.kill();await done;
    }
    await pool.query('DELETE FROM game_accounts WHERE email=$1',[recipient]);
    await pool.end();
  }
});
