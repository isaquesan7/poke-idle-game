import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateBattleRandom,BATTLE_ENTROPY_VERSION} from '../src/battleEntropy.mjs';

const key=Buffer.alloc(32,0x9f);
const ids={
  accountId:'11111111-1111-4111-8111-111111111111',
  encounterId:'22222222-2222-4222-8222-222222222222',
  phase:'wild-encounter'
};
const stream=(k=key,params=ids)=>createPrivateBattleRandom(k,params);
test('reproducible stream is private and domain separated by account, encounter and phase',()=>{
 const a=stream(),b=stream();
 const sample=Array.from({length:12},()=>a.integer(151));
 assert.deepEqual(sample,Array.from({length:12},()=>b.integer(151)));
 const altEncounter=stream(key,{...ids,encounterId:'33333333-3333-4333-8333-333333333333'});
 const altAccount=stream(key,{...ids,accountId:'44444444-4444-4444-8444-444444444444'});
 const altPhase=stream(key,{...ids,phase:'wild-rewards'});
 const altKey=stream(Buffer.alloc(32,0x02));
 for(const different of [altEncounter,altAccount,altPhase,altKey])
   assert.notDeepEqual(sample,Array.from({length:12},()=>different.integer(151)));
 assert.equal(BATTLE_ENTROPY_VERSION,'kanto-battle-entropy-v1');
 assert.equal(Object.keys(a).includes('secret'),false);
});
test('random bounds and secret constraints are strict; no browser seed input',()=>{
 assert.throws(()=>stream(Buffer.alloc(16)),/32\+ byte/);
 assert.throws(()=>stream('insecure secret'),/32\+ byte/);
 assert.throws(()=>stream(key,{...ids,encounterId:'client-seed'}),/Server-issued/);
 assert.throws(()=>stream(key,{...ids,phase:'../../poison'}),/Server-issued/);
 for(const bound of [0,-1,2**32+1,1.5,NaN,Infinity,'100'])
   assert.throws(()=>stream().integer(bound),/upper bound/);
 const a=stream();
 assert.equal(a.integer(1),0);
 const samples=Array.from({length:512},()=>a.integer(151));
 assert.ok(samples.every(n=>Number.isInteger(n)&&n>=0&&n<151));
 const floats=Array.from({length:512},()=>a.unit());
 assert.ok(floats.every(n=>n>=0&&n<1));
 assert.ok(samples.some(n=>n>130)&&samples.some(n=>n<15));
});
