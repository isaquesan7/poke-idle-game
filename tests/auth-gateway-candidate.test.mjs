import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {createAuthGateway} from '../scripts/auth-gateway-candidate.mjs';
import {createProxyIssuer,createProxyReceiver} from '../services/api/src/proxyKeyring.mjs';

const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve(s.address().port)));
const close=s=>new Promise(resolve=>s.close(resolve));
test('isolated issuer -> web transport -> receiver: forged direct headers cannot generate proof',async()=>{
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='test';
  const issuer=createProxyIssuer({activeHex:'11'.repeat(32),subjectHex:'22'.repeat(32)});
  const receiver=createProxyReceiver({activeHex:'11'.repeat(32)});
  const received=[],seen=new Set(),path='/api/v1/auth/login',body='{"email":"synthetic@example.test"}';
  const origin='https://test-gateway.up.railway.app';
  const api=createServer(async(req,res)=>{
    const chunks=[];for await(const c of req)chunks.push(c);
    const raw=Buffer.concat(chunks);
    const verified=receiver.verify({assertion:req.headers['x-kanto-proxy-identity'],
      method:req.method,path:req.url,body:raw});
    received.push({verified:!!verified,subject:verified?.subject,headers:req.headers});
    // In-memory replay stub, real distributed nonce consumption covered by PG18 #256.
    const allowed=verified&&!seen.has(verified.nonce);
    if(allowed)seen.add(verified.nonce);
    res.writeHead(allowed?200:403,{'Content-Type':'application/json','X-Internal-Secret':'synthetic',
      ...(allowed?{'Set-Cookie':'__Host-kanto_session=test; Path=/; Secure; HttpOnly; SameSite=Lax'}:{})});
    res.end('{}');
  });
  let child,gateway;await listen(api);
  try{
    const reservation=createServer(),webPort=await listen(reservation);await close(reservation);
    const base='http://127.0.0.1:'+webPort;
    child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(webPort),
      ONLINE_API_INTERNAL_URL:'http://127.0.0.1:'+api.address().port+'/',
      ONLINE_GATEWAY_FORWARD_TEST_ONLY:'true',NODE_ENV:'test'},stdio:'ignore'});
    let ready=false;
    for(let i=0;i<100;i++){try{await fetch(base+'/api/v1/status');ready=true;break;}catch{}
      if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,100));}
    assert.ok(ready);received.length=0;
    gateway=createAuthGateway({upstreamOrigin:base,clientOrigin:origin,issuer,loopbackTest:true,
      // This callback is a CI fixture, NOT a Railway trust policy.
      resolveTrustedClientIp:()=> '192.0.2.10'});
    const gatewayPort=await listen(gateway),entry='http://127.0.0.1:'+gatewayPort;
    const post=(url,headers={},payload=body)=>fetch(url+path,{method:'POST',headers:{
      Origin:origin,'Content-Type':'application/json',...headers},body:payload});
    assert.equal((await post(base,{'X-Real-IP':'192.0.2.10','X-Railway-Edge':'fake'})).status,403);
    assert.equal(received.length,0);
    assert.equal((await post(base,{'X-Kanto-Proxy-Identity':'forged'})).status,403);
    assert.equal(received.at(-1).verified,false);
    const legitimate=await post(entry,{'X-Kanto-Proxy-Identity':'attacker','X-Real-IP':'198.51.100.7','X-Railway-Edge':'fake'});
    assert.equal(legitimate.status,200);
    assert.match(legitimate.headers.get('set-cookie'),/HttpOnly/);
    assert.equal(legitimate.headers.get('x-internal-secret'),null);
    const saved=received.at(-1);
    assert.equal(saved.verified,true);
    assert.notEqual(saved.headers['x-kanto-proxy-identity'],'attacker');
    assert.equal(saved.headers['x-real-ip'],undefined);
    assert.equal(saved.headers['x-railway-edge'],undefined);
    assert.equal((await post(entry,{'X-Real-IP':'203.0.113.8'})).status,200);
    assert.equal(received.at(-1).subject,saved.subject);
    assert.equal((await post(base,{'X-Kanto-Proxy-Identity':saved.headers['x-kanto-proxy-identity']})).status,403);
    assert.equal((await post(base,{'X-Kanto-Proxy-Identity':saved.headers['x-kanto-proxy-identity']},'{}')).status,403);
    const before=received.length;
    assert.equal((await post(entry,{Origin:'https://attacker.example'})).status,400);
    assert.equal((await post(entry,{},'x'.repeat(16385))).status,413);
    assert.equal((await fetch(entry+path+'?x=1',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body})).status,404);
    assert.equal(received.length,before);
  }finally{
    if(gateway)await close(gateway);
    if(child&&child.exitCode===null&&child.signalCode===null){const exit=once(child,'exit');child.kill();await exit;}
    await close(api);
    if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;
  }
});
