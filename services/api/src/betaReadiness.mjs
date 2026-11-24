import {evaluateRestoreEvidence} from './restoreEvidence.mjs';
/** ONLINE-01C-23C8: local, offline, read-only beta release evidence checker.
 * No network, database access, secrets, or changes to runtime feature flags.
 * This is a review aid: passing checks never enables public registration.
 */
export const REQUIRED_GATES=Object.freeze([
  'ci','railway','restore','resend','privacy','security'
]);
const sha=/^[0-9a-f]{40}$/;
const text=(value)=>typeof value==='string'&&value.trim().length>0;
const timestamp=(value)=>typeof value==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)&&
  Number.isFinite(Date.parse(value));
const evidence=(value)=>value&&typeof value==='object'&&!Array.isArray(value);
const validProof=(record)=>evidence(record)&&record.passed===true&&
  text(record.reference)&&timestamp(record.checkedAt)&&text(record.reviewer);
export function evaluateBetaReadiness(input,{now=new Date()}={}){
  if(!evidence(input))throw new TypeError('Evidence must be an object');
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))
    throw new TypeError('Invalid reference date');
  const problems=[];
  const head=input.headSha;
  if(!sha.test(head??''))problems.push('headSha: commit SHA-1 completo obrigatório');
  const results={};
  for(const gate of REQUIRED_GATES){
    const record=input.gates?.[gate];
    const blockers=[];
    if(!validProof(record))blockers.push('evidência revisada e aprovada ausente');
    if(validProof(record)&&Date.parse(record.checkedAt)>now.getTime())
      blockers.push('data futura');
    if(gate==='ci'&&record?.commitSha!==head)
      blockers.push('CI não corresponde ao commit alvo');
    if(gate==='railway'&&
       (record?.apiCommitSha!==head||record?.webCommitSha!==head))
      blockers.push('API e web precisam executar exatamente o commit alvo');
    if(gate==='restore'&&
      !(record?.isolated===true&&record?.actuallyRestored===true&&
        record?.integrityVerified===true&&text(record?.backupId)&&
        text(record?.restoreId)&&Number.isFinite(record?.observedRpoMinutes)&&
        record.observedRpoMinutes>=0&&Number.isFinite(record?.observedRtoMinutes)&&
        record.observedRtoMinutes>=0))
      blockers.push('restore real isolado, integridade e RPO/RTO medidos obrigatórios');
    if(gate==='restore'){
      const drill=record?.drill;
      if(!drill){
        blockers.push('chronological real Railway restore evidence required');
      }else{
        const report=evaluateRestoreEvidence(drill,{now});
        if(!report.passed)blockers.push('restore drill: '+report.blockers.join(', '));
        if(drill.backupId!==record.backupId||
          drill.restoreId!==record.restoreId||
          drill.appCommitSha!==head||
          drill.observedRpoMinutes!==record.observedRpoMinutes||
          drill.observedRtoMinutes!==record.observedRtoMinutes)
          blockers.push('restore drill identifiers, RPO/RTO or SHA mismatch');
      }
    }
    if(gate==='resend'&&
      !(record?.domainVerified===true&&record?.verificationDelivered===true&&
        record?.resetDelivered===true&&record?.expirationTested===true))
      blockers.push('domínio, verificação, reset e expiração devem ser testados');
    if(gate==='privacy'&&
      !(text(record?.privacyPolicyUrl)&&text(record?.termsUrl)&&
        record?.retentionApproved===true&&record?.deletionFlowReviewed===true))
      blockers.push('LGPD: políticas, retenção e exclusão precisam revisão');
    if(gate==='security'&&
      !(record?.sessionReviewed===true&&record?.csrfReviewed===true&&
        record?.rateLimitReviewed===true&&record?.ownershipReviewed===true&&
        record?.productionHarnessDisabled===true))
      blockers.push('sessão, CSRF, rate limit, ownership e harness OFF precisam revisão');
    results[gate]={passed:blockers.length===0,blockers};
    if(blockers.length)problems.push(gate+': '+blockers.join('; '));
  }
  return {ready:problems.length===0,headSha:sha.test(head??'')?head:null,
    gates:results,blockers:problems,
    note:'Relatório informativo. Nunca altera cadastro, Railway ou dados.'};
}
