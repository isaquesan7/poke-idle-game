/** Separate gateway runtime. Disabled by default; never starts the account API.
 * The topology review is externally supplied, not an attestation by this process.
 */
import {pathToFileURL} from 'node:url';
import {privateHomologationRole} from '../services/api/src/onlineRoutePolicy.mjs';
import {createReviewedAuthGateway} from './gateway-ingress-adapter.mjs';

const forbidden=['DATABASE_URL','ONLINE_API_INTERNAL_URL','RESEND_API_KEY','AUTH_RATE_LIMIT_SECRET',
  'ACCOUNT_MAIL_KEYRING_JSON','ONLINE_SIGNED_QUOTA_TEST_KEY','ONLINE_GATEWAY_RECEIVER_ACTIVE_HEX',
  'ONLINE_GATEWAY_RECEIVER_PREVIOUS_HEX','ONLINE_REGISTRATION_ENABLED'];
export function createGatewayRuntime(){
  const env=process.env;
  if(env.NODE_ENV!=='production'||env.GATEWAY_RUNTIME_MODE!=='reviewed'||
     forbidden.some(k=>env[k]!==undefined))
    throw new Error('Exclusive gateway runtime not configured');
  if(typeof env.GATEWAY_REVIEW_JSON!=='string'||env.GATEWAY_REVIEW_JSON.length>4096)
    throw new Error('Gateway review required');
  let record;
  try{record=JSON.parse(env.GATEWAY_REVIEW_JSON);}catch{throw new Error('Invalid gateway review');}
  if(!record||typeof record!=='object'||Array.isArray(record)||
     Object.keys(record).sort().join(',')!=='ingress,upstreamOrigin'||
     typeof record.upstreamOrigin!=='string'||record.upstreamOrigin!==env.GATEWAY_UPSTREAM_ORIGIN||
     !/^https:\/\/[a-z0-9-]+\.up\.railway\.app$/.test(record.upstreamOrigin)||
     env.GATEWAY_SUBJECT_POLICY!=='ipv6-prefix64-v2')
    throw new Error('Reviewed upstream and subject policy required');
  const rawPort=env.PORT??'3000';
  if(!/^\d{1,5}$/.test(rawPort)||Number(rawPort)<1||Number(rawPort)>65535)
    throw new Error('Invalid gateway port');
  const server=createReviewedAuthGateway({
    upstreamOrigin:record.upstreamOrigin,clientOrigin:'https://'+record.ingress?.publicDomain,
    issuerConfig:{activeHex:env.GATEWAY_SIGNING_HEX,subjectHex:env.GATEWAY_SUBJECT_HEX,
      subjectPolicy:env.GATEWAY_SUBJECT_POLICY},
    ingressConfig:{review:record.ingress},
    gameplayEnabled:privateHomologationRole('gateway',env)||(env.ONLINE_RELEASE_MODE==='reviewed'&&env.ONLINE_PUBLIC_SAVES_ENABLED==='true')});
  return {server,port:Number(rawPort)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const {server,port}=createGatewayRuntime();
    server.on('error',()=>{console.error('Gateway startup failed');process.exitCode=1;});
    server.listen(port,'::',()=>console.log('Reviewed gateway listener started'));
    for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{
      server.close(()=>process.exit(0));
      const timer=setTimeout(()=>process.exit(1),12000);timer.unref();
    });
  }catch{console.error('Gateway configuration rejected');process.exitCode=1;}
}
