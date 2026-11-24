/** ONLINE-01C-23E0: offline safety check for deletion reintroduction after a backup restore.
 * NO database mutations or API effects. Operator assertions are not verification.
 */
const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{6,128}$/.test(x);
const time=x=>typeof x==='string'&&iso.test(x)&&Number.isFinite(Date.parse(x));
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const count=x=>Number.isSafeInteger(x)&&x>=0;
/**
 * A real deletion ledger is not implemented yet. This gate therefore cannot
 * approve any restoration into production. It can check that a recovery drill
 * is internally coherent and that unreconciled deletions are flagged.
 */
export function evaluateDeletionAfterRestoreDrill(record,{now=new Date()}={}){
  if(!object(record)||!(now instanceof Date)||!Number.isFinite(now.getTime()))
    throw new TypeError('Invalid restore/deletion drill');
  const blockers=[];
  if(record.environment!=='isolated'||record.productionUnchanged!==true||
    !id(record.backupReference)||!id(record.restoreReference)||
    record.backupReference===record.restoreReference)
    blockers.push('isolated_restore_proof_required');
  if(!time(record.backupRecoveryPointUtc)||!time(record.restoredAtUtc)||
    !time(record.reconciledAtUtc)||!time(record.reviewedAtUtc)){
    blockers.push('utc_milestones_required');
  }else if(!(Date.parse(record.backupRecoveryPointUtc)<=
      Date.parse(record.restoredAtUtc)&&
      Date.parse(record.restoredAtUtc)<=Date.parse(record.reconciledAtUtc)&&
      Date.parse(record.reconciledAtUtc)<=Date.parse(record.reviewedAtUtc)&&
      Date.parse(record.reviewedAtUtc)<=now.getTime()))
    blockers.push('timeline_invalid');
  if(!count(record.deletedSinceRecoveryPointCount)||
    !count(record.reconciledDeletionCount)||
    record.deletedSinceRecoveryPointCount!==record.reconciledDeletionCount)
    blockers.push('unreconciled_deletions');
  if(record.externalDeletionLedgerVerified!==true||
    !id(record.ledgerEvidenceReference)||
    record.restoredAccountsRescanned!==true)
    blockers.push('external_ledger_and_rescan_unverified');
  if(!id(record.operator)||!id(record.reviewer)||record.operator===record.reviewer)
    blockers.push('independent_review_required');
  return {
    internallyConsistent:blockers.length===0,
    productionRestorePermitted:false,
    blockers,
    note:'Checklist only. Does not verify deletion ledger or authorize restore into production.'
  };
}
