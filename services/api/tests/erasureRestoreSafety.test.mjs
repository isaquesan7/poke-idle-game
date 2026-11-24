import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateDeletionAfterRestoreDrill} from '../src/erasureRestoreSafety.mjs';
const now=new Date('2026-11-24T13:00:00Z');
function fixture(){
  return {
    environment:'isolated',productionUnchanged:true,
    backupReference:'backup-isolated-001',
    restoreReference:'restore-isolated-002',
    backupRecoveryPointUtc:'2026-11-24T09:00:00Z',
    restoredAtUtc:'2026-11-24T09:30:00Z',
    reconciledAtUtc:'2026-11-24T10:00:00Z',
    reviewedAtUtc:'2026-11-24T11:00:00Z',
    deletedSinceRecoveryPointCount:3,reconciledDeletionCount:3,
    externalDeletionLedgerVerified:true,
    ledgerEvidenceReference:'external-ledger-audit-001',
    restoredAccountsRescanned:true,
    operator:'operator-one',reviewer:'reviewer-two'
  };
}
test('23E0: even a coherent rehearsal cannot authorize production restoration',()=>{
  const r=evaluateDeletionAfterRestoreDrill(fixture(),{now});
  assert.equal(r.internallyConsistent,true);
  assert.equal(r.productionRestorePermitted,false);
});
test('23E0: an un-replayed deletion blocks an otherwise successful restore',()=>{
  const data=fixture();
  data.reconciledDeletionCount=2;
  assert.ok(evaluateDeletionAfterRestoreDrill(data,{now}).blockers
    .includes('unreconciled_deletions'));
});
test('23E0: absent independent ledger or account rescan blocks',()=>{
  const data=fixture();data.externalDeletionLedgerVerified=false;
  data.restoredAccountsRescanned=false;
  assert.ok(evaluateDeletionAfterRestoreDrill(data,{now}).blockers
    .includes('external_ledger_and_rescan_unverified'));
});
test('23E0: prevents production, chronology and reviewer bypass',()=>{
  const data=fixture();
  data.environment='production';data.reviewer=data.operator;
  data.reviewedAtUtc='2027-01-01T00:00:00Z';
  const errors=evaluateDeletionAfterRestoreDrill(data,{now}).blockers;
  assert.ok(errors.includes('isolated_restore_proof_required'));
  assert.ok(errors.includes('timeline_invalid'));
  assert.ok(errors.includes('independent_review_required'));
});
test('23E0: malformed counts and evidence fail closed',()=>{
  const data=fixture();data.deletedSinceRecoveryPointCount=-1;
  assert.ok(evaluateDeletionAfterRestoreDrill(data,{now}).blockers.includes('unreconciled_deletions'));
  assert.throws(()=>evaluateDeletionAfterRestoreDrill(null,{now}),TypeError);
});
