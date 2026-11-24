/** Audit ONLY a specifically named isolated restore. Do not call on production.
 * Environment supplied by operator; no secrets are echoed.
 */
import {auditRestoredPg} from '../src/restoreAudit.mjs';
const target=process.env.RESTORE_AUDIT_DATABASE_NAME;
if(process.env.RESTORE_AUDIT_ISOLATED!=='true'||!target||
  !process.env.DATABASE_URL){
  console.error('Restore audit requires explicit isolated target and DATABASE_URL.');
  process.exitCode=2;
}else{
  try{
    const report=await auditRestoredPg({
      connectionString:process.env.DATABASE_URL,
      expectedDatabase:target,
      expectedMigrationCount:25
    });
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    if(!report.pass)process.exitCode=1;
  }catch{
    console.error('Restore inventory could not be verified; inspect isolated target.');
    process.exitCode=2;
  }
}
