/** OFFLINE validation only. Never prints the raw operator evidence. */
import {readFile} from 'node:fs/promises';
import {evaluateRestoreEvidence} from '../src/restoreEvidence.mjs';
const file=process.argv[2];
if(!file){
  console.error('Usage: node scripts/check-restore-evidence.mjs /private/evidence.json');
  process.exitCode=2;
}else{
  try{
    const raw=await readFile(file,'utf8');
    const input=JSON.parse(raw);
    const report=evaluateRestoreEvidence(input);
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    if(!report.passed)process.exitCode=1;
  }catch{
    console.error('Invalid evidence file or restore evidence structure.');
    process.exitCode=2;
  }
}
