/** 23E18: isolated auth gateway candidate. No standalone launcher or production
 * wiring. The resolver MUST be supplied by a separately validated ingress.
 * Never obtain trust from an arbitrary header in this module.
 */
import {createServer,request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {onlineRoute} from '../services/api/src/onlineRoutePolicy.mjs';

const paths=new Set(['/api/v1/auth/register','/api/v1/auth/verify',
  '/api/v1/auth/login','/api/v1/auth/request-reset','/api/v1/auth/confirm-reset']);
const apiReads=new Set(['/api/v1/status','/api/v1/me','/api/v1/save']);
const pages=new Set(['/','/verify-email','/reset-password','/play','/play/','/regions','/regions/','/online','/online/']);
const logout='/api/v1/auth/logout';
const responseAllow=new Set(['content-type','retry-after']);
function routeFor(raw,gameplayEnabled){
  if(typeof raw!=='string'||raw.length>2048||!raw.startsWith('/')||raw.startsWith('//')||
     raw.includes('\\')||raw.includes('#'))return null;
  if(paths.has(raw))return {path:raw,kind:'signed'};
  if(apiReads.has(raw))return {path:raw,kind:'read'};
  if(raw===logout)return {path:raw,kind:'logout'};
  // Only the shared allowlist; the API still authenticates and owns every action.
  const gameRoute=gameplayEnabled?onlineRoute(raw):null;
  if(gameRoute&&!gameRoute.signed)return {path:raw,kind:gameRoute.method==='POST'?'game-write':'game-read'};
  // Verification/reset landing is static. Never forward bearer query values
  // into upstream URL/logs; browser retains its own URL for existing JS.
  const question=raw.indexOf('?');
  const path=question<0?raw:raw.slice(0,question);
  if(pages.has(path)&&(question<0||path==='/verify-email'||path==='/reset-password'))
    return {path,kind:'page'};
  if(question>=0)return null;
  if(/^\/assets\/[A-Za-z0-9_.-]+\.(?:js|css|svg|png|webp|woff2?)$/.test(path))
    return {path,kind:'asset'};
  const sprite=/^\/assets\/pokemon-gifs\/poke_([1-9]\d{0,2})\.gif$/.exec(path);
  if(sprite&&Number(sprite[1])<=151)return {path,kind:'asset'};
  return null;
}
function exactOrigin(value,{loopback=false}={}){
  const u=new URL(value);
  if(u.username||u.password||u.search||u.hash||u.pathname!=='/')
    throw new TypeError('Expected an exact origin');
  if(loopback&&u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port)return u;
  if(u.protocol!=='https:'||!u.hostname.endsWith('.up.railway.app')||u.port)
    throw new TypeError('Expected a pinned Railway HTTPS origin');
  return u;
}
function rawValues(req,name){
  const result=[];
  for(let i=0;i<req.rawHeaders.length;i+=2)
    if(req.rawHeaders[i].toLowerCase()===name)result.push(req.rawHeaders[i+1]);
  return result;
}
const connectionTokens=value=>String(value??'').split(',').map(s=>s.trim().toLowerCase());
function deny(res,status){
  if(res.headersSent){res.destroy();return;}
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'});
  res.end(JSON.stringify({error:'Requisição de contas indisponível'}));
}
export function createAuthGateway({upstreamOrigin,clientOrigin,issuer,resolveTrustedClientIp,loopbackTest=false,gameplayEnabled=false}){
  if(loopbackTest&&process.env.NODE_ENV!=='test')throw new Error('Loopback is test-only');
  const upstream=exactOrigin(upstreamOrigin,{loopback:loopbackTest});
  const browser=exactOrigin(clientOrigin,{loopback:loopbackTest});
  if(upstream.origin===browser.origin||typeof issuer?.sign!=='function'||
      typeof resolveTrustedClientIp!=='function')throw new TypeError('Invalid isolated gateway configuration');
  const server=createServer(async(req,res)=>{
    const route=routeFor(req.url,gameplayEnabled===true);
    if(!route){deny(res,404);req.resume();return;}
    const signed=route.kind==='signed',gameWrite=route.kind==='game-write',writing=signed||gameWrite||route.kind==='logout';
    const session=gameWrite||route.kind==='game-read'||route.kind==='logout'||route.path==='/api/v1/me'||route.path==='/api/v1/save';
    const allowed=writing?['POST']:['read','game-read'].includes(route.kind)?['GET']:['GET','HEAD'];
    if(!allowed.includes(req.method)){res.setHeader('Allow',allowed.join(', '));deny(res,405);req.resume();return;}
    const nominated=connectionTokens(req.headers.connection);
    if(writing&&(rawValues(req,'origin').length!==1||req.headers.origin!==browser.origin||
       nominated.includes('origin')||nominated.includes('content-type'))){
      deny(res,400);req.resume();return;
    }
    if((signed||gameWrite)&&(rawValues(req,'content-type').length!==1||
       !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))){
      deny(res,400);req.resume();return;
    }
    if(session&&(rawValues(req,'cookie').length>1||nominated.includes('cookie'))){
      deny(res,400);req.resume();return;
    }
    if(!writing&&(Number(req.headers['content-length']??0)!==0||req.headers['transfer-encoding'])){
      deny(res,400);req.resume();return;
    }
    // Browser-supplied proof is never copied. The trusted adapter is external.
    let ip;
    if(signed){
      try{ip=resolveTrustedClientIp(req);}catch{deny(res,403);req.resume();return;}
      if(typeof ip!=='string'||!ip){deny(res,403);req.resume();return;}
    }
    if(Number(req.headers['content-length']??0)>16384){deny(res,413);req.resume();return;}
    let total=0,done=false;const chunks=[];
    const timer=setTimeout(()=>{if(!done){done=true;chunks.length=0;deny(res,408);req.destroy();}},10000);
    timer.unref();
    const stop=()=>{done=true;clearTimeout(timer);chunks.length=0;};
    req.on('aborted',stop);req.on('error',stop);res.on('close',stop);
    req.on('data',chunk=>{
      if(done)return;total+=chunk.length;
      if(total>16384){stop();deny(res,413);req.resume();return;}
      chunks.push(chunk);
    });
    req.on('end',()=>{
      if(done)return;
      const body=Buffer.concat(chunks,total);stop();
      if(!writing&&body.length){deny(res,400);return;}
      const outbound={'accept-encoding':'identity'};
      if(writing){
        outbound.origin=browser.origin;
        outbound['content-length']=String(body.length);
        if(signed||gameWrite)outbound['content-type']=req.headers['content-type'];
      }
      if(session&&typeof req.headers.cookie==='string')outbound.cookie=req.headers.cookie;
      if(signed){
        try{outbound['x-kanto-proxy-identity']=issuer.sign({trustedClientIp:ip,method:'POST',path:route.path,body});}
        catch{deny(res,403);return;}
      }
      const transport=upstream.protocol==='https:'?httpsRequest:httpRequest;
      const target=transport({protocol:upstream.protocol,hostname:upstream.hostname,port:upstream.port||undefined,
        method:req.method,path:route.path,headers:outbound,timeout:10000},response=>{
        // Never relay arbitrary internal headers or redirects.
        if((response.statusCode??500)>=300&&(response.statusCode??500)<400){response.resume();deny(res,502);return;}
        const headers={'cache-control':'no-store','x-content-type-options':'nosniff',
          'x-frame-options':'DENY','referrer-policy':'no-referrer'};
        const nominated=connectionTokens(response.headers.connection);
        for(const name of responseAllow)
          if(response.headers[name]!==undefined&&!nominated.includes(name))headers[name]=response.headers[name];
        // Only login/logout may set a browser session. Never cache API or pages.
        if((route.path==='/api/v1/auth/login'||route.kind==='logout')&&
           !nominated.includes('set-cookie')&&response.headers['set-cookie']!==undefined)
          headers['set-cookie']=response.headers['set-cookie'];
        if(route.kind==='asset'&&response.statusCode===200&&!nominated.includes('cache-control')){
          const policy=response.headers['cache-control'];
          if(typeof policy==='string'&&/^public, max-age=(?:86400|31536000)(?:, immutable)?$/.test(policy))
            headers['cache-control']=policy;
        }
        res.writeHead(response.statusCode??502,headers);
        response.on('error',()=>res.destroy());response.pipe(res);
      });
      target.on('timeout',()=>target.destroy());
      target.on('error',()=>deny(res,502));
      res.on('close',()=>{if(!res.writableEnded)target.destroy();});
      target.end(body);
    });
  });
  server.requestTimeout=12000;server.headersTimeout=12000;
  return server;
}
