/** D6M — Offline release review contract. Not imported by runtime, never authorizes activation. */
import {evaluateBetaReadiness} from './betaReadiness.mjs';
import {ONLINE_ROUTES} from './onlineRoutePolicy.mjs';

export const RELEASE_ROLES=Object.freeze(['api','web','gateway']);
export const RELEASE_REVIEW_IDS=Object.freeze([
  'migration-026','migration-027','gateway-topology','regional-key-retention',
  'route-status-contract','rollback-plan'
]);
export const RELEASE_ROUTE_GROUPS=Object.freeze([...new Set(ONLINE_ROUTES.map(r=>r.group))]);
const sha=/^[a-f0-9]{40}$/;
const digest=/^[a-f0-9]{64}$/;
const nonblank=v=>typeof v==='string'&&v.trim().length>0;
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const time=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(v)&&Number.isFinite(Date.parse(v));
function reviewed(p,head,now){
  return record(p)&&p.commitSha===head&&p.passed===true&&
    nonblank(p.reference)&&nonblank(p.operator)&&nonblank(p.reviewer)&&
    p.operator.trim().toLowerCase()!==p.reviewer.trim().toLowerCase()&&
    time(p.checkedAt)&&Date.parse(p.checkedAt)<=now.getTime();
}
function exactGroups(groups){
  return Array.isArray(groups)&&groups.length===RELEASE_ROUTE_GROUPS.length&&
    new Set(groups).size===groups.length&&RELEASE_ROUTE_GROUPS.every(g=>groups.includes(g));
}
/** Evaluates attestations, not live infrastructure. Never copies supplied references or values. */
export function evaluateReleaseReview(input,{now=new Date()}={}){
  if(!record(input)||!(now instanceof Date)||!Number.isFinite(now.getTime()))
    throw new TypeError('Invalid release review document or date');
  const head=input.headSha;
  const blockers=[];
  const check=(id,fn)=>{try{if(!fn())blockers.push(id);}catch{blockers.push(id);}};
  check('target-sha',()=>typeof head==='string'&&sha.test(head));
  check('beta-readiness',()=>input.betaEvidence?.headSha===head&&
    evaluateBetaReadiness(input.betaEvidence,{now}).ready===true);
  for(const role of RELEASE_ROLES){
    check('config-'+role,()=>{
      const p=input.configReviews?.[role];
      return reviewed(p,head,now)&&p.report?.role===role&&
        p.report.configShapeValid===true&&p.report.publicRegistrationAuthorized===false&&
        Array.isArray(p.report.blockers)&&p.report.blockers.length===0;
    });
  }
  for(const id of RELEASE_REVIEW_IDS){
    check(id,()=>{
      const p=input.reviews?.[id];
      if(!reviewed(p,head,now))return false;
      switch(id){
        case 'migration-026':
        case 'migration-027':
          return typeof p.sqlSha256==='string'&&digest.test(p.sqlSha256)&&
            p.disposablePg18Verified===true&&p.registryChecksumReviewed===true&&
            p.productionStillUnchanged===true;
        case 'gateway-topology':
          return p.exclusiveIngressVerified===true&&p.directWebBypassRejected===true&&
            p.crossServiceKeyMatchReviewed===true;
        case 'regional-key-retention':
          return p.restartVerified===true&&p.historicalKeysRetained===true&&
            p.concurrentRotationReviewed===true;
        case 'route-status-contract':
          return exactGroups(p.groups)&&p.apiAuthoritative===true&&p.ciHarnessDenied===true&&
            p.registrationClosed===true&&p.savesClosed===true;
        case 'rollback-plan':
          return p.registrationCloseFirst===true&&p.pendingActionsPreserved===true&&
            p.noAutomaticDatabaseRollback===true;
        default:return false;
      }
    });
  }
  return {reviewComplete:blockers.length===0,blockers,
    publicRegistrationAuthorized:false,publicSavesAuthorized:false};
}
