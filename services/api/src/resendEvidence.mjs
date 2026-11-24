/** ONLINE-01C-23D6: offline, privacy-safe Resend delivery EVIDENCE checker.
 * Does not call Resend; only checks independently reviewed attestations.
 * A provider 2xx alone does NOT prove mailbox delivery.
 */
const sha=/^[0-9a-f]{40}$/;
const timestamp=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
const ref=value=>typeof value==='string'&&value.length>=6&&value.length<=128&&
  /^[A-Za-z0-9_.:-]+$/.test(value);
const obj=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const at=value=>typeof value==='string'&&timestamp.test(value)&&
  Number.isFinite(Date.parse(value));
function flowCheck(flow,kind,now,errors){
  if(!obj(flow)){errors.push(kind+'_evidence_missing');return;}
  if(!ref(flow.providerMessageId)||!ref(flow.providerDeliveryEventId)||
    !ref(flow.inboxObservationRef))errors.push(kind+'_provider_and_inbox_receipts_missing');
  const times=['sentAtUtc','deliveredAtUtc','inboxObservedAtUtc','linkUsedAtUtc'];
  if(times.some(key=>!at(flow[key]))){
    errors.push(kind+'_timestamps_invalid');return;
  }
  const values=times.map(key=>Date.parse(flow[key]));
  if(values.some((v,i)=>i>0&&v<values[i-1])||values.at(-1)>now.getTime())
    errors.push(kind+'_timeline_invalid');
  if(flow.providerDeliveryEventVerified!==true||flow.inboxReceiptVerified!==true||
    flow.tokenConsumedOnceVerified!==true)
    errors.push(kind+'_delivery_or_single_use_not_proven');
}
export function evaluateResendEvidence(record,{now=new Date()}={}){
  if(!obj(record)||!(now instanceof Date)||!Number.isFinite(now.getTime()))
    throw new TypeError('Invalid email evidence');
  const errors=[];
  if(record.provider!=='resend'||record.environment!=='isolated'||
    record.productionDeliveryDisabled!==true||
    record.controlledTestRecipient===false||record.controlledTestRecipient!==true)
    errors.push('isolated_resend_test_required');
  if(!ref(record.domainProofRef)||record.senderDomainVerified!==true)
    errors.push('domain_proof_missing');
  if(!sha.test(record.appCommitSha??''))
    errors.push('commit_sha_required');
  if(!ref(record.operator)||!ref(record.reviewer)||
    record.operator===record.reviewer)
    errors.push('independent_review_missing');
  flowCheck(record.verification,'verification',now,errors);
  flowCheck(record.reset,'reset',now,errors);
  if(obj(record.verification)&&obj(record.reset)&&
    record.verification.providerMessageId===record.reset.providerMessageId)
    errors.push('verification_and_reset_receipts_must_differ');
  if(!at(record.expiredTokenRejectedAtUtc)||
    record.expiredTokenRejectedVerified!==true||
    record.reusedTokenRejectedVerified!==true||
    !at(record.reviewedAtUtc)||
    Date.parse(record.reviewedAtUtc)>now.getTime())
    errors.push('expiration_replay_and_review_proof_missing');
  if(at(record.reviewedAtUtc)&&
    [record.verification?.linkUsedAtUtc,record.reset?.linkUsedAtUtc,
      record.expiredTokenRejectedAtUtc].some(v=>at(v)&&Date.parse(v)>Date.parse(record.reviewedAtUtc)))
    errors.push('review_before_test_completion');
  return {
    passed:errors.length===0,blockers:errors,
    note:'Operator-supplied offline evidence only. Does not verify Resend API or mailbox, and never enables accounts.'
  };
}
