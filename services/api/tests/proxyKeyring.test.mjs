import test from 'node:test';
import assert from 'node:assert/strict';
import {createProxyIssuer,createProxyReceiver} from '../src/proxyKeyring.mjs';

const subjectHex='11'.repeat(32),oldHex='22'.repeat(32),newHex='33'.repeat(32);
const cutover=1700000000000;
const req={trustedClientIp:'192.0.2.10',method:'POST',path:'/api/v1/auth/login',body:Buffer.from('{}')};
const old=createProxyIssuer({activeHex:oldHex,subjectHex});
const issuer=createProxyIssuer({activeHex:newHex,subjectHex,notBeforeMs:cutover});
const receiver=createProxyReceiver({activeHex:newHex,previousHex:oldHex,cutoverMs:cutover});
test('rotation preserves quota identity and bounds both keys around cutover',()=>{
  const a=old.sign(req,cutover-1000),b=issuer.sign(req,cutover+1000);
  assert.equal(receiver.verify({...req,assertion:a},cutover+1000).subject,
    receiver.verify({...req,assertion:b},cutover+1000).subject);
  assert.ok(receiver.verify({...req,assertion:a},cutover-1000));
  const last=old.sign(req,cutover+2000);
  assert.ok(receiver.verify({...req,assertion:last},cutover+32000));
  assert.equal(receiver.verify({...req,assertion:last},cutover+32001),null);
  assert.equal(receiver.verify({...req,assertion:old.sign(req,cutover+2001)},cutover+2001),null);
  assert.throws(()=>issuer.sign(req,cutover-1));
  const premature=createProxyIssuer({activeHex:newHex,subjectHex}).sign(req,cutover-1);
  assert.equal(receiver.verify({...req,assertion:premature},cutover),null);
});
test('recovery or emergency revocation must omit previous key',()=>{
  const recovered=createProxyReceiver({activeHex:newHex});
  assert.equal(recovered.verify({...req,assertion:old.sign(req,cutover)},cutover),null);
  assert.ok(recovered.verify({...req,assertion:issuer.sign(req,cutover)},cutover));
});
test('distinct configurations reject unnecessary secrets and expose only needed operations',()=>{
  for(const config of [
    {activeHex:'bad',subjectHex},
    {activeHex:subjectHex,subjectHex},
    {activeHex:newHex},
    {activeHex:newHex,subjectHex,previousHex:oldHex},
    {activeHex:newHex,subjectHex,notBeforeMs:-1}
  ])assert.throws(()=>createProxyIssuer(config));
  for(const config of [
    {activeHex:'bad'},
    {activeHex:newHex,subjectHex},
    {activeHex:newHex,previousHex:newHex,cutoverMs:cutover},
    {activeHex:newHex,previousHex:oldHex},
    {activeHex:newHex,cutoverMs:cutover},
    {activeHex:newHex,previousHex:oldHex,cutoverMs:-1}
  ])assert.throws(()=>createProxyReceiver(config));
  assert.deepEqual(Object.keys(issuer),['sign']);
  assert.deepEqual(Object.keys(receiver).sort(),['consume','verify']);
  assert.ok(Object.isFrozen(issuer)&&Object.isFrozen(receiver));
});
test('both signatures share atomic nonce guard; invalid assertions skip DB',async()=>{
  const calls=[],pool={query:async(sql,params)=>{calls.push({sql,params});return {rowCount:calls.length===1?1:0};}};
  const assertion=old.sign(req,cutover);
  assert.ok(await receiver.consume(pool,{...req,assertion},cutover+1000));
  assert.equal(await receiver.consume(pool,{...req,assertion},cutover+1000),null);
  assert.equal(await receiver.consume(pool,{...req,assertion:'forged'},cutover+1000),null);
  assert.equal(calls.length,2);
  assert.deepEqual(calls[0].params[0],calls[1].params[0]);
  assert.match(calls[0].sql,/ON CONFLICT\(nonce_digest\) DO NOTHING/);
});

test('issuer pins prefix policy and rotation preserves it; request cannot override',()=>{
  const v6={...req,trustedClientIp:'2001:db8:1:2::1'};
  const oldPrefix=createProxyIssuer({activeHex:oldHex,subjectHex,subjectPolicy:'ipv6-prefix64-v2'});
  const newPrefix=createProxyIssuer({activeHex:newHex,subjectHex,subjectPolicy:'ipv6-prefix64-v2',notBeforeMs:cutover});
  const a=oldPrefix.sign(v6,cutover-1);
  const b=newPrefix.sign({...v6,trustedClientIp:'2001:db8:1:2::ffff',subjectPolicy:'address-v1'},cutover);
  const read=assertion=>receiver.verify({...v6,assertion},cutover).subject;
  assert.equal(read(a),read(b));
  assert.notEqual(read(a),read(old.sign({...v6,subjectPolicy:'ipv6-prefix64-v2'},cutover)));
  assert.throws(()=>createProxyIssuer({activeHex:newHex,subjectHex,subjectPolicy:'auto'}));
  assert.throws(()=>createProxyReceiver({activeHex:newHex,subjectPolicy:'ipv6-prefix64-v2'}));
});
