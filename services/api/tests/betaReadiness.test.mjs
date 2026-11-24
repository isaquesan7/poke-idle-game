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
      resetDelivered:true,expirationTested:true},
    privacy:{...base(),privacyPolicyUrl:'https://example.test/privacy',
      termsUrl:'https://example.test/terms',
      retentionApproved:true,deletionFlowReviewed:true},
    security:{...base(),sessionReviewed:true,csrfReviewed:true,
      rateLimitReviewed:true,ownershipReviewed:true,
      productionHarnessDisabled:true}
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
