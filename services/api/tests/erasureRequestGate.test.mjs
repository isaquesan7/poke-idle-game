import test from 'node:test';
import assert from 'node:assert/strict';
import {assessErasureRequest} from '../src/erasureRequestGate.mjs';
const now=new Date('2026-11-24T14:00:00Z');
function sample(){
  return {
    environment:'isolated',productionUntouched:true,
    requestReference:'request-privacy-0001',accountReference:'account-pseudonym-001',
    appCommitSha:'a'.repeat(40),requesterAuthenticated:true,
    reauthenticatedRecently:true,confirmationVerifiedOutOfBand:true,
    confirmationSingleUseVerified:true,activeBattleOrGymBlocked:true,
    concurrentSessionsRevokedInPlan:true,idempotentRequestReviewed:true,
    dataExportOffered:true,retentionPolicyApproved:true,
    legalHoldReviewed:true,backupReintroductionPlanReviewed:true,
    externalProcessorsReviewed:true,operator:'operator-one',
    reviewer:'reviewer-two',requestedAtUtc:'2026-11-24T09:00:00Z',
    confirmedAtUtc:'2026-11-24T10:00:00Z',
    reviewedAtUtc:'2026-11-24T11:00:00Z'
  };
}
test('23E1: even complete review never authorizes a destructive operation',()=>{
  const record=sample();const before=structuredClone(record);
  const report=assessErasureRequest(record,{now});
  assert.equal(report.eligibleForIsolatedDesignReview,true);
  assert.equal(report.deletionAuthorized,false);
  assert.equal(report.publicEndpointEnabled,false);
  assert.deepEqual(record,before);
});
test('23E1: identity and single-use proof cannot be omitted',()=>{
  const record=sample();record.reauthenticatedRecently=false;
  record.confirmationSingleUseVerified=false;
  assert.ok(assessErasureRequest(record,{now}).blockers.includes(
    'verified_requester_and_independent_confirmation_required'));
});
test('23E1: legal retention, backups and external processors gate deletion design',()=>{
  const record=sample();record.legalHoldReviewed=false;
  record.backupReintroductionPlanReviewed=false;
  assert.ok(assessErasureRequest(record,{now}).blockers.includes(
    'privacy_retention_and_backup_review_required'));
});
test('23E1: races, future review and self approval fail closed',()=>{
  const record=sample();
  record.activeBattleOrGymBlocked=false;
  record.reviewer=record.operator;
  record.confirmedAtUtc='2027-01-01T00:00:00Z';
  const errors=assessErasureRequest(record,{now}).blockers;
  assert.ok(errors.includes('concurrent_actions_and_replay_safety_review_required'));
  assert.ok(errors.includes('independent_operator_review_required'));
  assert.ok(errors.includes('review_timeline_invalid'));
});
test('23E1: invalid records cannot signal deletion readiness',()=>{
  assert.throws(()=>assessErasureRequest(null,{now}),TypeError);
  const record=sample();record.environment='production';
  assert.equal(assessErasureRequest(record,{now}).deletionAuthorized,false);
  assert.ok(assessErasureRequest(record,{now}).blockers.includes(
    'isolated_review_required'));
});
