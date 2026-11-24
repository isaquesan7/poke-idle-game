import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const review={projectId:'11111111-1111-4111-8111-111111111111',environmentId:'22222222-2222-4222-8222-222222222222',
  serviceId:'33333333-3333-4333-8333-333333333333',commitSha:'a'.repeat(40),publicDomain:'gateway-ci.up.railway.app',
  serviceCount:1,replicaCount:1,tcpProxyCount:0,publicDomainCount:1,privateCallersExcluded:true,
  changeControlReviewed:true,reviewReference:'Synthetic CI only'};
const upstream='https://web-ci.up.railway.app';
const env={NODE_ENV:'production',GATEWAY_RUNTIME_MODE:'reviewed',GATEWAY_REVIEW_JSON:JSON.stringify({ingress:review,upstreamOrigin:upstream}),
  GATEWAY_UPSTREAM_ORIGIN:upstream,GATEWAY_SUBJECT_POLICY:'ipv6-prefix64-v2',
  GATEWAY_SIGNING_HEX:'11'.repeat(32),GATEWAY_SUBJECT_HEX:'22'.repeat(32),
  RAILWAY_PROJECT_ID:review.projectId,RAILWAY_ENVIRONMENT_ID:review.environmentId,RAILWAY_SERVICE_ID:review.serviceId,
  RAILWAY_GIT_COMMIT_SHA:review.commitSha,RAILWAY_PUBLIC_DOMAIN:review.publicDomain,PORT:'3000'};
const evaluate=patch=>spawnSync(process.execPath,['--input-type=module','-e',
  "import {createGatewayRuntime} from './scripts/run-auth-gateway.mjs';const {server,port}=createGatewayRuntime();if(server.listening||port!==3000)process.exit(2);"],
  {env:{...env,...patch},encoding:'utf8',timeout:5000});
test('reviewed standalone configuration composes server without opening socket',()=>assert.equal(evaluate({}).status,0));
test('missing review, changed upstream/identity, invalid keys and foreign credentials fail closed',()=>{
  for(const patch of [{GATEWAY_RUNTIME_MODE:''},{NODE_ENV:'test'},{GATEWAY_REVIEW_JSON:'{}'},
    {GATEWAY_UPSTREAM_ORIGIN:'https://other.up.railway.app'},{RAILWAY_GIT_COMMIT_SHA:'b'.repeat(40)},
    {GATEWAY_SIGNING_HEX:''},{GATEWAY_SUBJECT_HEX:env.GATEWAY_SIGNING_HEX},{GATEWAY_SUBJECT_POLICY:'address-v1'},
    {DATABASE_URL:'synthetic'},{RESEND_API_KEY:'synthetic'},{ONLINE_REGISTRATION_ENABLED:'false'},{PORT:'0'}])
    assert.equal(evaluate(patch).status,1,JSON.stringify(Object.keys(patch)));
});
test('standalone command rejects unconfigured startup without printing secrets',()=>{
  const child=spawnSync(process.execPath,['scripts/run-auth-gateway.mjs'],{env:{NODE_ENV:'production',
    GATEWAY_SIGNING_HEX:'never-print-me'},encoding:'utf8',timeout:5000});
  assert.equal(child.status,1);assert.match(child.stderr,/configuration rejected/);
  assert.ok(!child.stderr.includes('never-print-me'));
});
