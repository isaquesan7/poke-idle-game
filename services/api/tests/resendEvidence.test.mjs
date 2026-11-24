import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateResendEvidence} from '../src/resendEvidence.mjs';
const now=new Date('2026-11-24T12:00:00Z');
const flow=(name,offset)=>({
  providerMessageId:'provider-'+name+'-001',
  providerDeliveryEventId:'event-'+name+'-001',
  inboxObservationRef:'inbox-'+name+'-001',
  sentAtUtc:'2026-11-24T00:0'+offset+':00Z',
  deliveredAtUtc:'2026-11-24T00:0'+(offset+1)+':00Z',
  inboxObservedAtUtc:'2026-11-24T00:0'+(offset+2)+':00Z',
  linkUsedAtUtc:'2026-11-24T00:0'+(offset+3)+':00Z',
  providerDeliveryEventVerified:true,inboxReceiptVerified:true,
  tokenConsumedOnceVerified:true
});
const valid=()=>({
  provider:'resend',environment:'isolated',productionDeliveryDisabled:true,
  controlledTestRecipient:true,senderDomainVerified:true,
  domainProofRef:'domain-proof-123',appCommitSha:'a'.repeat(40),
  operator:'operator-1',reviewer:'reviewer-2',
  verification:flow('verify',0),reset:flow('reset',4),
  expiredTokenRejectedAtUtc:'2026-11-24T00:08:00Z',
  expiredTokenRejectedVerified:true,reusedTokenRejectedVerified:true,
  reviewedAtUtc:'2026-11-24T00:09:00Z'
});
test('23D6: internally coherent receipt attestations pass as review only',()=>{
  const v=valid(),clone=structuredClone(v);
  assert.deepEqual(evaluateResendEvidence(v,{now}).blockers,[]);
  assert.deepEqual(v,clone);
});
test('23D6: provider acceptance without inbox event fails closed',()=>{
  const v=valid();v.reset.inboxReceiptVerified=false;
  assert.ok(evaluateResendEvidence(v,{now}).blockers.includes(
    'reset_delivery_or_single_use_not_proven'));
});
test('23D6: duplicate provider receipts never count as distinct email flows',()=>{
  const v=valid();
  v.reset.providerMessageId=v.verification.providerMessageId;
  assert.ok(evaluateResendEvidence(v,{now}).blockers.includes(
    'verification_and_reset_receipts_must_differ'));
});
test('23D6: future receipts and invalid chronology fail',()=>{
  const v=valid();
  v.verification.deliveredAtUtc='2026-11-23T23:00:00Z';
  assert.ok(evaluateResendEvidence(v,{now}).blockers.includes(
    'verification_timeline_invalid'));
  const x=valid();x.reviewedAtUtc='2027-01-01T00:00:00Z';
  assert.equal(evaluateResendEvidence(x,{now}).passed,false);
});
test('23D6: no real token expiration and single-use proof = blocked',()=>{
  const v=valid();v.expiredTokenRejectedVerified=false;
  assert.equal(evaluateResendEvidence(v,{now}).passed,false);
  assert.throws(()=>evaluateResendEvidence(null,{now}),TypeError);
});
