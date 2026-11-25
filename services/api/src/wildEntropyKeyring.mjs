/** D6H — server-only candidate. Retain historical keys for unfinished encounters.
 * No environment flag activates a public route. No key, proof or seed in response.
 */
import {timingSafeEqual} from 'node:crypto';
import {createPrivateBattleKeyProof} from './battleEntropy.mjs';
const ID=/^[a-z][a-z0-9_-]{0,31}$/;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const HEX=/^[a-f0-9]{64}$/;
export function createWildEntropyKeyring({activeId,keys}={}){
 if(typeof activeId!=='string'||!ID.test(activeId)||!keys||typeof keys!=='object'||Array.isArray(keys)||!Object.hasOwn(keys,activeId))throw new Error('Invalid regional keyring');
 const versions=new Map(),unique=new Set();
 for(const [id,hex] of Object.entries(keys)){
  if(!ID.test(id)||typeof hex!=='string'||!HEX.test(hex)||unique.has(hex))throw new Error('Invalid regional keyring entry');
  unique.add(hex);versions.set(id,Buffer.from(hex,'hex'));
 }
 if(versions.size>16)throw new Error('Regional keyring too large');
 return Object.freeze({
  resolve({accountId,encounterId,storedProof}={}){
   if(typeof accountId!=='string'||!UUID.test(accountId)||typeof encounterId!=='string'||!UUID.test(encounterId))return {status:'invalid'};
   if(storedProof===null)return {status:'new',id:activeId,key:Buffer.from(versions.get(activeId))};
   if(typeof storedProof!=='string'||!HEX.test(storedProof))return {status:'invalid-proof'};
   const matches=[...versions].filter(([,key])=>timingSafeEqual(Buffer.from(storedProof,'hex'),Buffer.from(createPrivateBattleKeyProof(key,{accountId,encounterId}),'hex')));
   if(matches.length!==1)return {status:matches.length?'ambiguous':'historical-key-missing'};
   return {status:'resolved',id:matches[0][0],key:Buffer.from(matches[0][1])};
  }
 });
}
/** Parse protected config only; deliberately not called by production runtime yet. */
export function loadWildEntropyKeyringFromEnv(env=process.env){
 const raw=env.WILD_HMAC_KEYRING_JSON;
 if(typeof raw!=='string'||raw.length>4096)throw new Error('Regional keyring unavailable');
 let keys;try{keys=JSON.parse(raw);}catch{throw new Error('Invalid regional keyring JSON');}
 return createWildEntropyKeyring({activeId:env.WILD_HMAC_ACTIVE_KEY_ID,keys});
}
/** Selection read only. The actual writers recheck proof under transactional locks. */
export async function selectWildEncounterKey(pool,keyring,{accountId,encounterId}){
 if(typeof accountId!=='string'||!UUID.test(accountId)||typeof encounterId!=='string'||!UUID.test(encounterId)||typeof keyring?.resolve!=='function')return {status:'invalid'};
 const q=await pool.query('SELECT battle_turn_entropy_proof FROM game_encounter_reservations WHERE account_id=$1 AND id=$2',[accountId,encounterId]);
 if(q.rowCount!==1)return {status:'missing'};
 return keyring.resolve({accountId,encounterId,storedProof:q.rows[0].battle_turn_entropy_proof});
}
