/** ONLINE-01C-7: private, domain-separated encounter entropy.
 *
 * This is a SERVER INTERNAL primitive, not an endpoint and not a battle
 * result generator. Only call it AFTER a server-issued encounterId has been
 * inserted in the DB (or atomically reserved with its action receipt).
 * Never accept an encounter identifier, seed or counter from the browser.
 * The key must be loaded from protected server configuration and never saved
 * in the game save, log, response or a client bundle.
 */
import {createHmac} from 'node:crypto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_U32=2**32;
export const BATTLE_ENTROPY_VERSION='kanto-battle-entropy-v1';

/** Return a stateful, reproducible sequence for one persisted encounter/phase. */
export function createPrivateBattleRandom(secret,{accountId,encounterId,phase}){
  if(!Buffer.isBuffer(secret)||secret.length<32)
    throw new TypeError('Battle entropy requires a 32+ byte server-only key');
  if(typeof accountId!=='string'||!UUID.test(accountId)||
     typeof encounterId!=='string'||!UUID.test(encounterId)||
     typeof phase!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(phase))
    throw new TypeError('Server-issued encounter identity required');
  const context=JSON.stringify([
    BATTLE_ENTROPY_VERSION,accountId.toLowerCase(),
    encounterId.toLowerCase(),phase
  ]);
  let counter=0;
  function nextU32(){
    if(!Number.isSafeInteger(counter))throw new RangeError('RNG draw limit');
    const bytes=createHmac('sha256',secret)
      .update(context).update(':').update(String(counter++))
      .digest();
    return bytes.readUInt32BE(0);
  }
  return Object.freeze({
    /** Unbiased integer in [0, exclusiveMax). No Math.random and no modulo bias. */
    integer(exclusiveMax){
      if(!Number.isSafeInteger(exclusiveMax)||exclusiveMax<1||
        exclusiveMax>MAX_U32)throw new RangeError('Invalid random upper bound');
      const limit=Math.floor(MAX_U32/exclusiveMax)*exclusiveMax;
      let n;
      do{n=nextU32();}while(n>=limit);
      return n%exclusiveMax;
    },
    /** Float in [0,1) for simulation logic, not a security token. */
    unit(){return nextU32()/MAX_U32;}
  });
}


/** Full-strength, encounter-specific proof of the server HMAC key chosen
 * for the FIRST committed turn. Persist only this MAC, never key or seed.
 * Subsequent turns and payout must require the same historical key.
 */
export function createPrivateBattleKeyProof(secret,{accountId,encounterId}){
  if(!Buffer.isBuffer(secret)||secret.length<32||
     typeof accountId!=='string'||!UUID.test(accountId)||
     typeof encounterId!=='string'||!UUID.test(encounterId))
    throw new TypeError('Server-only encounter key proof requires valid identity');
  return createHmac('sha256',secret).update(JSON.stringify([
    BATTLE_ENTROPY_VERSION,'wild-turn-key-proof-v1',
    accountId.toLowerCase(),encounterId.toLowerCase()
  ])).digest('hex');
}
