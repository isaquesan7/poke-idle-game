import test from 'node:test';
import assert from 'node:assert/strict';
import {createWildEntropyKeyring,loadWildEntropyKeyringFromEnv,selectWildEncounterKey} from '../src/wildEntropyKeyring.mjs';
import {createPrivateBattleKeyProof,createPrivateBattleRandom} from '../src/battleEntropy.mjs';
const context={accountId:'00000000-0000-4000-8000-000000000001',encounterId:'00000000-0000-4000-8000-000000000002'};
const keys={old:'12'.repeat(32),next:'ab'.repeat(32)};
const proof=createPrivateBattleKeyProof(Buffer.from(keys.old,'hex'),context);
test('D6H: rotation preserves deterministic turn, reward and capture entropy after first proof',()=>{
 const old=createWildEntropyKeyring({activeId:'old',keys}),next=createWildEntropyKeyring({activeId:'next',keys});
 assert.equal(next.resolve({...context,storedProof:null}).id,'next');
 const a=old.resolve({...context,storedProof:proof}),b=next.resolve({...context,storedProof:proof});
 assert.equal(b.status,'resolved');assert.equal(b.id,'old');assert.deepEqual(a.key,b.key);
 for(const phase of ['wild-turn-2','wild-affinity','wild-ball-drop','wild-capture']){
  const draw=key=>createPrivateBattleRandom(key,{...context,phase}).integer(2**32);
  assert.equal(draw(a.key),draw(b.key));
 }
 b.key.fill(0);assert.deepEqual(next.resolve({...context,storedProof:proof}).key,Buffer.from(keys.old,'hex'));
 assert.equal(createWildEntropyKeyring({activeId:'next',keys:{next:keys.next}}).resolve({...context,storedProof:proof}).status,'historical-key-missing');
 assert.equal(next.resolve({...context,storedProof:'x'}).status,'invalid-proof');
 assert.equal(next.resolve({...context,accountId:context.encounterId,storedProof:proof}).status,'historical-key-missing');
 assert.equal(next.resolve({...context}).status,'invalid-proof');
});
test('D6H: config and ownership read fail closed',async()=>{
 assert.throws(()=>createWildEntropyKeyring({activeId:'bad',keys}));
 assert.throws(()=>createWildEntropyKeyring({activeId:'old',keys:{old:keys.old,copy:keys.old}}));
 assert.throws(()=>loadWildEntropyKeyringFromEnv({WILD_CI_ENTROPY_HEX:keys.old}));
 assert.throws(()=>loadWildEntropyKeyringFromEnv({WILD_HMAC_KEYRING_JSON:'{',WILD_HMAC_ACTIVE_KEY_ID:'old'}));
 const ring=loadWildEntropyKeyringFromEnv({WILD_HMAC_KEYRING_JSON:JSON.stringify(keys),WILD_HMAC_ACTIVE_KEY_ID:'next'});
 const pool={query:async(sql,params)=>{assert.match(sql,/WHERE account_id=\$1 AND id=\$2/);assert.deepEqual(params,[context.accountId,context.encounterId]);return {rowCount:1,rows:[{battle_turn_entropy_proof:proof}]};}};
 assert.equal((await selectWildEncounterKey(pool,ring,context)).id,'old');
 assert.equal((await selectWildEncounterKey({query:async()=>({rowCount:0})},ring,context)).status,'missing');
 assert.equal((await selectWildEncounterKey({query:()=>{throw Error('must not query');}},ring,{...context,encounterId:'invalid'})).status,'invalid');
});
