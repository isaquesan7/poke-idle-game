/** Cross-project isolation observation, not an authorization mechanism.
 * One fixed synthetic target and one same-environment positive control.
 * No real account data, raw IP output, or arbitrary network destinations.
 */
import {lookup} from 'node:dns/promises';
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {pathToFileURL} from 'node:url';

const privateTarget='http://gateway-isolation-target.railway.internal:3000/probe';
const privateControl='http://gateway-isolation-control.railway.internal:3000/probe';
export function publicTarget(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||!/^gateway-isolation-target(?:-[a-z0-9-]+)?\.up\.railway\.app$/.test(url.hostname)||
    url.port||url.pathname!=='/probe'||url.search||url.hash||url.username||url.password)
    throw new TypeError('Only dedicated temporary gateway domain is permitted');
  return url;
}
function requestProbe(url,token,transport=url.protocol==='https:'?httpsRequest:httpRequest){
  return new Promise(resolve=>{
    let settled=false,connected=false,req;
    const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
    const timer=setTimeout(()=>{finish({connected,status:null,validObservation:false,reason:'timeout'});req?.destroy();},5000);
    try{
      req=transport(url,{method:'GET',headers:{Authorization:'Bearer '+token,
        'X-Real-IP':'192.0.2.123','X-Kanto-Probe-Expected':'192.0.2.123',
        'X-Railway-Edge':'synthetic-edge',Connection:'close'}},res=>{
        connected=true;
        let body='',bytes=0;
        res.on('data',chunk=>{
          bytes+=chunk.length;if(bytes>2048){finish({connected,status:res.statusCode,validObservation:false,reason:'oversized'});req.destroy();return;}
          body+=chunk;
        });
        res.on('error',()=>finish({connected,status:res.statusCode,validObservation:false,reason:'response-error'}));
        res.on('end',()=>{
          let validObservation=false,forgedMatched=false;
          try{
            const v=JSON.parse(body);
            validObservation=res.statusCode===200&&typeof v.realIpValid==='boolean'&&
              typeof v.matchesExpected==='boolean'&&typeof v.syntheticProofVerified==='boolean'&&
              v.productionTrustGranted===false&&v.upstreamContacted===false;
            forgedMatched=validObservation&&v.matchesExpected&&v.syntheticProofVerified;
          }catch{}
          finish({connected,status:res.statusCode,validObservation,forgedMatched,reason:'http-response'});
        });
      });
      req.on('socket',socket=>{if(!socket.connecting)connected=true;else socket.once('connect',()=>{connected=true;});});
      req.on('error',e=>finish({connected,status:null,validObservation:false,reason:
        ['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ENETUNREACH','EHOSTUNREACH','ETIMEDOUT'].includes(e.code)?e.code:'request-error'}));
      req.end();
    }catch{finish({connected,status:null,validObservation:false,reason:'request-error'});}
  });
}
async function dnsObservation(url,resolve=lookup){
  let timer;
  try{
    const results=await Promise.race([resolve(url.hostname,{all:true}),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Object.assign(Error(),{code:'TIMEOUT'})),3000);
    })]);
    return {resolved:results.length>0,ipv4:results.some(x=>x.family===4),ipv6:results.some(x=>x.family===6),reason:'resolved'};
  }catch(e){return {resolved:false,ipv4:false,ipv6:false,reason:
    ['ENOTFOUND','EAI_AGAIN','TIMEOUT'].includes(e.code)?e.code:'dns-error'};}
  finally{clearTimeout(timer);}
}
export async function observeCrossProject({publicUrl,token,probe=requestProbe,resolve=lookup}){
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new TypeError('Temporary token required');
  const publicOrigin=publicTarget(publicUrl),control=new URL(privateControl),target=new URL(privateTarget);
  const before=await probe(publicOrigin,token);
  const controlDns=await dnsObservation(control,resolve);
  const controlHttp=await probe(control,token);
  const targetDns=await dnsObservation(target,resolve);
  // Attempt HTTP even on DNS failure. Never treat a reachable TCP endpoint,
  // arbitrary HTTP error or invalid response as proof of isolation.
  const targetHttp=await probe(target,token);
  const after=await probe(publicOrigin,token);
  const controlsPassed=before.validObservation&&after.validObservation&&controlDns.resolved&&
    controlHttp.validObservation&&controlHttp.forgedMatched;
  const noCrossAccessObserved=controlsPassed&&!targetDns.resolved&&!targetHttp.connected&&
    targetDns.reason==='ENOTFOUND'&&targetHttp.reason==='ENOTFOUND';
  return {before,controlDns,controlHttp,targetDns,targetHttp,after,controlsPassed,
    noCrossAccessObserved,productionTrustGranted:false,
    note:'Bounded observation only; not proof of universal network isolation'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.env.GATEWAY_CROSS_PROJECT_ISOLATED!=='true'||
    process.env.RAILWAY_ENVIRONMENT_NAME==='production'||
    ['DATABASE_URL','ONLINE_API_INTERNAL_URL','RESEND_API_KEY','AUTH_RATE_LIMIT_SECRET'].some(k=>process.env[k]))
    throw new Error('Requires empty disposable client project');
  try{
    const report=await observeCrossProject({publicUrl:process.env.GATEWAY_OBSERVATION_PUBLIC_URL,token:process.env.INGRESS_PROBE_TOKEN});
    console.log(JSON.stringify(report));
    if(!report.noCrossAccessObserved)process.exitCode=1;
  }catch{console.error('Cross-project observation incomplete; no trust conclusion');process.exitCode=1;}
}
