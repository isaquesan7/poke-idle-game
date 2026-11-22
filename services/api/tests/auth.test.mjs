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
