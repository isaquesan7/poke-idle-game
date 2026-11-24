/** 23E23: direct-address observation for two fixed, disposable services.
 * No scans, no arbitrary targets, no account data; no addresses in reports.
 * Manifests use an ephemeral diagnostic token, not a production signing key.
 */
import {createHash,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {isIP,createConnection} from 'node:net';

const hosts=Object.freeze({target:'gateway-isolation-target.railway.internal',
  control:'gateway-isolation-control.railway.internal'});
const maxAddresses=8;
function tokenKey(token){
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new TypeError('Diagnostic token required');
  return createHash('sha256').update('kanto/temporary-address-manifest/v1\0').update(Buffer.from(token,'hex')).digest();
}
function roleName(role){
  if(!Object.hasOwn(hosts,role))throw new TypeError('Invalid disposable role');
  return hosts[role];
}
export function privateAddress(value){
  if(typeof value!=='string'||value.includes('%')||value.length>64)return null;
  const family=isIP(value);
  if(family===4){
    const [a,b]=value.split('.').map(Number);
    if(a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127))
      return {address:value,family};
    return null;
  }
  if(family===6){
    const normal=new URL('http://['+value+']/').hostname.slice(1,-1);
    if(/^f[cd][0-9a-f]{2}:/.test(normal))return {address:normal,family};
  }
  return null;
}
function normalize(records){
  if(!Array.isArray(records)||records.length<1||records.length>maxAddresses)throw new Error('Address inventory unavailable');
  const out=records.map(item=>{
    const p=privateAddress(item?.address);
    if(!p||p.family!==item.family)throw new Error('Non-private or invalid address');
    return p;
  });
  const unique=[...new Map(out.map(x=>[x.address,x])).values()];
  return unique.sort((a,b)=>a.family-b.family||a.address.localeCompare(b.address));
}
function aad(role){return Buffer.from('kanto/address-manifest/v1/'+roleName(role));}
export async function issueAddressManifest({role,token,resolve=lookup,now=Date.now}){
  const key=tokenKey(token),host=roleName(role);let timer;
  try{
    const records=await Promise.race([resolve(host,{all:true}),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error('Address inventory unavailable')),3000);
    })]);
    const addresses=normalize(records);
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
    cipher.setAAD(aad(role));
    const encrypted=Buffer.concat([cipher.update(JSON.stringify({issuedAt:now(),addresses}),'utf8'),cipher.final()]);
    return {v:1,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),
      sealed:encrypted.toString('base64url')};
  }finally{clearTimeout(timer);}
}
export function readAddressManifest({role,token,manifest,now=Date.now}){
  if(!manifest||manifest.v!==1||typeof manifest.iv!=='string'||typeof manifest.tag!=='string'||
    typeof manifest.sealed!=='string'||manifest.sealed.length>2048||
    !/^[A-Za-z0-9_-]{16}$/.test(manifest.iv)||!/^[A-Za-z0-9_-]{22}$/.test(manifest.tag)||
    !/^[A-Za-z0-9_-]+$/.test(manifest.sealed))throw new Error('Invalid manifest');
  const decoder=createDecipheriv('aes-256-gcm',tokenKey(token),Buffer.from(manifest.iv,'base64url'));
  decoder.setAAD(aad(role));decoder.setAuthTag(Buffer.from(manifest.tag,'base64url'));
  const content=JSON.parse(Buffer.concat([decoder.update(Buffer.from(manifest.sealed,'base64url')),decoder.final()]).toString('utf8'));
  const age=now()-content.issuedAt;
  if(!Number.isSafeInteger(content.issuedAt)||age< -2000||age>15000)throw new Error('Stale manifest');
  return normalize(content.addresses);
}
export function tryPrivateTcp(record){
  const addr=privateAddress(record?.address);
  if(!addr||addr.family!==record.family)throw new TypeError('Invalid private address');
  return new Promise(resolve=>{
    let done=false;
    const socket=createConnection({host:addr.address,family:addr.family,port:3000});
    const finish=reason=>{if(done)return;done=true;clearTimeout(timer);socket.destroy();resolve(reason);};
    const timer=setTimeout(()=>finish('timeout'),3000);
    socket.once('connect',()=>finish('connected'));
    socket.once('error',e=>finish(['ENETUNREACH','EHOSTUNREACH','ECONNREFUSED','ETIMEDOUT'].includes(e.code)?e.code:'other'));
  });
}
function aggregate(records,reasons){
  return [4,6].map(family=>{
    const list=reasons.filter((_,i)=>records[i].family===family);
    return {family,count:list.length,connected:list.filter(x=>x==='connected').length,
      noRouteOrTimeout:list.filter(x=>['ENETUNREACH','EHOSTUNREACH','ETIMEDOUT','timeout'].includes(x)).length,
      other:list.filter(x=>!['connected','ENETUNREACH','EHOSTUNREACH','ETIMEDOUT','timeout'].includes(x)).length};
  });
}
export async function observeDirectAddresses({token,getManifest,connect=tryPrivateTcp,now=Date.now}){
  tokenKey(token);
  const obtain=async role=>readAddressManifest({role,token,manifest:await getManifest(role),now});
  const [target,control]=await Promise.all([obtain('target'),obtain('control')]);
  const overlap=target.some(t=>control.some(c=>t.address===c.address));
  if(overlap)return {overlap:true,controlsPassed:false,noDirectAccessObserved:false,productionTrustGranted:false};
  const [targetReasons,controlReasons]=await Promise.all([
    Promise.all(target.map(connect)),Promise.all(control.map(connect))]);
  const [afterTarget,afterControl]=await Promise.all([obtain('target'),obtain('control')]);
  const stable=JSON.stringify(target)===JSON.stringify(afterTarget)&&JSON.stringify(control)===JSON.stringify(afterControl);
  const targetSummary=aggregate(target,targetReasons),controlSummary=aggregate(control,controlReasons);
  const comparableFamilies=targetSummary.every(t=>t.count===0||controlSummary.some(c=>c.family===t.family&&c.count>0&&c.connected===c.count));
  const controlsPassed=stable&&comparableFamilies&&controlReasons.every(r=>r==='connected');
  const noDirectAccessObserved=controlsPassed&&targetReasons.every(r=>['ENETUNREACH','EHOSTUNREACH','ETIMEDOUT','timeout'].includes(r));
  return {overlap:false,stable,comparableFamilies,targetSummary,controlSummary,controlsPassed,
    noDirectAccessObserved,productionTrustGranted:false,note:'Bounded TCP observation; timeout is not proof of universal isolation'};
}
