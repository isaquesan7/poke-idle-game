import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalClientIp,signProxyIdentity,verifyProxyIdentity} from '../src/proxyIdentity.mjs';
const signingKey=Buffer.alloc(32,1),subjectKey=Buffer.alloc(32,2);
const nowMs=1700000000000,method='POST',path='/api/v1/auth/login',body=Buffer.from('{}');
const binding={signingKey,method,path,body,nowMs};
const sign=(ip,overrides={})=>signProxyIdentity({...binding,subjectKey,trustedClientIp:ip,...overrides});
const verify=(assertion,overrides={})=>verifyProxyIdentity({...binding,assertion,...overrides});

test('canonical IPs reject chains, ports, zones and invalid values',()=>{
  assert.equal(canonicalClientIp('192.0.2.1'),'192.0.2.1');
  assert.equal(canonicalClientIp('::ffff:192.0.2.1'),'192.0.2.1');
  assert.equal(canonicalClientIp('0:0:0:0:0:ffff:c000:201'),'192.0.2.1');
  assert.equal(canonicalClientIp('2001:0db8:0:0:0:0:0:1'),'2001:db8::1');
  for(const ip of ['192.0.2.1, 192.0.2.2','192.0.2.1:80','fe80::1%eth0','[::1]',' 192.0.2.1','unknown',null])
    assert.throws(()=>canonicalClientIp(ip));
});
test('signed quota subject is stable for canonical IP but distinct across clients',()=>{
  const one=sign('192.0.2.1'),two=sign('::ffff:192.0.2.1'),other=sign('192.0.2.2');
  assert.ok(!one.includes('192.0.2.1'));
  assert.equal(verify(one).subject,verify(two).subject);
  assert.notEqual(verify(one).nonce,verify(two).nonce);
  assert.notEqual(verify(one).subject,verify(other).subject);
  assert.notEqual(verify(sign('2001:db8::1')).subject,verify(sign('2001:db8::2')).subject);
});
test('forged subject, nonce, timestamp, signature and request binding fail closed',()=>{
  const assertion=sign('192.0.2.1'), other=sign('192.0.2.2').split('.');
  for(const index of [1,2,3,4]){
    const parts=assertion.split('.');
    parts[index]=index===1?String(nowMs+1):index===3?other[3]:index===2?other[2]:other[4];
    assert.equal(verify(parts.join('.')),null);
  }
  assert.equal(verify(assertion,{signingKey:Buffer.alloc(32,3)}),null);
  assert.equal(verify(assertion,{path:'/api/v1/auth/register'}),null);
  assert.equal(verify(assertion,{method:'GET'}),null);
  assert.equal(verify(assertion,{body:Buffer.from('{"different":true}')}),null);
  for(const malformed of [null,[],assertion+','+assertion,assertion+'.x','v2'+assertion.slice(2)])
    assert.equal(verify(malformed),null);
});
test('short validity, bounded future skew, distinct keys and bounded body',()=>{
  const assertion=sign('192.0.2.1');
  assert.ok(verify(assertion,{nowMs:nowMs+30000}));
  assert.equal(verify(assertion,{nowMs:nowMs+30001}),null);
  assert.ok(verify(assertion,{nowMs:nowMs-2000}));
  assert.equal(verify(assertion,{nowMs:nowMs-2001}),null);
  assert.throws(()=>sign('192.0.2.1',{subjectKey:signingKey}));
  assert.throws(()=>sign('192.0.2.1',{signingKey:Buffer.alloc(31)}));
  assert.throws(()=>sign('192.0.2.1',{body:Buffer.alloc(16385)}));
  assert.throws(()=>sign('192.0.2.1',{path:'/api/v1/save'}));
  // Cryptographic verification alone is not single-use; integration must consume nonce.
  assert.equal(verify(assertion).nonce,verify(assertion).nonce);
});
