/**
 * ONLINE-01C-23E10: offline protocol candidate, NOT wired to HTTP.
 * Only a separately authenticated ingress may provide trustedClientIp.
 * A valid assertion is a throttle subject, never account authentication.
 */
import {createHmac,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';

const routes=new Set(['/api/v1/auth/register','/api/v1/auth/verify',
  '/api/v1/auth/request-reset','/api/v1/auth/confirm-reset','/api/v1/auth/login']);
const digestPattern=/^[A-Za-z0-9_-]{43}$/;
const noncePattern=/^[A-Za-z0-9_-]{22}$/;
const maxAgeMs=30000, futureSkewMs=2000;

function key(value){
  if(!Buffer.isBuffer(value)||value.length!==32)
    throw new TypeError('Expected a dedicated 32-byte key');
  return value;
}
function canonicalBytes(value,pattern,size){
  if(typeof value!=='string'||!pattern.test(value))return false;
  const bytes=Buffer.from(value,'base64url');
  return bytes.length===size&&bytes.toString('base64url')===value;
}
export function canonicalClientIp(ip){
  if(typeof ip!=='string'||ip.length>64||ip.includes('%')||!isIP(ip))
    throw new TypeError('Expected exactly one validated client IP');
  if(isIP(ip)===4)return ip;
  const normalized=new URL('http://['+ip+']/').hostname.slice(1,-1);
  // IPv4-mapped IPv6 and plain IPv4 must not get distinct quotas.
  const mapped=/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
  if(mapped){
    const hi=parseInt(mapped[1],16),lo=parseInt(mapped[2],16);
    return [hi>>>8,hi&255,lo>>>8,lo&255].join('.');
  }
  return normalized;
}
function requestBinding(method,path,body){
  if(method!=='POST'||!routes.has(path)||!Buffer.isBuffer(body)||body.length>16384)
    throw new TypeError('Invalid account request binding');
  return [method,path,createHash('sha256').update(body).digest('base64url')];
}
function mac(secret,parts){
  return createHmac('sha256',key(secret)).update(JSON.stringify(parts)).digest('base64url');
}
function time(value){
  if(!Number.isSafeInteger(value)||value<0)throw new TypeError('Invalid clock');
  return value;
}
export function signProxyIdentity({trustedClientIp,subjectKey,signingKey,method,path,body,nowMs=Date.now()}){
  key(subjectKey);key(signingKey);
  if(timingSafeEqual(subjectKey,signingKey))throw new TypeError('Use separate keys');
  const binding=requestBinding(method,path,body);
  const subject=mac(subjectKey,['kanto/client-quota/v1',canonicalClientIp(trustedClientIp)]);
  const timestamp=String(time(nowMs));
  const nonce=randomBytes(16).toString('base64url');
  const signature=mac(signingKey,['kanto/web-to-api/quota/v1',timestamp,nonce,subject,...binding]);
  return ['v1',timestamp,nonce,subject,signature].join('.');
}
export function verifyProxyIdentity({assertion,signingKey,method,path,body,nowMs=Date.now()}){
  // No fallback to request headers or peer on verification failure.
  key(signingKey);
  if(typeof assertion!=='string'||assertion.length>180)return null;
  const fields=assertion.split('.');
  if(fields.length!==5)return null;
  const [version,timestamp,nonce,subject,signature]=fields;
  if(version!=='v1'||!/^(0|[1-9][0-9]{0,15})$/.test(timestamp)||
    !canonicalBytes(nonce,noncePattern,16)||!canonicalBytes(subject,digestPattern,32)||
    !canonicalBytes(signature,digestPattern,32))return null;
  const issued=Number(timestamp),now=time(nowMs);
  if(!Number.isSafeInteger(issued)||now-issued>maxAgeMs||issued-now>futureSkewMs)return null;
  let binding;
  try{binding=requestBinding(method,path,body);}catch{return null;}
  const expected=mac(signingKey,['kanto/web-to-api/quota/v1',timestamp,nonce,subject,...binding]);
  if(!timingSafeEqual(Buffer.from(expected,'base64url'),Buffer.from(signature,'base64url')))return null;
  // Caller MUST provide atomic cross-replica nonce consumption before HTTP use.
  return {subject,nonce,issuedAtMs:issued,expiresAtMs:issued+maxAgeMs};
}
