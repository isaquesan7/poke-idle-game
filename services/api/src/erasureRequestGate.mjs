/** ONLINE-01C-23E1: pure, offline erasure-request readiness.
 * This is a workflow SPECIFICATION, not a deletion executor.
 * No database queries, HTTP routes, credentials, or production operations.
 */
const sha=/^[0-9a-f]{40}$/;
const ref=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{6,128}$/.test(x);
const time=x=>typeof x==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(x)&&
  Number.isFinite(Date.parse(x));
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

/**
 * Always fail closed. A passing record only qualifies for an isolated design
 * review; actual erasure is NEVER authorized by this module.
 */
export function assessErasureRequest(record,{now=new Date()}={}){
  if(!obj(record)||!(now instanceof Date)||!Number.isFinite(now.getTime()))
    throw new TypeError('Invalid erasure request evidence');
  const blockers=[];
  if(record.environment!=='isolated'||record.productionUntouched!==true)
    blockers.push('isolated_review_required');
  if(!ref(record.requestReference)||!ref(record.accountReference)||
    !sha.test(record.appCommitSha??''))
    blockers.push('request_account_commit_references_required');
  if(record.requesterAuthenticated!==true||
    record.reauthenticatedRecently!==true||
    record.confirmationVerifiedOutOfBand!==true||
    record.confirmationSingleUseVerified!==true)
    blockers.push('verified_requester_and_independent_confirmation_required');
  if(record.activeBattleOrGymBlocked!==true||
    record.concurrentSessionsRevokedInPlan!==true||
    record.idempotentRequestReviewed!==true)
    blockers.push('concurrent_actions_and_replay_safety_review_required');
  if(record.dataExportOffered!==true||
    record.retentionPolicyApproved!==true||
    record.legalHoldReviewed!==true||
    record.backupReintroductionPlanReviewed!==true||
    record.externalProcessorsReviewed!==true)
    blockers.push('privacy_retention_and_backup_review_required');
  if(!ref(record.operator)||!ref(record.reviewer)||
    record.operator===record.reviewer)
    blockers.push('independent_operator_review_required');
  if(!time(record.requestedAtUtc)||!time(record.confirmedAtUtc)||
    !time(record.reviewedAtUtc)){
    blockers.push('review_timestamps_required');
  }else if(!(Date.parse(record.requestedAtUtc)<=Date.parse(record.confirmedAtUtc)&&
    Date.parse(record.confirmedAtUtc)<=Date.parse(record.reviewedAtUtc)&&
    Date.parse(record.reviewedAtUtc)<=now.getTime()))
    blockers.push('review_timeline_invalid');
  return {
    eligibleForIsolatedDesignReview:blockers.length===0,
    deletionAuthorized:false,
    publicEndpointEnabled:false,
    blockers,
    note:'Offline checklist only; cannot authenticate a real person or authorize account deletion.'
  };
}
