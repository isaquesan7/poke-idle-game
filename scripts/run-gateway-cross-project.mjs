/** Cross-project isolation observation, not an authorization mechanism.
 * One fixed synthetic target and one same-environment positive control.
 * No real account data, raw IP output, or arbitrary network destinations.
 */
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
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

/** Only literal RFC1918 IPv4 or ULA IPv6 addresses from disposable services.
 * No DNS fallback, port override, mapped IPv6, zones, or public addresses.
 */
export function privateLiteral(value){
  if(typeof value!=='string'||value!==value.trim())throw new TypeError('Private literal required');
  const family=isIP(value);
  const octets=family===4?value.split('.').map(Number):[];
  const privateV4=family===4&&(octets[0]===10||
    (octets[0]===172&&octets[1]>=16&&octets[1]<=31)||
    (octets[0]===192&&octets[1]===168));
  const privateV6=family===6&&/^f[cd][0-9a-f]{2}:/i.test(value)&&!value.includes('%');
  if(!privateV4&&!privateV6)throw new TypeError('Private literal required');
  const url=new URL('http://'+(family===6?'['+value+']':value)+':3000/probe');
  return {family,url};
}
async function controlLiterals(resolve){
  let timer;
  try{
    const rows=await Promise.race([resolve(new URL(privateControl).hostname,{all:true}),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('control lookup timeout')),3000);
    })]);
    return rows.map(row=>privateLiteral(row.address));
  }finally{clearTimeout(timer);}
}
const routingBlocked=result=>!result.connected&&result.status===null&&
  ['ENETUNREACH','EHOSTUNREACH'].includes(result.reason);
const positiveControl=result=>result.connected&&result.status===200&&
  result.validObservation&&result.forgedMatched;
const summarize=result=>({connected:result.connected===true,status:result.status??null,
  validObservation:result.validObservation===true,
  forgedMatched:result.forgedMatched===true,
  reason:['http-response','ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ENETUNREACH',
    'EHOSTUNREACH','ETIMEDOUT','timeout','oversized','response-error','request-error'].includes(result.reason)?
    result.reason:'unknown'});
export async function observeDirectCrossProject({publicUrl,token,targetAddresses,probe=requestProbe,resolve=lookup}){
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new TypeError('Temporary token required');
  if(!Array.isArray(targetAddresses)||targetAddresses.length<1||targetAddresses.length>4)
    throw new TypeError('One to four inventoried target addresses required');
  const targets=targetAddresses.map(privateLiteral);
  if(new Set(targets.map(x=>x.url.href)).size!==targets.length)throw new TypeError('Duplicate target');
  const origin=publicTarget(publicUrl),controls=await controlLiterals(resolve);
  // Refuse overlapping literal targets or a missing same-family positive control.
  if(targets.some(t=>controls.some(c=>c.url.href===t.url.href)||
    !controls.some(c=>c.family===t.family)))throw new Error('Invalid control inventory');
  const before=summarize(await probe(origin,token));
  const observations=[];
  for(const target of targets){
    const control=controls.find(c=>c.family===target.family);
    const controlBefore=summarize(await probe(control.url,token));
    const cross=summarize(await probe(target.url,token));
    const controlAfter=summarize(await probe(control.url,token));
    observations.push({family:target.family,controlBefore,cross,controlAfter,
      controlsPassed:positiveControl(controlBefore)&&positiveControl(controlAfter),
      explicitRoutingBlock:routingBlocked(cross)});
  }
  const after=summarize(await probe(origin,token));
  const controlsPassed=before.connected&&before.validObservation&&after.connected&&after.validObservation&&
    observations.every(x=>x.controlsPassed);
  return {before,after,observations,controlsPassed,
    noDirectAccessObserved:controlsPassed&&observations.every(x=>x.explicitRoutingBlock),
    productionTrustGranted:false,
    note:'Only inventoried literals and explicit routing failures; timeout/refusal are inconclusive'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.env.GATEWAY_CROSS_PROJECT_ISOLATED!=='true'||
    process.env.RAILWAY_ENVIRONMENT_NAME==='production'||
    ['DATABASE_URL','ONLINE_API_INTERNAL_URL','RESEND_API_KEY','AUTH_RATE_LIMIT_SECRET'].some(k=>process.env[k]))
    throw new Error('Requires empty disposable client project');
  try{
    const args={publicUrl:process.env.GATEWAY_OBSERVATION_PUBLIC_URL,token:process.env.INGRESS_PROBE_TOKEN};
    const mode=process.env.GATEWAY_CROSS_PROJECT_MODE??'dns';
    if(!['dns','direct'].includes(mode))throw new TypeError('Unknown observation mode');
    const report=mode==='direct'?
      await observeDirectCrossProject({...args,targetAddresses:(process.env.GATEWAY_PRIVATE_TARGET_ADDRESSES??'').split(',')}):
      await observeCrossProject(args);
    console.log(JSON.stringify(report));
    if(!(mode==='direct'?report.noDirectAccessObserved:report.noCrossAccessObserved))process.exitCode=1;
  }catch{console.error('Cross-project observation incomplete; no trust conclusion');process.exitCode=1;}
}
