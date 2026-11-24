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
// Collection writer is reachable through Web only in the existing test mode.
if(process.env.NODE_ENV==='test'){
  allowed.add('/api/v1/collection/team');
  for(const command of ['current','reserve','start','turn','certify','settle','finish'])
    allowed.add('/api/v1/region/'+command);
}
if(process.env.NODE_ENV==='test'&&process.env.ONLINE_GYM_PORTAL_CI_ONLY==='true'){
  for(const command of ['current','reserve','start','turn','certify','settle'])allowed.add('/api/v1/gym/'+command);
}
if(process.env.NODE_ENV==='test'&&process.env.ONLINE_EXPEDITION_CI_ONLY==='true'){
  for(const command of ['current','start','claim','stop'])allowed.add('/api/v1/expedition/'+command);
}
if(process.env.NODE_ENV==='test'&&process.env.ONLINE_SHOP_CI_ONLY==='true'){
  for(const command of ['current','purchase'])allowed.add('/api/v1/shop/'+command);
}
if(process.env.NODE_ENV==='test'&&process.env.ONLINE_MOVES_CI_ONLY==='true'){
  for(const command of ['current','equip'])allowed.add('/api/v1/moves/'+command);
}
if(process.env.NODE_ENV==='test'&&process.env.ONLINE_EVOLUTION_CI_ONLY==='true'){
  for(const command of ['current','evolve'])allowed.add('/api/v1/evolution/'+command);
}
if(process.env.NODE_ENV==='test'&&process.env.ONLINE_POKEMON_TRAINING_CI_ONLY==='true'){
  for(const command of ['current','train'])allowed.add('/api/v1/pokemon-training/'+command);
}
const readPaths=new Set(['/api/v1/status','/api/v1/me','/api/v1/save','/api/v1/region/current','/api/v1/gym/current','/api/v1/expedition/current','/api/v1/shop/current','/api/v1/moves/current','/api/v1/evolution/current','/api/v1/pokemon-training/current']);
const maxBody=16384;
// Default strips proofs; reviewed deployment can relay opaque assertions without keys.
// The web proxy has NO signing key and cannot create client identities.
const gatewayForwardTest=process.env.NODE_ENV==='test'&&process.env.ONLINE_GATEWAY_FORWARD_TEST_ONLY==='true';
if(gatewayForwardTest&&(!upstream||upstream.protocol!=='http:'||upstream.hostname!=='127.0.0.1'||!upstream.port))
  throw new Error('Gateway forwarding harness requires loopback API');
const forwardMode=process.env.ONLINE_GATEWAY_FORWARD_MODE;
if(forwardMode!==undefined&&forwardMode!=='reviewed')throw new Error('Invalid gateway forwarding mode');
const gatewayForwardReviewed=forwardMode==='reviewed';
if(gatewayForwardReviewed&&(process.env.NODE_ENV!=='production'||gatewayForwardTest||
    !upstream||upstream.protocol!=='http:'||!(/^[a-z0-9-]+\.railway\.internal$/).test(upstream.hostname)||!upstream.port||
    ['GATEWAY_SIGNING_HEX','GATEWAY_SUBJECT_HEX','ONLINE_GATEWAY_RECEIVER_ACTIVE_HEX','ONLINE_SIGNED_QUOTA_TEST_KEY'].some(k=>process.env[k]!==undefined)))
  throw new Error('Reviewed forwarding requires private API and no gateway keys');
const signedPaths=new Set(['/api/v1/auth/register','/api/v1/auth/verify',
  '/api/v1/auth/login','/api/v1/auth/request-reset','/api/v1/auth/confirm-reset']);
function gatewayProof(req){
  const values=[];
  for(let i=0;i<req.rawHeaders.length;i+=2)
    if(req.rawHeaders[i].toLowerCase()==='x-kanto-proxy-identity')values.push(req.rawHeaders[i+1]);
  if(values.length!==1||typeof values[0]!=='string'||values[0].length>180||
     connectionTokens(req.headers).has('x-kanto-proxy-identity'))return null;
  return values[0];
}
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
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'});
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
  const proofRequired=(gatewayForwardTest||gatewayForwardReviewed)&&signedPaths.has(pathname);
  const proof=proofRequired?gatewayProof(req):null;
  if(proofRequired&&(!proof||req.url!==pathname)){
    fail(res,403,'Identidade de gateway inválida');req.resume();return true;
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
    if(proofRequired)headers['x-kanto-proxy-identity']=proof;
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
      out['x-frame-options']='DENY';
      out['referrer-policy']='no-referrer';
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
