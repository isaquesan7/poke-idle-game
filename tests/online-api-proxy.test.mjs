import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {requesterIp,rateDigest} from '../services/api/src/authSecurity.mjs';

const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const close=server=>new Promise(resolve=>server.close(resolve));
async function ready(port){
  for(let i=0;i<60;i++){
    try{const r=await fetch('http://127.0.0.1:'+port+'/api/v1/status');return r;}
    catch{await new Promise(resolve=>setTimeout(resolve,100));}
  }
  throw new Error('Web server did not start');
}
test('ONLINE-01C-4 private proxy is allowlisted, disabled by default and preserves cookie/origin',async()=>{
  const backend=createServer(async(req,res)=>{
    let raw='';
    for await(const chunk of req)raw+=chunk;
    res.writeHead(200,{'Content-Type':'application/json',
      'Set-Cookie':'__Host-kanto_session=test; Path=/; HttpOnly; Secure; SameSite=Lax'});
    res.end(JSON.stringify({path:req.url,method:req.method,origin:req.headers.origin,
      cookie:req.headers.cookie,body:raw,forwarded:req.headers['x-forwarded-for']??null,
      standardForwarded:req.headers.forwarded??null,
      subject:requesterIp(req),quota:rateDigest('login-ip',requesterIp(req),'synthetic-test-secret-not-for-production-123').toString('hex')}));
  });
  const backendPort=await listen(backend);
  const reservation=createServer();
  const webPort=await listen(reservation);
  await close(reservation);
  const child=spawn(process.execPath,['server.mjs'],{
    cwd:process.cwd(),env:{...process.env,PORT:String(webPort),
      ONLINE_API_INTERNAL_URL:'http://127.0.0.1:'+backendPort+'/'},
    stdio:'ignore'
  });
  try{
    const base='http://127.0.0.1:'+webPort;
    await ready(webPort);
    const r=await fetch(base+'/api/v1/auth/login',{
      method:'POST',headers:{'Content-Type':'application/json',
        Origin:'https://example.test',Cookie:'__Host-kanto_session=token',
        'X-Forwarded-For':'198.51.100.7','Forwarded':'for=198.51.100.7',
        'X-Real-IP':'198.51.100.8'},body:'{"email":"abc"}'
    });
    assert.equal(r.status,200);
    const body=await r.json();
    assert.equal(body.path,'/api/v1/auth/login');
    assert.equal(body.method,'POST');
    assert.equal(body.origin,'https://example.test');
    assert.equal(body.cookie,'__Host-kanto_session=token');
    assert.equal(body.forwarded,null);
    assert.equal(body.standardForwarded,null);
    assert.equal(body.subject,'127.0.0.1');
    const second=await fetch(base+'/api/v1/auth/login',{
      method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.test',
        'X-Forwarded-For':'203.0.113.9','Forwarded':'for=203.0.113.9',
        'X-Real-IP':'203.0.113.10'},body:'{"email":"other"}'
    });
    const secondBody=await second.json();
    assert.equal(second.status,200);
    assert.equal(secondBody.forwarded,null);
    assert.equal(secondBody.standardForwarded,null);
    // A trusted reverse proxy identity protocol is NOT implemented yet:
    // distinct claimed IPs cannot evade a shared peer quota.
    assert.equal(secondBody.subject,body.subject);
    assert.equal(secondBody.quota,body.quota);
    assert.equal(body.body,'{"email":"abc"}');
    assert.match(r.headers.get('set-cookie'),/HttpOnly/);
    assert.equal((await fetch(base+'/api/v1/admin')).status,404);
    assert.equal((await fetch(base+'/api/v1/status',{method:'DELETE'})).status,405);
  }finally{child.kill();await close(backend);}
});

test('proxy defaults closed with no upstream; blocks unknown paths and oversized payloads',async()=>{
  const reservation=createServer();
  const port=await listen(reservation);
  await close(reservation);
  const env={...process.env,PORT:String(port)};
  delete env.ONLINE_API_INTERNAL_URL;
  const child=spawn(process.execPath,['server.mjs'],{
    cwd:process.cwd(),env,stdio:'ignore'
  });
  try{
    const base='http://127.0.0.1:'+port;
    const response=await ready(port);
    assert.equal(response.status,503);
    assert.equal((await response.json()).error,'Contas online em preparação');
    assert.equal((await fetch(base+'/api/v1/unknown')).status,404);
    const big=await fetch(base+'/api/v1/auth/login',{method:'POST',
      headers:{'Content-Type':'application/json'},body:'x'.repeat(16385)});
    assert.equal(big.status,503);
  }finally{child.kill();}
});
