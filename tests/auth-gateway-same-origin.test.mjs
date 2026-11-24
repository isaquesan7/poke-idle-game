import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createAuthGateway} from '../scripts/auth-gateway-candidate.mjs';
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',()=>r('http://127.0.0.1:'+s.address().port)));
const close=s=>new Promise(r=>s.close(r));
test('23E20 same-origin allowlist, token query isolation, session cookies and safe asset caching',async()=>{
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='test';
  const seen=[];
  const upstream=createServer(async(req,res)=>{
    let body='';for await(const c of req)body+=c;
    seen.push({path:req.url,method:req.method,headers:req.headers,body});
    res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'public, max-age=86400',
      'Set-Cookie':'__Host-kanto_session=fake; Path=/; Secure; HttpOnly','X-Internal-Secret':'secret'});
    res.end('synthetic');
  });
  let gateway;
  try{
    const base=await listen(upstream),origin='https://gateway-ci.up.railway.app';
    gateway=createAuthGateway({upstreamOrigin:base,clientOrigin:origin,loopbackTest:true,
      issuer:{sign(){throw Error('Read/logout must not sign');}},resolveTrustedClientIp(){throw Error('Read/logout must not resolve');}});
    const entry=await listen(gateway);
    const cookie='__Host-kanto_session=synthetic';
    for(const path of ['/','/play','/regions','/verify-email?token=fake','/reset-password?token=fake',
      '/assets/game-a1.js','/assets/pokemon-gifs/poke_151.gif']){
      const res=await fetch(entry+path,{headers:{Cookie:cookie,'X-Kanto-Proxy-Identity':'fake'}});
      assert.equal(res.status,200,path);await res.text();
      assert.equal(res.headers.get('set-cookie'),null);assert.equal(res.headers.get('x-internal-secret'),null);
      assert.equal(seen.at(-1).headers.cookie,undefined);
      assert.equal(seen.at(-1).headers['x-kanto-proxy-identity'],undefined);
      assert.equal(seen.at(-1).path,path.split('?')[0]);
      assert.equal(res.headers.get('cache-control'),path.startsWith('/assets/')?'public, max-age=86400':'no-store');
    }
    const head=await fetch(entry+'/play',{method:'HEAD'});assert.equal(head.status,200);
    assert.equal(await head.text(),'');assert.equal(seen.at(-1).method,'HEAD');
    for(const path of ['/api/v1/status','/api/v1/me','/api/v1/save']){
      const res=await fetch(entry+path,{headers:{Cookie:cookie,'X-Kanto-Proxy-Identity':'fake'}});
      assert.equal(res.status,200);await res.text();
      assert.equal(res.headers.get('cache-control'),'no-store');
      assert.equal(res.headers.get('set-cookie'),null);
      assert.equal(seen.at(-1).headers.cookie,path.endsWith('/status')?undefined:cookie);
      assert.equal(seen.at(-1).headers['x-kanto-proxy-identity'],undefined);
    }
    const logout=await fetch(entry+'/api/v1/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie},body:'{}'});
    assert.equal(logout.status,200);await logout.text();assert.match(logout.headers.get('set-cookie'),/HttpOnly/);
    assert.equal(seen.at(-1).headers.cookie,cookie);assert.equal(seen.at(-1).headers.origin,origin);
    assert.equal(seen.at(-1).headers['x-kanto-proxy-identity'],undefined);
    const before=seen.length;
    for(const path of ['/api/v1/admin','/api/v1/adventure/start','/api/v1/me?x=1','/assets/pokemon-gifs/poke_152.gif',
      '/assets/%2fsecret.js','/assets/source.map','/node_modules/secret.js','/index.html']){
      const res=await fetch(entry+path);assert.equal(res.status,404,path);await res.text();
    }
    assert.equal((await fetch(entry+'/play',{method:'POST',body:'{}'})).status,405);
    assert.equal((await fetch(entry+'/api/v1/auth/logout',{method:'POST',headers:{Origin:'https://wrong.example',Cookie:cookie},body:'{}'})).status,400);
    assert.equal(seen.length,before);
  }finally{
    if(gateway)await close(gateway);await close(upstream);
    if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;
  }
});
