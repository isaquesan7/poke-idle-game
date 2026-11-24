import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEmail,validatePassword,validateTrainerName,hashPassword,
  verifyPassword,newSessionToken,tokenDigest,sessionCookie,parseSessionCookie} from '../src/auth.mjs';

test('email e nome validados antes do banco',()=>{
  assert.equal(normalizeEmail(' T@Example.com '),'t@example.com');
  assert.equal(validateTrainerName(' Treinador K '),'Treinador K');
  assert.throws(()=>normalizeEmail('sem-email'));
  assert.throws(()=>validateTrainerName('x'));
  assert.throws(()=>validatePassword('1234'));
});
test('senha usa scrypt aleatório e comparação segura',async()=>{
  const a=await hashPassword('senha longa bem protegida');
  const b=await hashPassword('senha longa bem protegida');
  assert.notEqual(a,b);
  assert.equal(await verifyPassword('senha longa bem protegida',a),true);
  assert.equal(await verifyPassword('senha incorreta',a),false);
  assert.equal(await verifyPassword('senha longa bem protegida','inválido'),false);
});
test('sessão: token aleatório, hash e cookie HttpOnly',()=>{
  const token=newSessionToken();
  assert.equal(tokenDigest(token).length,32);
  assert.ok(sessionCookie(token).includes('HttpOnly'));
  assert.ok(sessionCookie(token).includes('Secure'));
  assert.equal(parseSessionCookie(sessionCookie(token)),token);
});

import {requesterIp,rateDigest} from '../src/authSecurity.mjs';

test('untrusted forwarded identity cannot change the authentication quota subject',()=>{
  const secret='synthetic-test-secret-not-for-production-123';
  const peer='192.0.2.10';
  const baseline=requesterIp({socket:{remoteAddress:peer},headers:{}});
  const forged=requesterIp({socket:{remoteAddress:peer},headers:{
    'x-forwarded-for':'198.51.100.7, 203.0.113.1',
    forwarded:'for=198.51.100.7',
    'x-real-ip':'198.51.100.8',
    'cf-connecting-ip':'198.51.100.9',
    'x-client-ip':'198.51.100.10'
  }});
  assert.equal(baseline,peer);
  assert.equal(forged,baseline);
  assert.deepEqual(rateDigest('login-ip',forged,secret),rateDigest('login-ip',baseline,secret));
  assert.notDeepEqual(rateDigest('login-ip',peer,secret),rateDigest('login-ip','192.0.2.11',secret));
  assert.notDeepEqual(rateDigest('login-ip',peer,secret),rateDigest('register-ip',peer,secret));
  assert.equal(requesterIp({socket:{},headers:{'x-forwarded-for':'198.51.100.7'}}),'unknown-peer');
});
