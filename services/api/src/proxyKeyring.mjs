/** Offline candidate: signing-key rollover for short-lived proxy assertions.
 * No HTTP or environment wiring. Never expose key bytes in the returned API.
 * After recovery from backup, construct with fresh signing key and NO previous.
 */
import {timingSafeEqual} from 'node:crypto';
import {signProxyIdentity,verifyProxyIdentity} from './proxyIdentity.mjs';
import {consumeProxyIdentity} from './proxyNonceGuard.mjs';

const decode=value=>{
  if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))
    throw new TypeError('Proxy key must be canonical 32-byte hex');
  return Buffer.from(value,'hex');
};
const instant=value=>{
  if(!Number.isSafeInteger(value)||value<0||value>Number.MAX_SAFE_INTEGER-32000)
    throw new TypeError('Invalid rotation clock');
  return value;
};
export function createProxyKeyring({activeHex,subjectHex,previousHex,cutoverMs}={}){
  const active=decode(activeHex),subject=decode(subjectHex);
  if(timingSafeEqual(active,subject))throw new TypeError('Proxy keys must differ');
  const hasPrevious=previousHex!==undefined;
  if(hasPrevious!==(cutoverMs!==undefined))throw new TypeError('Incomplete rotation');
  const previous=hasPrevious?decode(previousHex):null;
  if(previous&&(timingSafeEqual(previous,active)||timingSafeEqual(previous,subject)))
    throw new TypeError('Proxy keys must differ');
  const cutover=hasPrevious?instant(cutoverMs):null;
  // No previous assertion may have been issued after cutover (plus 2s skew),
  // and the overlap is bounded even if old keys remain configured.
  function select(request,now){
    const a=verifyProxyIdentity({...request,signingKey:active,nowMs:now});
    if(a)return active;
    if(!previous||now>cutover+32000)return null;
    const old=verifyProxyIdentity({...request,signingKey:previous,nowMs:now});
    return old&&old.issuedAtMs<=cutover+2000?previous:null;
  }
  return Object.freeze({
    sign(request,nowMs=Date.now()){
      const now=instant(nowMs);
      if(previous&&now<cutover)throw new Error('Signing key not active yet');
      return signProxyIdentity({...request,subjectKey:subject,signingKey:active,nowMs:now});
    },
    verify(request,nowMs=Date.now()){
      const now=instant(nowMs),key=select(request,now);
      if(!key)return null;
      return verifyProxyIdentity({...request,signingKey:key,nowMs:now});
    },
    async consume(pool,request,nowMs=Date.now()){
      const now=instant(nowMs),key=select(request,now);
      if(!key)return null;
      // One common nonce table for active and previous signatures.
      return consumeProxyIdentity(pool,{...request,signingKey:key,nowMs:now});
    }
  });
}
