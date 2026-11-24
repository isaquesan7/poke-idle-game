/** One-shot direct TCP observation. Fetch encrypted manifests only from the
 * fixed disposable target and control, then connect to their listed private
 * addresses on port 3000 without sending bytes or credentials.
 */
import {pathToFileURL} from 'node:url';
import {publicTarget} from './run-gateway-cross-project.mjs';
import {observeDirectAddresses} from './gateway-direct-address.mjs';

export async function runDirectAddressObservation({publicUrl,token}){
  const target=publicTarget(publicUrl);
  target.pathname='/probe-address';
  const control=new URL('http://gateway-isolation-control.railway.internal:3000/probe-address');
  async function getManifest(role){
    const response=await fetch(role==='target'?target:control,{redirect:'error',
      signal:AbortSignal.timeout(5000),headers:{Authorization:'Bearer '+token}});
    if(response.status!==200){await response.body?.cancel();throw new Error('Inventory unavailable');}
    const reader=response.body.getReader(),parts=[];let bytes=0;
    try{
      for(;;){const {done,value}=await reader.read();if(done)break;
        bytes+=value.byteLength;if(bytes>4096){await reader.cancel();throw new Error('Inventory too large');}
        parts.push(Buffer.from(value));}
    }finally{reader.releaseLock();}
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  }
  return observeDirectAddresses({token,getManifest});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.env.GATEWAY_CROSS_PROJECT_ISOLATED!=='true'||process.env.RAILWAY_ENVIRONMENT_NAME==='production'||
    ['DATABASE_URL','ONLINE_API_INTERNAL_URL','RESEND_API_KEY','AUTH_RATE_LIMIT_SECRET'].some(k=>process.env[k]))
    throw new Error('Requires empty disposable client project');
  try{
    const report=await runDirectAddressObservation({publicUrl:process.env.GATEWAY_OBSERVATION_PUBLIC_URL,
      token:process.env.INGRESS_PROBE_TOKEN});
    console.log(JSON.stringify(report));
    if(!report.noDirectAccessObserved)process.exitCode=1;
  }catch{console.error('Direct address observation incomplete; no trust conclusion');process.exitCode=1;}
}
