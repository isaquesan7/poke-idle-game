import test from 'node:test';
import assert from 'node:assert/strict';
import {readIsolatedMailDrillConfig,restrictDrillTransport} from '../src/isolatedMailDrill.mjs';

function fixture(){
  return {NODE_ENV:'test',ACCOUNT_MAIL_MODE:'outbox',ONLINE_REGISTRATION_ENABLED:'true',
    MAIL_DRILL_CONFIRM:'SEND_ONE_REAL_MESSAGE',
    DATABASE_URL:'postgresql://drill:fake@127.0.0.1:55433/kanto_mail_drill',
    APP_ORIGIN:'https://127.0.0.1:43223',MAIL_DRILL_RECIPIENT:'controlled@example.org',
    MAIL_FROM:'Poke Idle <accounts@example.org>',RESEND_API_KEY:'re_synthetic_not_a_real_key',
    ACCOUNT_MAIL_ACTIVE_KEY_ID:'drill',
    ACCOUNT_MAIL_KEYRING_JSON:JSON.stringify({drill:Buffer.alloc(32,7).toString('base64')})};
}
test('23E5: controlled real-mail command rejects CI, Railway, production and unconfirmed execution',()=>{
  for(const patch of [{CI:'true'},{RAILWAY_ENVIRONMENT_ID:'railway-env'},
    {NODE_ENV:'production'},{MAIL_DRILL_CONFIRM:''},{ONLINE_REGISTRATION_ENABLED:'false'},
    {ACCOUNT_MAIL_MODE:'resend'}]){
    assert.throws(()=>readIsolatedMailDrillConfig({...fixture(),...patch}));
  }
  assert.equal(readIsolatedMailDrillConfig(fixture()).recipient,'controlled@example.org');
});
test('23E5: rejects remote, wrong-name and URI-option databases and nonlocal origins',()=>{
  for(const url of ['postgresql://fake@railway.internal/kanto_mail_drill',
    'postgresql://fake@127.0.0.1:55433/railway',
    'postgresql://fake@localhost/kanto_mail_drill?host=railway.internal'])
    assert.throws(()=>readIsolatedMailDrillConfig({...fixture(),DATABASE_URL:url}));
  for(const origin of ['http://127.0.0.1:43223','https://external.example.org',
    'https://localhost:43223/other'])
    assert.throws(()=>readIsolatedMailDrillConfig({...fixture(),APP_ORIGIN:origin}));
  assert.throws(()=>readIsolatedMailDrillConfig({...fixture(),MAIL_DRILL_RECIPIENT:'fake@example.test'}));
});
test('23E5: only authorized single recipient and exact local token link reach transport',async()=>{
  const config=readIsolatedMailDrillConfig(fixture());
  const payload={from:config.from,to:[config.recipient],subject:'Confirme',
    text:'Link: '+config.origin+'/verify-email?token='+'a'.repeat(43)};
  let calls=0;
  const guarded=restrictDrillTransport(config,async(url,options)=>{
    calls++;assert.equal(options.redirect,'error');
    return {ok:true,status:200};
  });
  const send=body=>guarded('https://api.resend.com/emails',{
    method:'POST',body:JSON.stringify(body)});
  for(const patch of [
    {to:['other@example.org']},{to:[config.recipient,'other@example.org']},
    {bcc:['other@example.org']},{from:'other@example.org'},
    {text:'https://external.example.org/verify-email?token='+'a'.repeat(43)},
    {text:config.origin+'/verify-email?token=short'},
    {text:payload.text+'&other=value'}
  ])await assert.rejects(send({...payload,...patch}));
  assert.equal(calls,0);
  assert.equal((await send(payload)).status,200);
  assert.equal(calls,1);
});
