/** ONLINE-01C-23E24: public-only observation client for disposable gateway.
 * Operator supplies independently established egress IP; never derives it
 * from this gateway or echoes it. No account credentials or production target.
 */
import {request} from 'node:https';
import {isIP} from 'node:net';
import {pathToFileURL} from 'node:url';
import {publicTarget} from './run-gateway-cross-project.mjs';

const cases=Object.freeze([
  ['baseline',[]],
  ['forged-real-ip',['X-Real-IP','192.0.2.123']],
  ['forged-forwarded',['X-Forwarded-For','198.51.100.123','Forwarded','for=198.51.100.123']],
  ['duplicate-real-ip',['X-Real-IP','192.0.2.123','X-Real-IP','198.51.100.123']],
  ['invalid-real-ip',['X-Real-IP','invalid']],
  ['chain-real-ip',['X-Real-IP','192.0.2.123, 198.51.100.123']],
  ['forged-edge',['X-Railway-Edge','synthetic-edge','X-Real-IP','192.0.2.123']]
]);
const booleans=['realIpValid','expectedValid','matchesExpected','matchesSocketPeer',
  'forwardedHeaderPresent','edgeHeaderPresent','syntheticProofVerified',
  'productionTrustGranted','upstreamContacted'];
export function safeObservation(status,body){
  if(status!==200)return {status:Number.isInteger(status)?status:null};
  const data=JSON.parse(body);
  if(!Number.isSafeInteger(data.realIpHeaderCount)||data.realIpHeaderCount<0||
    !booleans.every(k=>typeof data[k]==='boolean'))throw new Error('Invalid diagnostic response');
  return {status:200,realIpHeaderCount:data.realIpHeaderCount,
    ...Object.fromEntries(booleans.map(k=>[k,data[k]]))};
}
function httpsObservation(target,headers,family){
  return new Promise(resolve=>{
    let req,done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
    const timer=setTimeout(()=>{finish({status:null,error:'deadline'});req?.destroy();},6000);
    try{
      req=request(target,{method:'GET',headers,family,agent:false},res=>{
        let body='',size=0;
        res.on('data',chunk=>{size+=chunk.length;if(size>2048){finish({status:null,error:'oversized'});req.destroy();return;}body+=chunk;});
        res.on('error',()=>finish({status:null,error:'response-error'}));
        res.on('end',()=>{try{finish(safeObservation(res.statusCode,body));}
          catch{finish({status:null,error:'invalid-response'});}});
      });
      req.on('error',()=>finish({status:null,error:'network-error'}));
      req.end();
    }catch{finish({status:null,error:'network-error'});}
  });
}
export async function observePublicGateway({url,token,expectedIp,family,probe=httpsObservation}){
  const target=publicTarget(url);
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||
    ![4,6].includes(family)||typeof expectedIp!=='string'||isIP(expectedIp)!==family||
    expectedIp.includes('%')||/^::ffff:/i.test(expectedIp))
    throw new TypeError('Temporary token and independent IP of the selected family required');
  const common=['Host',target.host,'Authorization','Bearer '+token,
    'X-Kanto-Probe-Expected',expectedIp,'Connection','close'];
  const observations=[];
  for(const [name,extra] of cases){
    let observation;
    try{
      const raw=await probe(target,[...common,...extra],family);
      observation=raw.status===200?safeObservation(200,JSON.stringify(raw)):
        {status:Number.isInteger(raw.status)?raw.status:null,
          ...(['deadline','oversized','response-error','invalid-response','network-error'].includes(raw.error)?{error:raw.error}:{})};
    }catch{observation={status:null,error:'invalid-response'};}
    const passed=observation.status===200&&observation.realIpHeaderCount===1&&
      observation.realIpValid&&observation.expectedValid&&observation.matchesExpected&&
      !observation.matchesSocketPeer&&observation.syntheticProofVerified&&
      observation.productionTrustGranted===false&&observation.upstreamContacted===false;
    observations.push({case:name,...observation,passed:!!passed});
  }
  return {referenceFamily:family,observations,publicGatewayConsistent:observations.every(x=>x.passed),
    productionTrustGranted:false,scope:'One operator-supplied reference and network; not proof of ingress isolation'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const report=await observePublicGateway({url:process.env.INGRESS_PROBE_URL,
      token:process.env.INGRESS_PROBE_TOKEN,expectedIp:process.env.INGRESS_PROBE_EXPECTED_IP,
      family:Number(process.env.INGRESS_PROBE_FAMILY)});
    for(const observation of report.observations)console.log(JSON.stringify(observation));
    const {observations,...summary}=report;
    console.log(JSON.stringify(summary));
    if(!report.publicGatewayConsistent)process.exitCode=1;
  }catch{console.error('Public gateway observation incomplete; check temporary URL, token, IP reference and family');process.exitCode=1;}
}
