import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';

// ONLINE-01C-4. Explicit opt-in: leave unset until private Railway routing,
// backups and email delivery are independently verified.
const upstreamValue=process.env.ONLINE_API_INTERNAL_URL;
let upstream=null;
if(upstreamValue){
  upstream=new URL(upstreamValue);
  if(!['http:','https:'].includes(upstream.protocol)||
      upstream.username||upstream.password||upstream.search||upstream.hash||
      upstream.pathname!=='/' || !upstream.hostname)
    throw new Error('ONLINE_API_INTERNAL_URL must be an origin without credentials');
}
const allowed=new Set([
  '/api/v1/status','/api/v1/me','/api/v1/save',
  '/api/v1/auth/register','/api/v1/auth/verify','/api/v1/auth/login',
  '/api/v1/auth/logout','/api/v1/auth/request-reset',
  '/api/v1/auth/confirm-reset','/api/v1/adventure/start',
  '/api/v1/trainer/invest'
]);
const hopByHop=new Set(['connection','keep-alive','proxy-authenticate',
  'proxy-authorization','te','trailer','transfer-encoding','upgrade',
  'host','forwarded','x-forwarded-for','x-forwarded-host',
  'x-forwarded-proto','content-length']);
// Only these headers belong to the account protocol. Never propagate
// externally supplied proxy identity, tracing or arbitrary internal headers.
const requestHeaders=new Set(['content-type','origin','cookie','accept']);
const responseHeaders=new Set(['content-type','set-cookie','retry-after','allow',
  'x-frame-options','referrer-policy','x-robots-tag','content-disposition','vary']);
const readPaths=new Set(['/api/v1/status','/api/v1/me','/api/v1/save']);
const maxBody=16384;
function connectionTokens(headers){
  return new Set(String(headers.connection??'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
}
function pickHeaders(headers,allow){
  const nominated=connectionTokens(headers);
  const out={};
  for(const [name,value] of Object.entries(headers)){
    if(allow.has(name)&&!hopByHop.has(name)&&!nominated.has(name)&&value!==undefined)
      out[name]=value;
  }
  return out;
}
function fail(res,status,message){
  if(res.headersSent){res.destroy();return;}
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify({error:message}));
}
export function proxyOnlineApi(req,res,pathname){
  if(!pathname.startsWith('/api/'))return false;
  if(!allowed.has(pathname)){
    fail(res,404,'Rota não disponível');return true;
  }
  if(!upstream){
    fail(res,503,'Contas online em preparação');return true;
  }
  const method=req.method;
  const allowedMethod=readPaths.has(pathname)?'GET':'POST';
  if(method!==allowedMethod){
    res.setHeader('Allow',allowedMethod);
    fail(res,405,'Método não permitido');return true;
  }
  const contentLength=Number(req.headers['content-length']??0);
  if(contentLength>maxBody){
    fail(res,413,'Requisição muito grande');req.resume();return true;
  }
  if(method==='GET'&&(contentLength!==0||req.headers['transfer-encoding'])){
    fail(res,400,'Corpo não permitido');req.resume();return true;
  }
  // Collect at most 16 KiB before opening any upstream connection. A partial
  // oversized or aborted upload must never reach an account writer.
  let bytes=0,finished=false;
  const chunks=[];
  const timer=setTimeout(()=>{
    if(finished)return;
    finished=true;chunks.length=0;res.setHeader('Connection','close');
    fail(res,408,'Tempo de envio excedido');req.resume();
  },10000);
  timer.unref();
  function abandon(){
    if(finished)return;
    finished=true;clearTimeout(timer);chunks.length=0;
  }
  req.on('aborted',abandon);
  req.on('error',abandon);
  res.on('close',abandon);
  req.on('data',chunk=>{
    if(finished)return;
    bytes+=chunk.length;
    if(bytes>maxBody){
      abandon();res.setHeader('Connection','close');
      fail(res,413,'Requisição muito grande');req.resume();return;
    }
    chunks.push(chunk);
  });
  req.on('end',()=>{
    if(finished)return;
    finished=true;clearTimeout(timer);
    const headers=pickHeaders(req.headers,requestHeaders);
    headers['accept-encoding']='identity';
    if(method==='POST')headers['content-length']=String(bytes);
    const transport=upstream.protocol==='https:'?httpsRequest:httpRequest;
    const target=transport({
      hostname:upstream.hostname,port:upstream.port||undefined,
      protocol:upstream.protocol,path:pathname,method,headers,
      timeout:10000
    },response=>{
      const out=pickHeaders(response.headers,responseHeaders);
      out['cache-control']='no-store';
      out['x-content-type-options']='nosniff';
      res.writeHead(response.statusCode??502,out);
      response.on('error',()=>res.destroy());
      response.pipe(res);
    });
    target.on('timeout',()=>target.destroy(new Error('Timeout da API')));
    target.on('error',()=>{
      if(!res.headersSent)fail(res,502,'Serviço de contas indisponível');
      else res.destroy();
    });
    res.on('close',()=>{if(!res.writableEnded)target.destroy();});
    target.end(Buffer.concat(chunks,bytes));
  });
  return true;
}
