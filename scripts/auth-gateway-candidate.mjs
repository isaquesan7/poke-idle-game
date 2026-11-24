/** 23E18: isolated auth gateway candidate. No standalone launcher or production
 * wiring. The resolver MUST be supplied by a separately validated ingress.
 * Never obtain trust from an arbitrary header in this module.
 */
import {createServer,request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';

const paths=new Set(['/api/v1/auth/register','/api/v1/auth/verify',
  '/api/v1/auth/login','/api/v1/auth/request-reset','/api/v1/auth/confirm-reset']);
const responseAllow=new Set(['content-type','set-cookie','retry-after']);
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
export function createAuthGateway({upstreamOrigin,clientOrigin,issuer,resolveTrustedClientIp,loopbackTest=false}){
  if(loopbackTest&&process.env.NODE_ENV!=='test')throw new Error('Loopback is test-only');
  const upstream=exactOrigin(upstreamOrigin,{loopback:loopbackTest});
  const browser=exactOrigin(clientOrigin,{loopback:loopbackTest});
  if(upstream.origin===browser.origin||typeof issuer?.sign!=='function'||
      typeof resolveTrustedClientIp!=='function')throw new TypeError('Invalid isolated gateway configuration');
  const server=createServer(async(req,res)=>{
    if(!paths.has(req.url)){deny(res,404);req.resume();return;}
    if(req.method!=='POST'){deny(res,405);req.resume();return;}
    if(rawValues(req,'origin').length!==1||req.headers.origin!==browser.origin||
       rawValues(req,'content-type').length!==1||!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??'')||
       connectionTokens(req.headers.connection).some(x=>['origin','content-type'].includes(x))){
      deny(res,400);req.resume();return;
    }
    // Browser-supplied proof is never copied. The trusted adapter is external.
    let ip;
    try{ip=resolveTrustedClientIp(req);}catch{deny(res,403);req.resume();return;}
    if(typeof ip!=='string'||!ip){deny(res,403);req.resume();return;}
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
      let assertion;
      try{assertion=issuer.sign({trustedClientIp:ip,method:'POST',path:req.url,body});}
      catch{deny(res,403);return;}
      const transport=upstream.protocol==='https:'?httpsRequest:httpRequest;
      const target=transport({protocol:upstream.protocol,hostname:upstream.hostname,port:upstream.port||undefined,
        method:'POST',path:req.url,headers:{'content-type':req.headers['content-type'],
          origin:browser.origin,'content-length':String(body.length),'accept-encoding':'identity',
          'x-kanto-proxy-identity':assertion},timeout:10000},response=>{
        // Never relay arbitrary internal headers or redirects.
        if((response.statusCode??500)>=300&&(response.statusCode??500)<400){response.resume();deny(res,502);return;}
        const headers={'cache-control':'no-store','x-content-type-options':'nosniff',
          'x-frame-options':'DENY','referrer-policy':'no-referrer'};
        const nominated=connectionTokens(response.headers.connection);
        for(const name of responseAllow)
          if(response.headers[name]!==undefined&&!nominated.includes(name))headers[name]=response.headers[name];
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
