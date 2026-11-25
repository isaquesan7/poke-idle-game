/** D6K: offline preflight for candidate role environments, not an activation gate.
 * Reports only fixed field names/check IDs. Never emits values or errors from parsers.
 */
import {CI_FEATURE_FLAGS} from './onlineRoutePolicy.mjs';
import {loadWildEntropyKeyringFromEnv} from './wildEntropyKeyring.mjs';
import {loadGymEntropyKeyringFromEnv} from './gymEntropyKeyring.mjs';
import {createProxyReceiver,createProxyIssuer} from './proxyKeyring.mjs';
const privateHost=/^[a-z0-9-]+\.railway\.internal$/;
const hex=/^[0-9a-f]{64}$/;
const ciNames=[...CI_FEATURE_FLAGS,'ONLINE_REGIONAL_EXPANSION_CI_ONLY','WILD_CI_ENTROPY_HEX','ONLINE_SIGNED_QUOTA_TEST_ONLY','ONLINE_SIGNED_QUOTA_TEST_KEY','ONLINE_GATEWAY_FORWARD_TEST_ONLY','ACCOUNT_DRILL_LOOPBACK_ONLY'];
const apiSecrets=['DATABASE_URL','RESEND_API_KEY','MAIL_FROM','AUTH_RATE_LIMIT_SECRET','WILD_HMAC_KEYRING_JSON','WILD_HMAC_ACTIVE_KEY_ID','GYM_HMAC_KEYRING_JSON','GYM_HMAC_ACTIVE_KEY_ID','ONLINE_GATEWAY_RECEIVER_ACTIVE_HEX','ONLINE_GATEWAY_RECEIVER_PREVIOUS_HEX','ONLINE_GATEWAY_RECEIVER_CUTOVER_MS','ACCOUNT_MAIL_KEYRING_JSON','ACCOUNT_MAIL_ACTIVE_KEY_ID'];
const gatewaySecrets=['GATEWAY_SIGNING_HEX','GATEWAY_SUBJECT_HEX'];
function origin(value,protocol,host,portRequired=false){
 try{const u=new URL(value);return u.protocol===protocol&&host.test(u.hostname)&&(!portRequired||!!u.port)&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&value===u.origin;}catch{return false;}
}
export function evaluateReleaseConfig(role,env=process.env){
 if(!['api','web','gateway'].includes(role))throw new TypeError('Unknown release role');
 const blockers=[];
 const check=(id,fn)=>{try{if(!fn())blockers.push(id);}catch{blockers.push(id);}};
 const absent=names=>names.every(k=>env[k]===undefined);
 check('production-environment',()=>env.NODE_ENV==='production');
 check('ci-settings-absent',()=>absent(ciNames));
 check('registration-still-closed',()=>env.ONLINE_REGISTRATION_ENABLED===undefined||env.ONLINE_REGISTRATION_ENABLED==='false');
 if(role==='api'){
  check('api-role-isolation',()=>absent([...gatewaySecrets,'ONLINE_API_INTERNAL_URL','GATEWAY_RUNTIME_MODE','ACCOUNT_MAIL_KEYRING_JSON','ACCOUNT_MAIL_ACTIVE_KEY_ID']));
  check('private-postgres',()=>{const d=new URL(env.DATABASE_URL);return ['postgres:','postgresql:'].includes(d.protocol)&&privateHost.test(d.hostname)&&!!d.username&&!!d.password&&d.pathname.length>1&&!d.hash;});
  check('public-https-origin',()=>origin(env.APP_ORIGIN,'https:',/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/)&&!privateHost.test(new URL(env.APP_ORIGIN).hostname)&&!/^(?:\d+\.){3}\d+$/.test(new URL(env.APP_ORIGIN).hostname));
  check('resend-config',()=>env.ACCOUNT_MAIL_MODE==='resend'&&typeof env.RESEND_API_KEY==='string'&&/^re_[A-Za-z0-9_-]+$/.test(env.RESEND_API_KEY)&&typeof env.MAIL_FROM==='string'&&/@[a-z0-9.-]+\.[a-z]{2,}>?$/i.test(env.MAIL_FROM)&&!/@(?:[^ >]*\.)?resend\.dev>?$/i.test(env.MAIL_FROM));
  check('auth-rate-secret',()=>typeof env.AUTH_RATE_LIMIT_SECRET==='string'&&env.AUTH_RATE_LIMIT_SECRET.length>=32);
  check('reviewed-receiver',()=>{if(env.ONLINE_SIGNED_QUOTA_MODE!=='reviewed')return false;const raw=env.ONLINE_GATEWAY_RECEIVER_CUTOVER_MS;if(raw!==undefined&&!/^\d{1,16}$/.test(raw))return false;createProxyReceiver({activeHex:env.ONLINE_GATEWAY_RECEIVER_ACTIVE_HEX,previousHex:env.ONLINE_GATEWAY_RECEIVER_PREVIOUS_HEX,cutoverMs:raw===undefined?undefined:Number(raw)});return true;});
  check('wild-keyring',()=>!!loadWildEntropyKeyringFromEnv(env));
  check('gym-keyring',()=>!!loadGymEntropyKeyringFromEnv(env));
  check('independent-key-material',()=>{
   const wild=Object.values(JSON.parse(env.WILD_HMAC_KEYRING_JSON)).map(k=>Buffer.from(k,'hex'));
   const gym=Object.values(JSON.parse(env.GYM_HMAC_KEYRING_JSON)).map(k=>Buffer.from(k,'base64'));
   const receiver=[env.ONLINE_GATEWAY_RECEIVER_ACTIVE_HEX,env.ONLINE_GATEWAY_RECEIVER_PREVIOUS_HEX].filter(k=>k!==undefined).map(k=>{if(!hex.test(k))throw Error();return Buffer.from(k,'hex');});
   const rate=Buffer.from(env.AUTH_RATE_LIMIT_SECRET);
   const all=[...wild,...gym,...receiver,rate].map(k=>k.toString('hex'));
   // Also detect an auth rate secret that is a textual encoding of another key.
   const encoded=[...wild,...gym,...receiver].some(k=>[k.toString('hex'),k.toString('base64')].includes(env.AUTH_RATE_LIMIT_SECRET));
   return !encoded&&new Set(all).size===all.length;
  });
 }else if(role==='web'){
  check('web-role-isolation',()=>absent([...apiSecrets,...gatewaySecrets,'GATEWAY_RUNTIME_MODE','ONLINE_SIGNED_QUOTA_MODE']));
  check('reviewed-web-forwarding',()=>env.ONLINE_GATEWAY_FORWARD_MODE==='reviewed'&&origin(env.ONLINE_API_INTERNAL_URL,'http:',privateHost,true));
 }else{
  check('gateway-role-isolation',()=>absent([...apiSecrets,'ONLINE_API_INTERNAL_URL','ONLINE_REGISTRATION_ENABLED','ONLINE_SIGNED_QUOTA_MODE','ONLINE_GATEWAY_FORWARD_MODE']));
  check('reviewed-gateway-mode',()=>env.GATEWAY_RUNTIME_MODE==='reviewed'&&env.GATEWAY_SUBJECT_POLICY==='ipv6-prefix64-v2'&&origin(env.GATEWAY_UPSTREAM_ORIGIN,'https:',/^[a-z0-9-]+\.up\.railway\.app$/));
  check('gateway-issuer',()=>!!createProxyIssuer({activeHex:env.GATEWAY_SIGNING_HEX,subjectHex:env.GATEWAY_SUBJECT_HEX,subjectPolicy:env.GATEWAY_SUBJECT_POLICY}));
  check('gateway-review-present',()=>{const review=JSON.parse(env.GATEWAY_REVIEW_JSON);return review.upstreamOrigin===env.GATEWAY_UPSTREAM_ORIGIN&&!!review.ingress?.reviewReference;});
 }
 return {role,configShapeValid:blockers.length===0,blockers,publicRegistrationAuthorized:false};
}
