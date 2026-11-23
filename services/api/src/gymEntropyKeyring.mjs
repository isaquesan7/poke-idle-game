/** ONLINE-01C-23C1 — server-only, versioned Gym HMAC keyring.
 * Historical keys must remain configured for the entire receipt-retention
 * window. NEVER put key bytes in Postgres, API responses, client or logs.
 * This module is a provider, not a public action endpoint.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';

const ID=/^[a-z][a-z0-9_-]{0,31}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function gymEntropyProof(secret,{accountId,gymReservationId}){
  if(!Buffer.isBuffer(secret)||secret.length<32||
     typeof accountId!=='string'||!UUID.test(accountId)||
     typeof gymReservationId!=='string'||!UUID.test(gymReservationId))
    throw new TypeError('Invalid Gym entropy identity');
  return createHmac('sha256',secret).update(JSON.stringify([
    'kanto-gym-entropy-v1','gym-key-proof-v1',
    accountId.toLowerCase(),gymReservationId.toLowerCase()
  ])).digest('hex');
}
const equalsHex=(a,b)=>{
  if(typeof a!=='string'||!/^[a-f0-9]{64}$/.test(a)||
     typeof b!=='string'||!/^[a-f0-9]{64}$/.test(b))return false;
  return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
};
/** Explicit server config. Keys must be base64-encoded 32+ bytes.
 * Throw instead of silently generating/replacing a secret on process restart.
 */
export function createGymEntropyKeyring({activeId,keys}={}){
  if(typeof activeId!=='string'||!ID.test(activeId)||
    !keys||typeof keys!=='object'||Array.isArray(keys)||
    !Object.keys(keys).length||!Object.hasOwn(keys,activeId))
    throw new TypeError('Gym keyring must configure an active version');
  const versions=new Map();
  for(const [id,base64] of Object.entries(keys)){
    if(!ID.test(id)||typeof base64!=='string'||
       !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))
      throw new TypeError('Malformed Gym keyring entry');
    const key=Buffer.from(base64,'base64');
    if(key.length<32||key.toString('base64')!==base64)
      throw new TypeError('Weak or noncanonical Gym keyring entry');
    versions.set(id,key);
  }
  const get=id=>versions.get(id)??null;
  return Object.freeze({
    activeId,
    // Key selection only occurs inside trusted backend code.
    active:()=>({id:activeId,key:Buffer.from(get(activeId))}),
    resolve({keyId,storedProof,accountId,gymReservationId}){
      if(typeof accountId!=='string'||!UUID.test(accountId)||
         typeof gymReservationId!=='string'||!UUID.test(gymReservationId))
        return {status:'invalid'};
      const context={accountId,gymReservationId};
      if(keyId!==null&&keyId!==undefined){
        if(typeof keyId!=='string'||!ID.test(keyId))return {status:'invalid-key-id'};
        const key=get(keyId);
        if(!key)return {status:'historical-key-missing'};
        if(!equalsHex(gymEntropyProof(key,context),storedProof))
          return {status:'entropy-mismatch'};
        return {status:'resolved',id:keyId,key:Buffer.from(key)};
      }
      if(storedProof===null||storedProof===undefined){
        const key=get(activeId);
        return {status:'new',id:activeId,key:Buffer.from(key)};
      }
      // Migration-safe matching for pre-versioned historical receipts.
      // A missing historical secret must FAIL CLOSED, not use the active key.
      const matches=[...versions.entries()].filter(([,key])=>
        equalsHex(gymEntropyProof(key,context),storedProof));
      if(matches.length!==1)return {status:matches.length?'ambiguous':'historical-key-missing'};
      return {status:'legacy',id:matches[0][0],key:Buffer.from(matches[0][1])};
    }
  });
}
/** Load ONLY from protected server configuration, never from request input. */
export function loadGymEntropyKeyringFromEnv(env=process.env){
  if(typeof env.GYM_HMAC_KEYRING_JSON!=='string'||env.GYM_HMAC_KEYRING_JSON.length>16384)
    throw new Error('Gym server keyring secret not configured');
  let keys;
  try{keys=JSON.parse(env.GYM_HMAC_KEYRING_JSON);}catch{
    throw new Error('Gym server keyring config is invalid');
  }
  return createGymEntropyKeyring({
    activeId:env.GYM_HMAC_ACTIVE_KEY_ID,keys
  });
}
