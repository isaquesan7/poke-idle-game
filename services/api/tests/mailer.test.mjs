import test from 'node:test';
import assert from 'node:assert/strict';
import {accountEmail,deliverAccountEmail} from '../src/mailer.mjs';
const token='A'.repeat(43);
test('email verification and reset have no HTML injection and use HTTPS links',()=>{
  const verify=accountEmail({purpose:'verify',token,origin:'https://kanto.example'});
  assert.ok(verify.text.includes('https://kanto.example/verify-email?token='));
  assert.ok(verify.text.includes('24 horas'));
  const reset=accountEmail({purpose:'reset',token,origin:'https://kanto.example'});
  assert.ok(reset.text.includes('/reset-password?token='));
  assert.ok(reset.text.includes('30 minutos'));
  assert.throws(()=>accountEmail({purpose:'reset',token,origin:'http://insecure.example'}));
  assert.throws(()=>accountEmail({purpose:'other',token,origin:'https://kanto.example'}));
});
test('Resend adapter injects only expected headers and idempotency key',async()=>{
  let call;
  const result=await deliverAccountEmail({to:'user@example.test',purpose:'reset',
    token,origin:'https://kanto.example',key:'re_ci_example',from:'Poke Idle <contas@kanto.example>',
    idempotencyKey:'reset/123456',
    send:async(url,options)=>{
      call={url,options};
      return {ok:true,status:200,json:async()=>({id:'email-message-id'})};
    }});
  assert.equal(result.id,'email-message-id');
  assert.equal(call.url,'https://api.resend.com/emails');
  assert.equal(call.options.headers.Authorization,'Bearer re_ci_example');
  assert.equal(call.options.headers['Idempotency-Key'],'reset/123456');
  const body=JSON.parse(call.options.body);
  assert.deepEqual(body.to,['user@example.test']);
  assert.ok(body.text.includes('/reset-password?token='));
  assert.equal(body.html,undefined);
});
test('provider rejection does not leak email payload or API credentials',async()=>{
  await assert.rejects(
    deliverAccountEmail({to:'user@example.test',purpose:'reset',
      token,origin:'https://kanto.example',key:'re_ci_example',
      from:'contas@kanto.example',idempotencyKey:'reset/789',
      send:async()=>({ok:false,status:503})}),
    /Email provider delivery failed \(503\)/);
});
