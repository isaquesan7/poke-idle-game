import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateBetaReadiness,REQUIRED_GATES} from '../src/betaReadiness.mjs';
const sha='a'.repeat(40);
const checkedAt='2026-11-24T00:00:00Z';
const now=new Date('2026-11-24T12:00:00Z');
function valid(){
  const base=()=>({passed:true,reference:'internal-evidence-123',
    reviewer:'release-reviewer',checkedAt});
  return {headSha:sha,gates:{
    ci:{...base(),commitSha:sha},
    railway:{...base(),apiCommitSha:sha,webCommitSha:sha},
    restore:{...base(),isolated:true,actuallyRestored:true,
      integrityVerified:true,backupId:'backup-123',restoreId:'restore-123',
      observedRpoMinutes:5,observedRtoMinutes:4,
      drill:{
        provider:'railway',method:'pitr',
        sourceEnvironmentId:'11111111-1111-4111-8111-111111111111',
        restoreEnvironmentId:'22222222-2222-4222-8222-222222222222',
        sourceServiceId:'33333333-3333-4333-8333-333333333333',
        restoreServiceId:'44444444-4444-4444-8444-444444444444',
        backupId:'backup-123',restoreId:'restore-123',
        restoredIntoNewService:true,productionSourceUnaffected:true,
        apiNeverPointedAtRestore:true,pitrWalReplayVerified:true,
        integrityAuditPassed:true,integrityAuditReference:'integrity-audit-123',
        appCommitSha:sha,operator:'operator-1',reviewer:'reviewer-2',
        recoveryPointUtc:'2026-11-23T23:50:00Z',
        incidentUtc:'2026-11-23T23:55:00Z',
        restoreStartedUtc:'2026-11-23T23:56:00Z',
        restoredHealthyUtc:'2026-11-23T23:59:00Z',
        integrityCheckedUtc:'2026-11-24T00:00:00Z',
        reviewedUtc:'2026-11-24T00:00:00Z',
        observedRpoMinutes:5,observedRtoMinutes:4
      }},
    resend:{...base(),domainVerified:true,verificationDelivered:true,
      resetDelivered:true,expirationTested:true,
      drill:{
        provider:'resend',environment:'isolated',
        productionDeliveryDisabled:true,controlledTestRecipient:true,
        senderDomainVerified:true,domainProofRef:'domain-proof-123',
        appCommitSha:sha,operator:'operator-1',reviewer:'reviewer-2',
        verification:{
          providerMessageId:'provider-verify-01',
          providerDeliveryEventId:'delivery-verify-01',
          inboxObservationRef:'inbox-verify-01',
          sentAtUtc:'2026-11-24T00:00:00Z',
          deliveredAtUtc:'2026-11-24T00:01:00Z',
          inboxObservedAtUtc:'2026-11-24T00:02:00Z',
          linkUsedAtUtc:'2026-11-24T00:03:00Z',
          providerDeliveryEventVerified:true,inboxReceiptVerified:true,
          tokenConsumedOnceVerified:true
        },
        reset:{
          providerMessageId:'provider-reset-01',
          providerDeliveryEventId:'delivery-reset-01',
          inboxObservationRef:'inbox-reset-01',
          sentAtUtc:'2026-11-24T00:04:00Z',
          deliveredAtUtc:'2026-11-24T00:05:00Z',
          inboxObservedAtUtc:'2026-11-24T00:06:00Z',
          linkUsedAtUtc:'2026-11-24T00:07:00Z',
          providerDeliveryEventVerified:true,inboxReceiptVerified:true,
          tokenConsumedOnceVerified:true
        },
        expiredTokenRejectedAtUtc:'2026-11-24T00:08:00Z',
        expiredTokenRejectedVerified:true,reusedTokenRejectedVerified:true,
        reviewedAtUtc:'2026-11-24T00:09:00Z'
      }},
    privacy:{...base(),privacyPolicyUrl:'https://example.test/privacy',
      termsUrl:'https://example.test/terms',
      retentionApproved:true,deletionFlowReviewed:true,
      dataExportReviewed:true,accountDeletionVerified:true},
    security:{...base(),sessionReviewed:true,csrfReviewed:true,
      rateLimitReviewed:true,ownershipReviewed:true,
      productionHarnessDisabled:true,
      productionRouteLockdownVerified:true,
      reverseProxyRateLimitReviewed:true}
  }};
}
test('missing evidence always blocks release; volume alone cannot pass restore',()=>{
  const result=evaluateBetaReadiness({headSha:sha},{now});
  assert.equal(result.ready,false);
  assert.deepEqual(Object.keys(result.gates),REQUIRED_GATES);
  assert.ok(result.blockers.some(x=>x.startsWith('restore:')));
});
test('complete attestations can pass as review only, with no side effects',()=>{
  const input=valid();const original=structuredClone(input);
  const result=evaluateBetaReadiness(input,{now});
  assert.equal(result.ready,true);
  assert.deepEqual(result.blockers,[]);
  assert.deepEqual(input,original);
});
test('missing real restore proof fails closed even with other approvals',()=>{
  const input=valid();input.gates.restore.actuallyRestored=false;
  assert.equal(evaluateBetaReadiness(input,{now}).gates.restore.passed,false);
  input.gates.restore.actuallyRestored=true;
  delete input.gates.restore.restoreId;
  assert.equal(evaluateBetaReadiness(input,{now}).ready,false);
});
test('CI or deployment with stale SHA blocks release',()=>{
  const input=valid();input.gates.ci.commitSha='b'.repeat(40);
  assert.equal(evaluateBetaReadiness(input,{now}).gates.ci.passed,false);
  input.gates.ci.commitSha=sha;input.gates.railway.webCommitSha='b'.repeat(40);
  assert.equal(evaluateBetaReadiness(input,{now}).gates.railway.passed,false);
});
test('future approval, absent reviewer and disabled safety check fail closed',()=>{
  const input=valid();input.gates.resend.checkedAt='2027-01-01T00:00:00Z';
  input.gates.privacy.reviewer='';
  input.gates.security.productionHarnessDisabled=false;
  const result=evaluateBetaReadiness(input,{now});
  assert.equal(result.ready,false);
  for(const gate of ['resend','privacy','security'])
    assert.equal(result.gates[gate].passed,false);
});
test('malformed documents and timestamps are rejected',()=>{
  assert.throws(()=>evaluateBetaReadiness(null,{now}),TypeError);
  assert.throws(()=>evaluateBetaReadiness({}, {now:new Date('bad')}),TypeError);
  const input=valid();input.headSha='short';
  assert.equal(evaluateBetaReadiness(input,{now}).ready,false);
});

test('restore drill cannot be claimed complete by a mock CI dump',()=>{
  const input=valid();
  input.gates.restore.drill.method='volume-snapshot';
  assert.equal(evaluateBetaReadiness(input,{now}).gates.restore.passed,false);
});
test('restore drill mismatch with deployment SHA blocks release',()=>{
  const input=valid();
  input.gates.restore.drill.appCommitSha='b'.repeat(40);
  assert.equal(evaluateBetaReadiness(input,{now}).gates.restore.passed,false);
});

test('Resend gate requires mailbox proof, not provider acceptance alone',()=>{
  const input=valid();
  input.gates.resend.drill.verification.inboxReceiptVerified=false;
  assert.equal(evaluateBetaReadiness(input,{now}).gates.resend.passed,false);
});
test('Resend gate rejects delivery from another app commit',()=>{
  const input=valid();
  input.gates.resend.drill.appCommitSha='b'.repeat(40);
  assert.equal(evaluateBetaReadiness(input,{now}).gates.resend.passed,false);
});

test('23D7: public beta requires tested data export and actual account deletion',()=>{
  const input=valid();
  input.gates.privacy.accountDeletionVerified=false;
  assert.equal(evaluateBetaReadiness(input,{now}).gates.privacy.passed,false);
  input.gates.privacy.accountDeletionVerified=true;
  input.gates.privacy.dataExportReviewed=false;
  assert.equal(evaluateBetaReadiness(input,{now}).ready,false);
});
test('23D7: CI production lockdown does not substitute reverse proxy abuse review',()=>{
  const input=valid();
  input.gates.security.reverseProxyRateLimitReviewed=false;
  assert.equal(evaluateBetaReadiness(input,{now}).gates.security.passed,false);
  input.gates.security.reverseProxyRateLimitReviewed=true;
  input.gates.security.productionRouteLockdownVerified=false;
  assert.equal(evaluateBetaReadiness(input,{now}).gates.security.passed,false);
});

import {evaluateReleaseReview,RELEASE_ROLES,RELEASE_REVIEW_IDS,RELEASE_ROUTE_GROUPS} from '../src/releaseReview.mjs';
function releaseReviewFixture(){
  const proof=()=>({commitSha:sha,passed:true,reference:'fixture-not-real-evidence',operator:'operator',reviewer:'reviewer',checkedAt});
  const migration=()=>({...proof(),sqlSha256:'c'.repeat(64),disposablePg18Verified:true,registryChecksumReviewed:true,productionStillUnchanged:true});
  return {headSha:sha,betaEvidence:valid(),
    configReviews:Object.fromEntries(RELEASE_ROLES.map(role=>[role,{...proof(),report:{role,configShapeValid:true,blockers:[],publicRegistrationAuthorized:false}}])),
    reviews:{
      'migration-026':migration(),'migration-027':migration(),
      'gateway-topology':{...proof(),exclusiveIngressVerified:true,directWebBypassRejected:true,crossServiceKeyMatchReviewed:true},
      'regional-key-retention':{...proof(),restartVerified:true,historicalKeysRetained:true,concurrentRotationReviewed:true},
      'route-status-contract':{...proof(),groups:[...RELEASE_ROUTE_GROUPS],apiAuthoritative:true,ciHarnessDenied:true,registrationClosed:true,savesClosed:true},
      'rollback-plan':{...proof(),registrationCloseFirst:true,pendingActionsPreserved:true,noAutomaticDatabaseRollback:true}
    }};
}
test('D6M complete fixture is review only, never activation',()=>{
  const input=releaseReviewFixture(),original=structuredClone(input);
  assert.deepEqual(evaluateReleaseReview(input,{now}),{reviewComplete:true,blockers:[],publicRegistrationAuthorized:false,publicSavesAuthorized:false});
  assert.deepEqual(input,original);
});
test('D6M missing role or review blocks, including missing existing beta evidence',()=>{
  for(const role of RELEASE_ROLES){
    const input=releaseReviewFixture();delete input.configReviews[role];
    assert.deepEqual(evaluateReleaseReview(input,{now}).blockers,['config-'+role]);
  }
  for(const id of RELEASE_REVIEW_IDS){
    const input=releaseReviewFixture();delete input.reviews[id];
    assert.deepEqual(evaluateReleaseReview(input,{now}).blockers,[id]);
  }
  const input=releaseReviewFixture();delete input.betaEvidence;
  assert.deepEqual(evaluateReleaseReview(input,{now}).blockers,['beta-readiness']);
});
test('D6M refuses stale SHA, self-review, future review and malformed migration checksum',()=>{
  const input=releaseReviewFixture();
  input.configReviews.api.commitSha='b'.repeat(40);
  input.reviews['gateway-topology'].reviewer=' OPERATOR ';
  input.reviews['rollback-plan'].checkedAt='2027-01-01T00:00:00Z';
  input.reviews['migration-026'].sqlSha256='invalid';
  assert.deepEqual(evaluateReleaseReview(input,{now}).blockers,['config-api','migration-026','gateway-topology','rollback-plan']);
});
test('D6M refuses wrong role, report with activation, missing route or duplicate route group',()=>{
  const input=releaseReviewFixture();
  input.configReviews.web.report.role='api';
  input.configReviews.gateway.report.publicRegistrationAuthorized=true;
  input.reviews['route-status-contract'].groups.pop();
  assert.deepEqual(evaluateReleaseReview(input,{now}).blockers,['config-web','config-gateway','route-status-contract']);
  input.reviews['route-status-contract'].groups.push(RELEASE_ROUTE_GROUPS[0]);
  assert.ok(evaluateReleaseReview(input,{now}).blockers.includes('route-status-contract'));
});
test('D6M never echoes reference, secret-shaped text, parser error or evidence value',()=>{
  const input=releaseReviewFixture();
  input.configReviews.api.report.blockers=['secret-fixture-value'];
  input.reviews['migration-027'].reference='secret-fixture-value';
  const report=evaluateReleaseReview(input,{now});
  assert.equal(report.reviewComplete,false);
  assert.equal(JSON.stringify(report).includes('secret-fixture-value'),false);
  assert.equal(report.publicRegistrationAuthorized,false);
  assert.equal(report.publicSavesAuthorized,false);
});
test('D6M empty document blocks all reviews and cannot activate',()=>{
  const report=evaluateReleaseReview({},{now});
  assert.deepEqual(report.blockers,['target-sha','beta-readiness',...RELEASE_ROLES.map(r=>'config-'+r),...RELEASE_REVIEW_IDS]);
  assert.equal(report.publicRegistrationAuthorized,false);
  assert.equal(report.publicSavesAuthorized,false);
});

import {productionReleaseState,releaseMigrationChecksums} from '../src/releaseActivation.mjs';
import {ONLINE_ROUTES,webOnlineRoute} from '../src/onlineRoutePolicy.mjs';
async function activationFixture(){
 const evidence=releaseReviewFixture(),hashes=await releaseMigrationChecksums();
 for(const [name,hash] of Object.entries(hashes))evidence.reviews['migration-'+name.slice(0,3)].sqlSha256=hash;
 const env={NODE_ENV:'production',RAILWAY_GIT_COMMIT_SHA:sha,ONLINE_RELEASE_MODE:'reviewed',ONLINE_PUBLIC_SAVES_ENABLED:'true',ONLINE_REGISTRATION_ENABLED:'true',
 DATABASE_URL:'postgresql://fixture:fixture@postgres.railway.internal:5432/game',APP_ORIGIN:'https://gateway.up.railway.app',ACCOUNT_MAIL_MODE:'resend',RESEND_API_KEY:'re_fixture',MAIL_FROM:'Game <accounts@example.test>',AUTH_RATE_LIMIT_SECRET:'fixture-rate-secret-not-for-production',ONLINE_SIGNED_QUOTA_MODE:'reviewed',ONLINE_GATEWAY_RECEIVER_ACTIVE_HEX:'12'.repeat(32),WILD_HMAC_ACTIVE_KEY_ID:'a',WILD_HMAC_KEYRING_JSON:JSON.stringify({a:'34'.repeat(32)}),GYM_HMAC_ACTIVE_KEY_ID:'a',GYM_HMAC_KEYRING_JSON:JSON.stringify({a:Buffer.alloc(32,86).toString('base64')}),ONLINE_RELEASE_REVIEW_JSON:JSON.stringify(evidence)};
 const rows=Object.entries(hashes).map(([name,checksum])=>({name,checksum}));
 const pool={query:async(sql)=>({rows:sql.includes('game_schema_migrations')?rows:[{nonce:true,regional:true}]})};
 return {env,pool,rows};
}
test('release activation: explicit opt-in, all review checks and current ledger, registration can close independently',async()=>{
 const {env,pool}=await activationFixture();
 assert.deepEqual(await productionReleaseState(pool,env,{now}),{savesEnabled:true,registrationEnabled:true});
 assert.deepEqual(await productionReleaseState(pool,{...env,ONLINE_REGISTRATION_ENABLED:'false'},{now}),{savesEnabled:true,registrationEnabled:false});
 assert.deepEqual(await productionReleaseState(pool,{...env,ONLINE_RELEASE_MODE:undefined},{now}),{savesEnabled:false,registrationEnabled:false});
 assert.deepEqual(await productionReleaseState(pool,{...env,NODE_ENV:'test'},{now}),{savesEnabled:false,registrationEnabled:false});
 assert.deepEqual(await productionReleaseState(pool,{...env,ONLINE_PUBLIC_SAVES_ENABLED:'false',ONLINE_REGISTRATION_ENABLED:'false'},{now}),{savesEnabled:false,registrationEnabled:false});
 await assert.rejects(productionReleaseState(pool,{...env,ONLINE_PUBLIC_SAVES_ENABLED:'false'},{now}),/requires online saves/);
});
test('release activation rejects stale evidence, unsafe environment and unapplied or altered SQL',async()=>{
 const {env,pool,rows}=await activationFixture();
 for(const patch of [{RAILWAY_GIT_COMMIT_SHA:'b'.repeat(40)},{ONLINE_RELEASE_REVIEW_JSON:'{}'},{ONLINE_SHOP_CI_ONLY:'true'},{ACCOUNT_MAIL_MODE:'off'},{ONLINE_SIGNED_QUOTA_MODE:undefined}])
  await assert.rejects(productionReleaseState(pool,{...env,...patch},{now}));
 rows[0].checksum='0'.repeat(64);
 await assert.rejects(productionReleaseState(pool,env,{now}),/migrations not applied/);
 const valid=await activationFixture();
 await assert.rejects(productionReleaseState({query:async(sql)=>sql.includes('game_schema_migrations')?{rows:valid.rows}:{rows:[{nonce:true,regional:false}]}},valid.env,{now}),/schema not ready/);
});
test('release Web allows all reviewed game routes only with production opt-in',()=>{
 const env={NODE_ENV:'production',ONLINE_RELEASE_MODE:'reviewed',ONLINE_PUBLIC_SAVES_ENABLED:'true',ONLINE_GATEWAY_FORWARD_MODE:'reviewed'};
 for(const route of ONLINE_ROUTES){
  assert.equal(webOnlineRoute(route.path,env),route);
  if(route.group!=='base'){
   for(const key of ['ONLINE_RELEASE_MODE','ONLINE_PUBLIC_SAVES_ENABLED','ONLINE_GATEWAY_FORWARD_MODE'])
    assert.equal(webOnlineRoute(route.path,{...env,[key]:undefined}),null);
  }
 }
 assert.equal(webOnlineRoute('/api/v1/unknown',env),null);
});

import {HOMOLOGATION_OWNER,assertHomologationApiScope} from '../src/homologation.mjs';
import {privateHomologationRole} from '../src/onlineRoutePolicy.mjs';
test('private homologation: isolated deployment only, one owner, real migration checks and never public registration',async()=>{
 const {env:releaseEnv,rows}=await activationFixture();
 const env={...releaseEnv,ONLINE_RELEASE_MODE:undefined,ONLINE_RELEASE_REVIEW_JSON:undefined,ONLINE_PUBLIC_SAVES_ENABLED:'false',ONLINE_REGISTRATION_ENABLED:'false',
 ONLINE_HOMOLOGATION_ENABLED:'true',RAILWAY_PROJECT_ID:'5e70b6da-2aaa-4d6b-add7-3c69ac44b986',RAILWAY_ENVIRONMENT_ID:'41df5039-d980-437a-ab9c-66b827695c67',RAILWAY_SERVICE_ID:'523ef5c2-4a8c-41da-9d3b-37733cd8f9aa',RAILWAY_ENVIRONMENT_NAME:'homologacao',ACCOUNT_MAIL_MODE:'off',RESEND_API_KEY:undefined,MAIL_FROM:undefined};
 const owner={email:HOMOLOGATION_OWNER,email_verified_at:now,disabled_at:null,account_id:'fixture'};
 const pool={query:async(sql)=>({rows:sql.includes('game_schema_migrations')?rows:sql.includes('pg_constraint')?[{nonce:true,regional:true}]:[owner]})};
 assert.deepEqual(await productionReleaseState(pool,env,{now}),{savesEnabled:true,registrationEnabled:false,privateHomologation:true});
 assert.deepEqual(await productionReleaseState(pool,{...env,ONLINE_HOMOLOGATION_ENABLED:'false'},{now}),{savesEnabled:false,registrationEnabled:false});
 for(const patch of [{RAILWAY_PROJECT_ID:'other'},{RAILWAY_ENVIRONMENT_NAME:'production'},{RAILWAY_SERVICE_ID:'other'},{NODE_ENV:'test'},{ONLINE_REGISTRATION_ENABLED:'true'},{ONLINE_PUBLIC_SAVES_ENABLED:'true'},{ONLINE_RELEASE_MODE:'reviewed'},{ONLINE_SHOP_CI_ONLY:'true'},{DATABASE_URL:'postgresql://fixture:fixture@other.railway.internal:5432/game'},{ONLINE_SIGNED_QUOTA_MODE:undefined},{ACCOUNT_MAIL_MODE:'resend'}])
  await assert.rejects(productionReleaseState(pool,{...env,...patch},{now}));
 owner.email='other@example.test';
 await assert.rejects(productionReleaseState(pool,env,{now}),/exactly one/);
 owner.email=HOMOLOGATION_OWNER;
 rows[0].checksum='0'.repeat(64);
 await assert.rejects(productionReleaseState(pool,env,{now}),/migrations not applied/);
 assert.throws(()=>assertHomologationApiScope({...env,RAILWAY_ENVIRONMENT_NAME:'production'}));
});
test('private Web and gateway use scoped switches, production does not inherit them',()=>{
 const env={NODE_ENV:'production',RAILWAY_ENVIRONMENT_NAME:'homologacao',ONLINE_PUBLIC_SAVES_ENABLED:'false',ONLINE_HOMOLOGATION_ENABLED:'true',ONLINE_GATEWAY_FORWARD_MODE:'reviewed',
 RAILWAY_PROJECT_ID:'5e70b6da-2aaa-4d6b-add7-3c69ac44b986',RAILWAY_ENVIRONMENT_ID:'41df5039-d980-437a-ab9c-66b827695c67',RAILWAY_SERVICE_ID:'53c40d91-e1b5-453f-8950-c43efdac694c'};
 assert.ok(webOnlineRoute('/api/v1/inventory/current',env));
 for(const path of ['/api/v1/mastery/current','/api/v1/mastery/research']){
  assert.ok(webOnlineRoute(path,env));
  for(const patch of [{RAILWAY_ENVIRONMENT_NAME:'production'},{RAILWAY_SERVICE_ID:'other'},{ONLINE_HOMOLOGATION_ENABLED:'false'},{ONLINE_REGISTRATION_ENABLED:'true'},{ONLINE_GATEWAY_FORWARD_MODE:undefined}])assert.equal(webOnlineRoute(path,{...env,...patch}),null);
 }
 assert.equal(webOnlineRoute('/api/v1/inventory/current',{...env,RAILWAY_ENVIRONMENT_NAME:'production'}),null);
 assert.equal(webOnlineRoute('/api/v1/account/export',env),null);
 assert.equal(privateHomologationRole('gateway',env),false);
 const gateway={...env,RAILWAY_PROJECT_ID:'b1031f8b-66bb-4173-9cbf-0fec206a6f2d',RAILWAY_ENVIRONMENT_ID:'7d4158a4-b017-4cdb-bb0c-0e7119e27606',RAILWAY_SERVICE_ID:'900db0b8-af72-4bb7-8477-18e331e951fa'};
 assert.equal(privateHomologationRole('gateway',gateway),true);
 assert.equal(privateHomologationRole('gateway',{...gateway,ONLINE_PUBLIC_SAVES_ENABLED:'true'}),false);
});
