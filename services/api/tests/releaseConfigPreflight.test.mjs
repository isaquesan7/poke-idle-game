import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateReleaseConfig} from '../src/releaseConfigPreflight.mjs';
const common={NODE_ENV:'production'};
const api={...common,DATABASE_URL:'postgresql://fixture:fixture@postgres.railway.internal:5432/game',APP_ORIGIN:'https://gateway.up.railway.app',ACCOUNT_MAIL_MODE:'resend',RESEND_API_KEY:'re_fixture',MAIL_FROM:'Game <accounts@example.test>',AUTH_RATE_LIMIT_SECRET:'fixture-rate-secret-not-for-production',ONLINE_SIGNED_QUOTA_MODE:'reviewed',ONLINE_GATEWAY_RECEIVER_ACTIVE_HEX:'12'.repeat(32),WILD_HMAC_ACTIVE_KEY_ID:'a',WILD_HMAC_KEYRING_JSON:JSON.stringify({a:'34'.repeat(32)}),GYM_HMAC_ACTIVE_KEY_ID:'a',GYM_HMAC_KEYRING_JSON:JSON.stringify({a:Buffer.alloc(32,86).toString('base64')})};
const web={...common,ONLINE_GATEWAY_FORWARD_MODE:'reviewed',ONLINE_API_INTERNAL_URL:'http://api.railway.internal:3001'};
const gateway={...common,GATEWAY_RUNTIME_MODE:'reviewed',GATEWAY_SUBJECT_POLICY:'ipv6-prefix64-v2',GATEWAY_UPSTREAM_ORIGIN:'https://web.up.railway.app',GATEWAY_SIGNING_HEX:'12'.repeat(32),GATEWAY_SUBJECT_HEX:'78'.repeat(32),GATEWAY_REVIEW_JSON:JSON.stringify({upstreamOrigin:'https://web.up.railway.app',ingress:{reviewReference:'synthetic'}})};
test('D6K: shape checks never authorize public registration',()=>{
 for(const [role,env] of [['api',api],['web',web],['gateway',gateway]]){
  assert.deepEqual(evaluateReleaseConfig(role,env),{role,configShapeValid:true,blockers:[],publicRegistrationAuthorized:false});
  for(const patch of [{NODE_ENV:'test'},{ONLINE_REGISTRATION_ENABLED:'true'},{ONLINE_GYM_PORTAL_CI_ONLY:'false'},{WILD_CI_ENTROPY_HEX:'fixture'}]){
   assert.equal(evaluateReleaseConfig(role,{...env,...patch}).configShapeValid,false);
  }
 }
});
test('D6K: reject mixed roles, unsafe endpoints, sandbox mail and duplicated secrets without leaking values',()=>{
 for(const [role,env,patch,expected] of [
  ['api',api,{DATABASE_URL:'postgresql://u:SECRET@localhost/db'},'private-postgres'],
  ['api',api,{MAIL_FROM:'onboarding@resend.dev'},'resend-config'],
  ['api',api,{WILD_HMAC_KEYRING_JSON:'{"a":"SECRET"}'},'wild-keyring'],
  ['api',api,{WILD_HMAC_KEYRING_JSON:JSON.stringify({a:'12'.repeat(32)})},'independent-key-material'],
  ['api',api,{AUTH_RATE_LIMIT_SECRET:'34'.repeat(32)},'independent-key-material'],
  ['api',api,{GATEWAY_SUBJECT_HEX:'SECRET'},'api-role-isolation'],
  ['web',web,{DATABASE_URL:'SECRET'},'web-role-isolation'],
  ['web',web,{ONLINE_API_INTERNAL_URL:'https://api.up.railway.app'},'reviewed-web-forwarding'],
  ['gateway',gateway,{GATEWAY_SUBJECT_HEX:gateway.GATEWAY_SIGNING_HEX},'gateway-issuer'],
  ['gateway',gateway,{RESEND_API_KEY:'SECRET'},'gateway-role-isolation']
 ]){
  const result=evaluateReleaseConfig(role,{...env,...patch});
  assert.equal(result.configShapeValid,false);
  assert.ok(result.blockers.includes(expected),JSON.stringify(result));
  assert.ok(!JSON.stringify(result).includes('SECRET'));
 }
 assert.throws(()=>evaluateReleaseConfig('invalid',{}));
});
