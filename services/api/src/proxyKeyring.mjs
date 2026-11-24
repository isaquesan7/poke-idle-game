/** Offline proxy key lifecycle, with separate issuer and receiver configuration.
 * HMAC is symmetric: receiver key material can also sign; this is separation
 * of configuration/capabilities, not asymmetric cryptographic authorization.
 * Never pass subject key to the API or previous signing key to the issuer.
 */
import {timingSafeEqual} from 'node:crypto';
import {signProxyIdentity,verifyProxyIdentity,validateProxySubjectPolicy} from './proxyIdentity.mjs';
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
function configKeys(config,allowed){
  if(!config||typeof config!=='object'||Array.isArray(config)||
    Object.keys(config).some(key=>!allowed.includes(key)))
    throw new TypeError('Unexpected proxy key configuration');
}
export function createProxyIssuer(config){
  configKeys(config,['activeHex','subjectHex','notBeforeMs','subjectPolicy']);
  const {activeHex,subjectHex,notBeforeMs,subjectPolicy}=config;
  const policy=validateProxySubjectPolicy(subjectPolicy);
  const active=decode(activeHex),subject=decode(subjectHex);
  if(timingSafeEqual(active,subject))throw new TypeError('Proxy keys must differ');
  const notBefore=notBeforeMs===undefined?0:instant(notBeforeMs);
  return Object.freeze({
    sign(request,nowMs=Date.now()){
      const now=instant(nowMs);
      if(now<notBefore)throw new Error('Signing key not active yet');
      return signProxyIdentity({...request,subjectKey:subject,signingKey:active,subjectPolicy:policy,nowMs:now});
    }
  });
}
export function createProxyReceiver(config){
  configKeys(config,['activeHex','previousHex','cutoverMs']);
  const {activeHex,previousHex,cutoverMs}=config;
  const active=decode(activeHex);
  const hasPrevious=previousHex!==undefined;
  if(hasPrevious!==(cutoverMs!==undefined))throw new TypeError('Incomplete rotation');
  const previous=hasPrevious?decode(previousHex):null;
  if(previous&&timingSafeEqual(previous,active))throw new TypeError('Proxy keys must differ');
  const cutover=hasPrevious?instant(cutoverMs):null;
  function select(request,now){
    const a=verifyProxyIdentity({...request,signingKey:active,nowMs:now});
    if(a&&(!previous||a.issuedAtMs>=cutover))return {key:active,verified:a};
    if(!previous||now>cutover+32000)return null;
    const old=verifyProxyIdentity({...request,signingKey:previous,nowMs:now});
    return old&&old.issuedAtMs<=cutover+2000?{key:previous,verified:old}:null;
  }
  return Object.freeze({
    verify(request,nowMs=Date.now()){
      return select(request,instant(nowMs))?.verified??null;
    },
    async consume(pool,request,nowMs=Date.now()){
      const now=instant(nowMs),selected=select(request,now);
      if(!selected)return null;
      return consumeProxyIdentity(pool,{...request,signingKey:selected.key,nowMs:now});
    }
  });
}
