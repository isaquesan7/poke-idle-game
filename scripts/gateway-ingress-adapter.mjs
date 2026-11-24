/** Isolated ingress adapter candidate, not an automatic proof of Railway trust.
 * Only enable after independent review of the actual ingress peers and topology.
 * Never treat X-Railway-Edge, forwarded chains or caller-supplied IP as credentials.
 */
import {isIP} from 'node:net';
import {canonicalClientIp} from '../services/api/src/proxyIdentity.mjs';
import {createProxyIssuer} from '../services/api/src/proxyKeyring.mjs';
import {createAuthGateway} from './auth-gateway-candidate.mjs';

function canonical(value){try{return canonicalClientIp(value);}catch{return null;}}
function rawValues(req,name){
  if(!Array.isArray(req.rawHeaders)||req.rawHeaders.length%2)return [];
  const values=[];
  for(let i=0;i<req.rawHeaders.length;i+=2)
    if(typeof req.rawHeaders[i]==='string'&&req.rawHeaders[i].toLowerCase()===name)
      values.push(req.rawHeaders[i+1]);
  return values;
}
function publicCandidate(ip){
  if(isIP(ip)===4){
    const [a,b,c]=ip.split('.').map(Number);
    return a!==0&&a!==10&&a!==127&&a<224&&
      !(a===100&&b>=64&&b<=127)&&!(a===169&&b===254)&&
      !(a===172&&b>=16&&b<=31)&&!(a===192&&(b===168||b===0&&[0,2].includes(c)))&&
      !(a===198&&[18,19].includes(b))&&!(a===198&&b===51&&c===100)&&
      !(a===203&&b===0&&c===113);
  }
  // Conservative global-unicast candidate, not proof of global routability.
  if(isIP(ip)!==6)return false;
  const first=parseInt(ip.split(':')[0],16),second=parseInt(ip.split(':')[1]||'0',16);
  return first>=0x2000&&first<=0x3fff&&!(first===0x2001&&(second===0xdb8||second<0x200))&&
    !(first===0x2002)&&!(first===0x3fff&&second<0x1000);
}
export function createIngressResolver({trustedPeers,topologyReviewed,loopbackTest=false}={}){
  if(topologyReviewed!==true||!Array.isArray(trustedPeers)||trustedPeers.length<1||trustedPeers.length>16)
    throw new TypeError('Reviewed topology and exact ingress peers required');
  if(loopbackTest&&process.env.NODE_ENV!=='test')throw new Error('Loopback is test-only');
  const peers=new Set();
  for(const value of trustedPeers){
    const ip=canonical(value);
    if(!ip||ip==='0.0.0.0'||ip==='::'||(!loopbackTest&&(ip.startsWith('127.')||ip==='::1')))
      throw new TypeError('Invalid exact ingress peer');
    if(peers.has(ip))throw new TypeError('Duplicate ingress peer');
    peers.add(ip);
  }
  return req=>{
    const peer=canonical(req.socket?.remoteAddress);
    if(!peer||!peers.has(peer))return null;
    const real=rawValues(req,'x-real-ip');
    const nominated=rawValues(req,'connection').flatMap(v=>typeof v==='string'?v.split(',').map(s=>s.trim().toLowerCase()):['x-real-ip']);
    if(real.length!==1||nominated.includes('x-real-ip'))return null;
    const ip=canonical(real[0]);
    if(!ip||!publicCandidate(ip)||peers.has(ip))return null;
    return ip;
  };
}
/** Compose canonical gateway + issuer + strict ingress resolver. Still a candidate:
 * no production launcher, no automatic infrastructure discovery, no new secret.
 */
export function createReviewedAuthGateway({upstreamOrigin,clientOrigin,issuerConfig,ingressConfig,loopbackTest=false}){
  if(loopbackTest&&process.env.NODE_ENV!=='test')throw new Error('Loopback is test-only');
  const resolver=createIngressResolver({...ingressConfig,loopbackTest});
  const issuer=createProxyIssuer(issuerConfig);
  return createAuthGateway({upstreamOrigin,clientOrigin,issuer,resolveTrustedClientIp:resolver,loopbackTest});
}
