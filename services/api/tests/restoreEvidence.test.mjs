import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRestoreEvidence} from '../src/restoreEvidence.mjs';
const now=new Date('2026-11-24T12:00:00Z');
function sample(){
  return {
    provider:'railway',method:'pitr',
    sourceEnvironmentId:'11111111-1111-4111-8111-111111111111',
    restoreEnvironmentId:'22222222-2222-4222-8222-222222222222',
    sourceServiceId:'33333333-3333-4333-8333-333333333333',
    restoreServiceId:'44444444-4444-4444-8444-444444444444',
    backupId:'backup-123',restoreId:'restore-123',
    restoredIntoNewService:true,productionSourceUnaffected:true,
    apiNeverPointedAtRestore:true,pitrWalReplayVerified:true,
    integrityAuditPassed:true,integrityAuditReference:'audit-123456',
    appCommitSha:'a'.repeat(40),operator:'operator-1',reviewer:'reviewer-2',
    recoveryPointUtc:'2026-11-23T23:50:00Z',
    incidentUtc:'2026-11-23T23:55:00Z',
    restoreStartedUtc:'2026-11-23T23:56:00Z',
    restoredHealthyUtc:'2026-11-23T23:59:00Z',
    integrityCheckedUtc:'2026-11-24T00:00:00Z',
    reviewedUtc:'2026-11-24T00:00:00Z',
    observedRpoMinutes:5,observedRtoMinutes:4
  };
}
test('23D5: coherent operator-supplied PITR record passes CONSISTENCY check',()=>{
  const original=sample(),copy=structuredClone(original);
  const result=evaluateRestoreEvidence(original,{now});
  assert.equal(result.passed,true);
  assert.equal(result.observedRpoMinutes,5);
  assert.equal(result.observedRtoMinutes,4);
  assert.deepEqual(original,copy);
});
test('23D5: same Railway environment or service is not isolated',()=>{
  const a=sample();a.restoreServiceId=a.sourceServiceId;
  a.restoreEnvironmentId=a.sourceEnvironmentId;
  assert.ok(evaluateRestoreEvidence(a,{now}).blockers
    .includes('separate_railway_environment_and_service_required'));
});
test('23D5: wrong chronology or manipulated RPO/RTO fails closed',()=>{
  const a=sample();a.restoredHealthyUtc='2026-11-23T23:53:00Z';
  assert.ok(evaluateRestoreEvidence(a,{now}).blockers
    .includes('chronology_or_future_review_invalid'));
  const b=sample();b.observedRpoMinutes=0;
  assert.ok(evaluateRestoreEvidence(b,{now}).blockers
    .includes('rpo_rto_not_measured_from_timestamps'));
});
test('23D5: future reviews, missing independent reviewer or missing evidence block',()=>{
  const a=sample();a.reviewedUtc='2027-01-01T00:00:00Z';
  assert.equal(evaluateRestoreEvidence(a,{now}).passed,false);
  const b=sample();b.reviewer=b.operator;b.productionSourceUnaffected=false;
  const result=evaluateRestoreEvidence(b,{now});
  assert.ok(result.blockers.includes('independent_operator_review_required'));
  assert.ok(result.blockers.includes('source_isolation_attestation_required'));
});
test('23D5: snapshots do not masquerade as PITR',()=>{
  const pitr=sample();pitr.pitrWalReplayVerified=false;
  assert.ok(evaluateRestoreEvidence(pitr,{now}).blockers
    .includes('pitr_wal_replay_not_verified'));
  const snapshot=sample();snapshot.method='volume-snapshot';
  assert.ok(evaluateRestoreEvidence(snapshot,{now}).blockers
    .includes('volume_snapshot_must_not_claim_pitr'));
  snapshot.pitrWalReplayVerified=false;
  assert.equal(evaluateRestoreEvidence(snapshot,{now}).passed,true);
});
test('23D5: invalid data never becomes release proof',()=>{
  assert.throws(()=>evaluateRestoreEvidence(null,{now}),TypeError);
  const a=sample();a.backupId='https://secret.example/key?token=1';
  assert.equal(evaluateRestoreEvidence(a,{now}).passed,false);
});
