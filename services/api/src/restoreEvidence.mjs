/** ONLINE-01C-23D5: offline evidence CONSISTENCY checker, not proof of
 * backup authenticity. Never connects to Railway or changes deployment flags.
 */
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const sha=/^[0-9a-f]{40}$/;
const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const id=value=>typeof value==='string'&&value.trim().length>=6&&
  value.trim().length<=160&&!/[\s/@?#]/.test(value);
const date=value=>typeof value==='string'&&iso.test(value)&&
  Number.isFinite(Date.parse(value))&&new Date(Date.parse(value)).toISOString()
    .startsWith(value.replace(/\.\d+Z$/,'Z').replace(/Z$/,''));
const difference=(a,b)=>(Date.parse(a)-Date.parse(b))/60000;
const nonnegative=value=>Number.isFinite(value)&&value>=0;
const equalMinutes=(a,b)=>nonnegative(b)&&Math.abs(a-b)<=1/60;
const safe=(value)=>value&&typeof value==='object'&&!Array.isArray(value);

/**
 * Source/target must be separate Railway services and environments. Timestamps
 * yield computed RPO/RTO; declared numbers cannot be substituted for evidence.
 * All inputs are operator attestations until independently checked.
 */
export function evaluateRestoreEvidence(record,{now=new Date()}={}){
  if(!safe(record)||!(now instanceof Date)||!Number.isFinite(now.getTime()))
    throw new TypeError('Invalid restore evidence');
  const blockers=[];
  if(record.provider!=='railway'||
    !['pitr','volume-snapshot'].includes(record.method))
    blockers.push('railway_restore_method_required');
  if(!uuid.test(record.sourceEnvironmentId??'')||
    !uuid.test(record.restoreEnvironmentId??'')||
    record.sourceEnvironmentId===record.restoreEnvironmentId||
    !uuid.test(record.sourceServiceId??'')||
    !uuid.test(record.restoreServiceId??'')||
    record.sourceServiceId===record.restoreServiceId)
    blockers.push('separate_railway_environment_and_service_required');
  if(!id(record.backupId)||!id(record.restoreId)||
    record.backupId===record.restoreId)
    blockers.push('distinct_operation_receipts_required');
  if(record.restoredIntoNewService!==true||
    record.productionSourceUnaffected!==true||
    record.apiNeverPointedAtRestore!==true)
    blockers.push('source_isolation_attestation_required');
  if(record.integrityAuditPassed!==true||
    !id(record.integrityAuditReference)||
    !sha.test(record.appCommitSha??''))
    blockers.push('restore_integrity_audit_reference_required');
  if(!id(record.operator)||!id(record.reviewer)||
    record.operator===record.reviewer)
    blockers.push('independent_operator_review_required');
  const requiredTimes=['recoveryPointUtc','incidentUtc','restoreStartedUtc',
    'restoredHealthyUtc','integrityCheckedUtc','reviewedUtc'];
  if(requiredTimes.some(name=>!date(record[name])))
    blockers.push('invalid_utc_timeline');
  let observedRpoMinutes=null,observedRtoMinutes=null;
  if(!blockers.includes('invalid_utc_timeline')){
    const t=Object.fromEntries(requiredTimes.map(name=>[name,Date.parse(record[name])]));
    if(!(t.recoveryPointUtc<=t.incidentUtc&&
      t.incidentUtc<=t.restoreStartedUtc&&
      t.restoreStartedUtc<=t.restoredHealthyUtc&&
      t.restoredHealthyUtc<=t.integrityCheckedUtc&&
      t.integrityCheckedUtc<=t.reviewedUtc&&t.reviewedUtc<=now.getTime()))
      blockers.push('chronology_or_future_review_invalid');
    else{
      observedRpoMinutes=difference(record.incidentUtc,record.recoveryPointUtc);
      observedRtoMinutes=difference(record.restoredHealthyUtc,record.incidentUtc);
      if(!equalMinutes(observedRpoMinutes,record.observedRpoMinutes)||
        !equalMinutes(observedRtoMinutes,record.observedRtoMinutes))
        blockers.push('rpo_rto_not_measured_from_timestamps');
    }
  }
  if(record.method==='pitr'&&record.pitrWalReplayVerified!==true)
    blockers.push('pitr_wal_replay_not_verified');
  if(record.method==='volume-snapshot'&&record.pitrWalReplayVerified===true)
    blockers.push('volume_snapshot_must_not_claim_pitr');
  return {
    passed:blockers.length===0,blockers,
    observedRpoMinutes,observedRtoMinutes,
    note:'Checks operator-reported fields only; requires independent Railway evidence review. Never grants beta access.'
  };
}
