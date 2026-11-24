/** 23E21: bounded observation of candidate isolated gateway ingress.
 * No account handlers, real signing keys, upstream forwarding or database.
 * The returned booleans are observations, never an authorization decision.
 */
import {createServer} from 'node:http';
import {createHash,timingSafeEqual,randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {issueAddressManifest} from './gateway-direct-address.mjs';
import {observeIngress} from './railway-ingress-probe.mjs';
import {signProxyIdentity,verifyProxyIdentity} from '../services/api/src/proxyIdentity.mjs';

const digest=value=>createHash('sha256').update(value).digest();
function values(raw,name){
  const result=[];
  for(let i=0;i<raw.length;i+=2)if(raw[i].toLowerCase()===name)result.push(raw[i+1]);
  return result;
}
export function createGatewayObservation({token,now=Date.now,lifetimeMs=900000,maxRequests=60,addressRole,resolveAddress}){
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||
    !Number.isInteger(lifetimeMs)||lifetimeMs<1||lifetimeMs>900000||
    !Number.isInteger(maxRequests)||maxRequests<1||maxRequests>60)
    throw new TypeError('Invalid isolated observation configuration');
  if(addressRole!==undefined&&!['target','control'].includes(addressRole))throw new TypeError('Invalid disposable address role');
  const expected=digest('Bearer '+token),expires=now()+lifetimeMs;
  // Ephemeral synthetic keys never leave memory; no production key accepted.
  const signingKey=randomBytes(32),subjectKey=randomBytes(32);
  let count=0;
  return createServer({requestTimeout:5000,headersTimeout:5000,maxHeaderSize:8192},async(req,res)=>{
    const respond=(status,data)=>{
      res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff','Connection':'close'});
      res.end(JSON.stringify(data));
    };
    if(req.method!=='GET'||(req.url!=='/probe'&&!(addressRole&&req.url==='/probe-address'))||req.headers['transfer-encoding']||
      (req.headers['content-length']&&req.headers['content-length']!=='0'))return respond(404,{ok:false});
    const auth=values(req.rawHeaders,'authorization');
    if(auth.length!==1||!timingSafeEqual(digest(auth[0]),expected))return respond(404,{ok:false});
    if(now()>=expires||count>=maxRequests)return respond(410,{ok:false});
    count++;
    if(req.url==='/probe-address'){
      try{return respond(200,await issueAddressManifest({role:addressRole,token,now,...(resolveAddress?{resolve:resolveAddress}:{})}));}
      catch{return respond(503,{ok:false});}
    }
    const observation=observeIngress(req.rawHeaders,req.socket.remoteAddress);
    const raw=values(req.rawHeaders,'x-real-ip');
    const nominated=String(req.headers.connection??'').split(',').map(v=>v.trim().toLowerCase());
    let syntheticProofVerified=false;
    if(observation.realIpValid&&!nominated.includes('x-real-ip')){
      // This signs only a fixed synthetic body in an in-memory namespace.
      // No assertion, subject, IP, or secret is returned or forwarded.
      const request={method:'POST',path:'/api/v1/auth/login',body:Buffer.from('{"synthetic":true}'),
        nowMs:now()};
      try{
        const assertion=signProxyIdentity({...request,trustedClientIp:raw[0],signingKey,subjectKey});
        syntheticProofVerified=!!verifyProxyIdentity({...request,assertion,signingKey});
      }catch{}
    }
    return respond(200,{...observation,syntheticProofVerified,
      productionTrustGranted:false,upstreamContacted:false});
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.env.GATEWAY_OBSERVATION_ISOLATED!=='true'||
    process.env.RAILWAY_ENVIRONMENT_NAME==='production'||
    ['DATABASE_URL','ONLINE_API_INTERNAL_URL','ONLINE_SIGNED_QUOTA_TEST_KEY','AUTH_RATE_LIMIT_SECRET',
      'RESEND_API_KEY','ACCOUNT_MAIL_KEYRING_JSON'].some(k=>process.env[k]))
    throw new Error('Gateway observation requires an empty isolated environment');
  const port=Number(process.env.PORT||3000);
  const addressRole=process.env.GATEWAY_ADDRESS_ROLE;
  if(addressRole&&process.env.RAILWAY_SERVICE_NAME!==('gateway-isolation-'+addressRole))
    throw new Error('Address inventory limited to named disposable service');
  createGatewayObservation({token:process.env.INGRESS_PROBE_TOKEN,addressRole}).listen(port,'::');
}
