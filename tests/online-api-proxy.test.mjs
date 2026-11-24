import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {spawn} from 'node:child_process';

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
      cookie:req.headers.cookie,body:raw,forwarded:req.headers['x-forwarded-for']??null}));
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
        'X-Forwarded-For':'attacker'},body:'{"email":"abc"}'
    });
    assert.equal(r.status,200);
    const body=await r.json();
    assert.equal(body.path,'/api/v1/auth/login');
    assert.equal(body.method,'POST');
    assert.equal(body.origin,'https://example.test');
    assert.equal(body.cookie,'__Host-kanto_session=token');
    assert.equal(body.forwarded,null);
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

test('23E9: untrusted headers, wrong methods and incomplete/oversized bodies never reach writers',async()=>{
  const received=[];
  const backend=createServer(async(req,res)=>{
    let body='';
    for await(const chunk of req)body+=chunk;
    received.push({path:req.url,headers:req.headers,body});
    res.writeHead(429,{'Content-Type':'application/json','Retry-After':'900',
      'X-Internal-Secret':'not-for-browser','Connection':'close, x-frame-options',
      'X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'});
    res.end('{"error":"quota"}');
  });
  const backendPort=await listen(backend);
  const reservation=createServer();
  const port=await listen(reservation);await close(reservation);
  const child=spawn(process.execPath,['server.mjs'],{
    cwd:process.cwd(),env:{...process.env,PORT:String(port),
      ONLINE_API_INTERNAL_URL:'http://127.0.0.1:'+backendPort+'/'},stdio:'ignore'});
  const base='http://127.0.0.1:'+port;
  const login=base+'/api/v1/auth/login';
  try{
    await ready(port);received.length=0;
    assert.equal((await fetch(login)).status,405);
    assert.equal((await fetch(base+'/api/v1/status',{method:'POST',body:'{}'})).status,405);
    assert.equal((await fetch(login,{method:'POST',body:'x'.repeat(16385)})).status,413);
    const chunked=await new Promise((resolve,reject)=>{
      const req=request(login,{method:'POST',headers:{'Content-Type':'application/json'}},res=>{
        res.resume();res.on('end',()=>resolve(res.statusCode));
      });
      req.on('error',reject);
      req.write('a'.repeat(8192));req.write('b'.repeat(8193));req.end();
    });
    assert.equal(chunked,413);
    assert.equal(received.length,0,'rejected requests never reach the backend');
    const r=await fetch(login,{method:'POST',headers:{
      'Content-Type':'application/json','Origin':'https://example.test',
      'Cookie':'__Host-kanto_session=test','X-Real-IP':'203.0.113.1',
      'Forwarded':'for=203.0.113.2','X-Kanto-Client-IP':'203.0.113.3',
      'Authorization':'Bearer fake','X-Railway-Edge':'fake',
      'X-Internal-Secret':'fake'
    },body:'{}'});
    assert.equal(r.status,429);await r.text();
    assert.equal(r.headers.get('retry-after'),'900');
    assert.equal(r.headers.get('x-internal-secret'),null);
    assert.equal(r.headers.get('x-frame-options'),'DENY');
    assert.equal(r.headers.get('referrer-policy'),'no-referrer');
    assert.equal(received.length,1);
    const h=received[0].headers;
    for(const name of ['x-real-ip','forwarded','x-kanto-client-ip','authorization',
      'x-railway-edge','x-internal-secret'])assert.equal(h[name],undefined,name);
    assert.equal(h.origin,'https://example.test');
    assert.equal(h.cookie,'__Host-kanto_session=test');
    assert.equal(h['content-length'],'2');
    assert.equal(received[0].body,'{}');
    const nominated=await new Promise((resolve,reject)=>{
      const req=request(login,{method:'POST',headers:{
        'Content-Type':'application/json','Cookie':'untrusted',
        'Connection':'close, cookie','Content-Length':'2'
      }},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
      req.on('error',reject);req.end('{}');
    });
    assert.equal(nominated,429);
    assert.equal(received[1].headers.cookie,undefined);
  }finally{child.kill();await close(backend);}
});
