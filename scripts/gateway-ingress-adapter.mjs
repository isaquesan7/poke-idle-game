/** Isolated ingress adapter candidate, not an automatic proof of Railway trust.
 * Only enable after independent review of exclusive public HTTP ingress topology.
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
// These are reviewed deployment facts, NOT attested facts discovered by Node.
const identityFields={projectId:'RAILWAY_PROJECT_ID',environmentId:'RAILWAY_ENVIRONMENT_ID',
  serviceId:'RAILWAY_SERVICE_ID',commitSha:'RAILWAY_GIT_COMMIT_SHA',publicDomain:'RAILWAY_PUBLIC_DOMAIN'};
const reviewFields=[...Object.keys(identityFields),'serviceCount','replicaCount','tcpProxyCount',
  'publicDomainCount','privateCallersExcluded','changeControlReviewed','reviewReference'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function createIngressResolver({review,loopbackTest=false,testRuntime}={}){
  if(loopbackTest&&process.env.NODE_ENV!=='test')throw new Error('Loopback is test-only');
  if(testRuntime!==undefined&&!loopbackTest)throw new Error('Runtime injection is test-only');
  if(!review||typeof review!=='object'||Array.isArray(review)||
    Object.keys(review).some(k=>!reviewFields.includes(k))||
    !['projectId','environmentId','serviceId'].every(k=>typeof review[k]==='string'&&uuid.test(review[k]))||
    typeof review.commitSha!=='string'||!/^[0-9a-f]{40}$/.test(review.commitSha)||
    typeof review.publicDomain!=='string'||!/^[a-z0-9-]+\.up\.railway\.app$/.test(review.publicDomain)||
    review.serviceCount!==1||review.replicaCount!==1||review.tcpProxyCount!==0||
    review.publicDomainCount!==1||review.privateCallersExcluded!==true||review.changeControlReviewed!==true||
    typeof review.reviewReference!=='string'||!review.reviewReference.trim()||review.reviewReference.length>256)
    throw new TypeError('Exclusive reviewed Railway topology required');
  const runtime=loopbackTest?testRuntime:process.env;
  if(!runtime||Object.entries(identityFields).some(([k,v])=>runtime[v]!==review[k]))
    throw new Error('Reviewed deployment identity mismatch');
  // Railway does not publish stable inbound proxy peers. Trust here is conditional
  // on the independently reviewed exclusive topology, not on a socket IP range.
  // A private caller that reaches this listener can still forge X-Real-IP.
  return req=>{
    const peer=canonical(req.socket?.remoteAddress);
    if(!peer||peer==='0.0.0.0'||peer==='::'||
       (!loopbackTest&&(peer.startsWith('127.')||peer==='::1')))return null;
    const real=rawValues(req,'x-real-ip');
    const nominated=rawValues(req,'connection').flatMap(v=>typeof v==='string'?v.split(',').map(s=>s.trim().toLowerCase()):['x-real-ip']);
    if(real.length!==1||nominated.includes('x-real-ip'))return null;
    const ip=canonical(real[0]);
    if(!ip||!publicCandidate(ip)||ip===peer)return null;
    return ip;
  };
}
/** Compose canonical gateway + issuer + strict ingress resolver. Still a candidate:
 * no production launcher, no automatic infrastructure discovery, no new secret.
 */
export function createReviewedAuthGateway({upstreamOrigin,clientOrigin,issuerConfig,ingressConfig,loopbackTest=false}){
  if(loopbackTest&&process.env.NODE_ENV!=='test')throw new Error('Loopback is test-only');
  const resolver=createIngressResolver({...ingressConfig,loopbackTest});
  if(clientOrigin!=='https://'+ingressConfig.review.publicDomain)
    throw new Error('Client origin differs from reviewed domain');
  const issuer=createProxyIssuer(issuerConfig);
  return createAuthGateway({upstreamOrigin,clientOrigin,issuer,resolveTrustedClientIp:resolver,loopbackTest});
}
