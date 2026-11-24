// Disposable CI only. TLS edge fixture + signature-checking upstream.
// No database, account handler, real user, outbound internet or Railway claim.
import {createServer as httpServer,request} from 'node:http';
import {createServer as httpsServer} from 'node:https';
import {readFileSync} from 'node:fs';
import {createProxyReceiver} from '../services/api/src/proxyKeyring.mjs';
if(process.env.GATEWAY_RUNTIME_SMOKE!=='ci'||process.env.GITHUB_ACTIONS!=='true')
  throw new Error('CI fixture only');
const mode=process.argv[2];
if(mode==='receiver'){
  const receiver=createProxyReceiver({activeHex:process.env.SMOKE_KEY});
  const seen=new Set();
  httpServer(async(req,res)=>{
    let code=404,data={ok:false};
    if(req.url==='/api/v1/status'&&req.method==='GET'){
      code=200;data={registrationEnabled:false,savesEnabled:false};
    }else if(req.url==='/api/v1/auth/login'&&req.method==='POST'){
      const chunks=[];let n=0;
      for await(const c of req){n+=c.length;if(n>16384){res.writeHead(413);res.end();return;}chunks.push(c);}
      const proof=receiver.verify({assertion:req.headers['x-kanto-proxy-identity'],method:req.method,path:req.url,body:Buffer.concat(chunks)});
      if(proof&&req.headers.origin==='https://gateway-ci.up.railway.app'&&!seen.has(proof.nonce)&&!req.headers['x-real-ip']){
        seen.add(proof.nonce);code=200;data={syntheticVerified:true,registrationEnabled:false};
      }else code=403;
    }
    res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));
  }).listen(3001,'0.0.0.0');
}else if(mode==='edge'){
  httpsServer({key:readFileSync('/tls/key.pem'),cert:readFileSync('/tls/cert.pem')},(req,res)=>{
    const headers={...req.headers,host:'web:3000'};delete headers.connection;
    const out=request({hostname:'web',port:3000,path:req.url,method:req.method,headers},up=>{
      res.writeHead(up.statusCode,up.headers);up.pipe(res);
    });
    out.on('error',()=>{res.writeHead(502);res.end();});req.pipe(out);
  }).listen(443,'0.0.0.0');
}else if(mode==='client'){
  const assert=(await import('node:assert/strict')).default;
  const gateway='http://gateway:3000',web='http://web:3000';
  for(let i=0;i<30;i++){
    try{const r=await fetch(gateway+'/api/v1/status',{signal:AbortSignal.timeout(1000)});
      if(r.ok){assert.deepEqual(await r.json(),{registrationEnabled:false,savesEnabled:false});break;}
    }catch{}
    if(i===29)throw new Error('Runtime stack unavailable');
    await new Promise(r=>setTimeout(r,500));
  }
  const call=(base,headers)=>fetch(base+'/api/v1/auth/login',{method:'POST',headers:{
    'Content-Type':'application/json',Origin:'https://gateway-ci.up.railway.app',...headers},body:'{"synthetic":true}',signal:AbortSignal.timeout(5000)});
  assert.equal((await call(web,{})).status,403);
  assert.equal((await call(web,{'X-Kanto-Proxy-Identity':'forged'})).status,403);
  assert.equal((await call(gateway,{})).status,403);
  const r=await call(gateway,{'X-Real-IP':'8.8.8.8','X-Kanto-Proxy-Identity':'forged'});
  assert.equal(r.status,200);assert.deepEqual(await r.json(),{syntheticVerified:true,registrationEnabled:false});
  console.log('RUNTIME_TRANSPORT_SMOKE_OK (synthetic receiver, no registration)');
}else throw new Error('Unknown fixture mode');
