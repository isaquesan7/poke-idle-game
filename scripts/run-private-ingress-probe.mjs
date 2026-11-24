/** Disposable private-network observation. Never used by the game runtime.
 * No databases, account data, public IPs, or identity signatures.
 */
import {request} from 'node:http';
import {pathToFileURL} from 'node:url';

export function validatePrivateProbeTarget(value){
  const url=new URL(value);
  if(url.protocol!=='http:'||url.hostname!=='ingress-target.railway.internal'||
     url.port!=='3000'||url.pathname!=='/probe'||url.search||url.hash||
     url.username||url.password)throw new TypeError('Only the isolated target is permitted');
  return url;
}
export async function runPrivateProbe({target,token,transport=request}){
  if(!/^[a-f0-9]{64}$/.test(token??''))throw new TypeError('Temporary token required');
  const expected='192.0.2.123';
  const base=['Authorization','Bearer '+token,'X-Kanto-Probe-Expected',expected,'Connection','close'];
  const scenarios=[
    ['private-baseline',[]],
    ['private-forged-real-ip',['X-Real-IP',expected]],
    ['private-forged-edge',['X-Real-IP',expected,'X-Railway-Edge','synthetic-edge']],
    ['private-duplicate',['X-Real-IP',expected,'X-Real-IP','198.51.100.123']]
  ];
  const results=[];
  for(const [name,extra] of scenarios){
    const response=await new Promise((resolve,reject)=>{
      const req=transport(target,{method:'GET',headers:['Host',target.host,...base,...extra],timeout:5000},res=>{
        let text='',length=0;
        res.on('data',chunk=>{length+=chunk.length;if(length>2048){req.destroy();reject(Error('Response too large'));return;}text+=chunk;});
        res.on('error',()=>reject(Error('Private probe failed')));
        res.on('end',()=>{
          if(res.statusCode!==200)return resolve({status:res.statusCode});
          try{
            const value=JSON.parse(text);
            const fields=['realIpValid','expectedValid','matchesExpected','matchesSocketPeer','forwardedHeaderPresent','edgeHeaderPresent'];
            if(!Number.isSafeInteger(value.realIpHeaderCount)||value.realIpHeaderCount<0||
               !fields.every(field=>typeof value[field]==='boolean'))throw Error();
            const safe={status:200,realIpHeaderCount:value.realIpHeaderCount};
            for(const field of fields)safe[field]=value[field];
            resolve(safe);
          }catch{reject(Error('Invalid probe response'));}
        });
      });
      req.on('timeout',()=>req.destroy());
      req.on('error',()=>reject(Error('Private probe unavailable')));
      req.end();
    });
    results.push({case:name,...response});
  }
  return {results,allObserved:results.every(x=>x.status===200),
    forgedHeaderReachedTarget:results.some(x=>x.case.startsWith('private-forged')&&x.matchesExpected===true),
    note:'Observation only; no trusted ingress decision'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.env.INGRESS_PROBE_ISOLATED!=='true'||process.env.DATABASE_URL||
    process.env.ONLINE_API_INTERNAL_URL||process.env.RAILWAY_ENVIRONMENT_NAME==='production')
    throw new Error('Private probe requires separate empty environment');
  try{
    const report=await runPrivateProbe({target:validatePrivateProbeTarget(process.env.INGRESS_PRIVATE_PROBE_URL),
      token:process.env.INGRESS_PROBE_TOKEN});
    console.log(JSON.stringify(report));
    if(!report.allObserved)process.exitCode=1;
  }catch{console.error('Private probe incomplete; no trust conclusion');process.exitCode=1;}
}
