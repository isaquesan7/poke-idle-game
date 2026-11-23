import test from 'node:test';
import assert from 'node:assert/strict';
import {createGymEntropyKeyring,gymEntropyProof,
  loadGymEntropyKeyringFromEnv} from '../src/gymEntropyKeyring.mjs';

const accountId='0b78ef3b-fd09-4d11-a1de-5b6bacf3a5a9';
const gymReservationId='a935f313-9bee-4c5f-81d8-ae79153c9a61';
const before=Buffer.alloc(32,0x3f),after=Buffer.alloc(32,0x40);
const params={accountId,gymReservationId};
const keys={v1:before.toString('base64'),v2:after.toString('base64')};
test('ONLINE-01C-23C1: Gym keyring rotation retains historical replay',()=>{
  const old=createGymEntropyKeyring({activeId:'v1',keys});
  const proof=gymEntropyProof(old.active().key,params);
  const newer=createGymEntropyKeyring({activeId:'v2',keys});
  assert.equal(newer.activeId,'v2');
  assert.equal(newer.resolve({...params,keyId:'v1',storedProof:proof}).status,'resolved');
  assert.equal(newer.resolve({...params,keyId:null,storedProof:proof}).status,'legacy');
  assert.equal(newer.resolve({...params,keyId:null,storedProof:null}).id,'v2');
  assert.equal(newer.resolve({...params,keyId:'v2',storedProof:proof}).status,
    'entropy-mismatch');
  assert.equal(createGymEntropyKeyring({activeId:'v2',keys:{v2:keys.v2}})
    .resolve({...params,keyId:'v1',storedProof:proof}).status,'historical-key-missing');
  assert.equal(createGymEntropyKeyring({activeId:'v2',keys:{v2:keys.v2}})
    .resolve({...params,keyId:null,storedProof:proof}).status,'historical-key-missing');
  assert.equal(newer.resolve({...params,keyId:'user-supplied',storedProof:proof}).status,
    'historical-key-missing');
  const obtained=newer.active();
  obtained.key.fill(0);
  assert.equal(newer.active().key.equals(after),true,'callers cannot mutate stored secrets');
});
test('ONLINE-01C-23C1: reject weak/noncanonical/missing configuration',()=>{
  assert.throws(()=>createGymEntropyKeyring({activeId:'v2',keys:{v2:'YQ=='}}));
  assert.throws(()=>createGymEntropyKeyring({activeId:'v2',keys:{v2:'invalid!!'}}));
  assert.throws(()=>createGymEntropyKeyring({activeId:'bad id',keys}));
  assert.throws(()=>loadGymEntropyKeyringFromEnv({GYM_HMAC_ACTIVE_KEY_ID:'v1'}));
  const loaded=loadGymEntropyKeyringFromEnv({
    GYM_HMAC_ACTIVE_KEY_ID:'v2',GYM_HMAC_KEYRING_JSON:JSON.stringify(keys)
  });
  assert.equal(loaded.active().id,'v2');
  assert.equal(loaded.resolve({...params,keyId:'v1',
    storedProof:gymEntropyProof(before,params)}).status,'resolved');
});
