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
  '/api/v1/auth/confirm-reset','/api/v1/adventure/start'
]);
const hopByHop=new Set(['connection','keep-alive','proxy-authenticate',
  'proxy-authorization','te','trailer','transfer-encoding','upgrade',
  'host','forwarded','x-forwarded-for','x-forwarded-host',
  'x-forwarded-proto','content-length']);
const maxBody=16384;
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
  if(method!=='GET'&&method!=='POST'){
    res.setHeader('Allow','GET, POST');
    fail(res,405,'Método não permitido');return true;
  }
  if(method==='POST' && Number(req.headers['content-length']??0)>maxBody){
    fail(res,413,'Requisição muito grande');return true;
  }
  const headers={};
  for(const [name,value] of Object.entries(req.headers)){
    if(!hopByHop.has(name)&&name!=='accept-encoding'&&
       name!=='sec-fetch-site'&&value!==undefined)
      headers[name]=value;
  }
  headers['accept-encoding']='identity';
  const transport=upstream.protocol==='https:'?httpsRequest:httpRequest;
  const target=transport({
    hostname:upstream.hostname,port:upstream.port||undefined,
    protocol:upstream.protocol,path:pathname,method,headers,
    timeout:10000
  },response=>{
    const out={};
    for(const [name,value] of Object.entries(response.headers)){
      if(!hopByHop.has(name)&&value!==undefined)out[name]=value;
    }
    out['cache-control']='no-store';
    out['x-content-type-options']='nosniff';
    res.writeHead(response.statusCode??502,out);
    response.pipe(res);
  });
  target.on('timeout',()=>target.destroy(new Error('Timeout da API')));
  target.on('error',()=>{
    if(!res.headersSent)fail(res,502,'Serviço de contas indisponível');
    else res.destroy();
  });
  let bytes=0;
  req.on('data',chunk=>{
    bytes+=chunk.length;
    if(bytes>maxBody){target.destroy();fail(res,413,'Requisição muito grande');}
    else if(!target.destroyed)target.write(chunk);
  });
  req.on('end',()=>{if(!target.destroyed)target.end();});
  req.on('error',()=>target.destroy());
  res.on('close',()=>{if(!res.writableEnded)target.destroy();});
  return true;
}
