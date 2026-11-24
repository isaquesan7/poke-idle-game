/**
 * Standalone, short-lived observation service. Never import in game runtime.
 * No account/database access; never records or returns raw client IPs.
 */
import {createServer} from 'node:http';
import {isIP} from 'node:net';
import {timingSafeEqual,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

function ip(value){
  if(typeof value!=='string'||value.length>64||value.includes('%')||!isIP(value))return null;
  if(isIP(value)===4)return value;
  const normal=new URL('http://['+value+']/').hostname.slice(1,-1);
  const mapped=/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normal);
  if(!mapped)return normal;
  const hi=parseInt(mapped[1],16),lo=parseInt(mapped[2],16);
  return [hi>>>8,hi&255,lo>>>8,lo&255].join('.');
}
function values(rawHeaders,name){
  const result=[];
  for(let i=0;i<rawHeaders.length;i+=2)
    if(rawHeaders[i].toLowerCase()===name)result.push(rawHeaders[i+1]);
  return result;
}
export function observeIngress(rawHeaders,peer){
  const real=values(rawHeaders,'x-real-ip');
  const expected=values(rawHeaders,'x-kanto-probe-expected');
  const candidate=real.length===1?ip(real[0]):null;
  const reference=expected.length===1?ip(expected[0]):null;
  return {
    realIpHeaderCount:real.length,
    realIpValid:candidate!==null,
    expectedValid:reference!==null,
    matchesExpected:candidate!==null&&reference!==null&&candidate===reference,
    matchesSocketPeer:candidate!==null&&candidate===ip(peer),
    forwardedHeaderPresent:values(rawHeaders,'x-forwarded-for').length>0,
    edgeHeaderPresent:values(rawHeaders,'x-railway-edge').length>0
  };
}
const hash=value=>createHash('sha256').update(value).digest();
export function createIngressProbe({token,now=Date.now,lifetimeMs=15*60*1000,maxRequests=60}){
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))
    throw new TypeError('Use a random 32-byte hex probe token');
  if(!Number.isInteger(lifetimeMs)||lifetimeMs<1||lifetimeMs>15*60*1000||
    !Number.isInteger(maxRequests)||maxRequests<1||maxRequests>60)throw new TypeError('Invalid probe limits');
  const expires=now()+lifetimeMs,expected=hash('Bearer '+token);
  let count=0;
  return createServer({requestTimeout:5000,headersTimeout:5000,maxHeaderSize:8192},(req,res)=>{
    const respond=(status,data)=>{
      res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff','Connection':'close'});
      res.end(JSON.stringify(data));
    };
    if(req.method!=='GET'||req.url!=='/probe'||req.headers['transfer-encoding']||
      (req.headers['content-length']&&req.headers['content-length']!=='0'))return respond(404,{ok:false});
    const auth=values(req.rawHeaders,'authorization');
    if(auth.length!==1||!timingSafeEqual(hash(auth[0]),expected))return respond(404,{ok:false});
    if(now()>=expires||count>=maxRequests)return respond(410,{ok:false});
    count++;
    return respond(200,observeIngress(req.rawHeaders,req.socket.remoteAddress));
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.env.INGRESS_PROBE_ISOLATED!=='true'||process.env.DATABASE_URL||
    process.env.ONLINE_API_INTERNAL_URL||process.env.RAILWAY_ENVIRONMENT_NAME==='production')
    throw new Error('Probe requires a separate empty non-production environment');
  const port=Number(process.env.PORT||3000);
  const server=createIngressProbe({token:process.env.INGRESS_PROBE_TOKEN});
  server.listen(port,'::');
}
