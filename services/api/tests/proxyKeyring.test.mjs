import test from 'node:test';
import assert from 'node:assert/strict';
import {createProxyKeyring} from '../src/proxyKeyring.mjs';

const subjectHex='11'.repeat(32),oldHex='22'.repeat(32),newHex='33'.repeat(32);
const cutover=1700000000000;
const req={trustedClientIp:'192.0.2.10',method:'POST',path:'/api/v1/auth/login',body:Buffer.from('{}')};
const old=createProxyKeyring({activeHex:oldHex,subjectHex});
const rotated=createProxyKeyring({activeHex:newHex,subjectHex,previousHex:oldHex,cutoverMs:cutover});
test('rotation keeps the quota subject stable and strictly bounds old signatures',()=>{
  const a=old.sign(req,cutover-1000),b=rotated.sign(req,cutover+1000);
  assert.equal(rotated.verify({...req,assertion:a},cutover+1000).subject,
    rotated.verify({...req,assertion:b},cutover+1000).subject);
  const last=old.sign(req,cutover+2000);
  assert.ok(rotated.verify({...req,assertion:last},cutover+32000));
  assert.equal(rotated.verify({...req,assertion:last},cutover+32001),null);
  assert.equal(rotated.verify({...req,assertion:old.sign(req,cutover+2001)},cutover+2001),null);
  assert.throws(()=>rotated.sign(req,cutover-1));
});
test('recovery or emergency revocation must omit previous key',()=>{
  const recovered=createProxyKeyring({activeHex:newHex,subjectHex});
  const assertion=old.sign(req,cutover);
  assert.equal(recovered.verify({...req,assertion},cutover),null);
  assert.ok(recovered.verify({...req,assertion:recovered.sign(req,cutover)},cutover));
});
test('invalid or reused secrets fail closed, no key bytes returned',()=>{
  for(const config of [
    {activeHex:'bad',subjectHex},
    {activeHex:subjectHex,subjectHex},
    {activeHex:newHex,subjectHex,previousHex:newHex,cutoverMs:cutover},
    {activeHex:newHex,subjectHex,previousHex:oldHex},
    {activeHex:newHex,subjectHex,cutoverMs:cutover},
    {activeHex:newHex,subjectHex,previousHex:oldHex,cutoverMs:-1}
  ])assert.throws(()=>createProxyKeyring(config));
  assert.deepEqual(Object.keys(rotated).sort(),['consume','sign','verify']);
});
test('both keys consume via the same atomic nonce guard, rejected assertions skip DB',async()=>{
  const calls=[],pool={query:async(sql,params)=>{calls.push({sql,params});return {rowCount:calls.length===1?1:0};}};
  const assertion=old.sign(req,cutover);
  assert.ok(await rotated.consume(pool,{...req,assertion},cutover+1000));
  assert.equal(await rotated.consume(pool,{...req,assertion},cutover+1000),null);
  assert.equal(await rotated.consume(pool,{...req,assertion:'forged'},cutover+1000),null);
  assert.equal(calls.length,2);
  assert.deepEqual(calls[0].params[0],calls[1].params[0]);
  assert.match(calls[0].sql,/ON CONFLICT\(nonce_digest\) DO NOTHING/);
});
