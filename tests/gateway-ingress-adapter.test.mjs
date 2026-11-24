import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {createIngressResolver,createReviewedAuthGateway} from '../scripts/gateway-ingress-adapter.mjs';
import {createProxyReceiver} from '../services/api/src/proxyKeyring.mjs';

const approved={trustedPeers:['10.42.0.9','fd00::9'],topologyReviewed:true};
const resolve=createIngressResolver(approved);
const req=(peer,rawHeaders)=>({socket:{remoteAddress:peer},rawHeaders});
test('exact reviewed peer and single public-candidate IP required',()=>{
  assert.equal(resolve(req('::ffff:10.42.0.9',['X-Real-IP','8.8.8.8','X-Railway-Edge','ignored'])),'8.8.8.8');
  assert.equal(resolve(req('fd00::9',['X-Real-IP','2606:4700:0:0::1'])),'2606:4700::1');
  for(const [peer,headers] of [
    ['10.42.0.8',['X-Real-IP','8.8.8.8','X-Railway-Edge','fake']],
    ['10.42.0.9',['X-Forwarded-For','8.8.8.8']],
    ['10.42.0.9',['X-Real-IP','8.8.8.8','x-real-ip','1.1.1.1']],
    ['10.42.0.9',['X-Real-IP','8.8.8.8, 1.1.1.1']],
    ['10.42.0.9',['X-Real-IP','8.8.8.8','Connection','keep-alive, X-Real-IP']],
    ['10.42.0.9',['X-Real-IP','10.42.0.8']],
    ['10.42.0.9',['X-Real-IP','::ffff:127.0.0.1']],
    ['10.42.0.9',['X-Real-IP','100.64.1.2']],
    ['10.42.0.9',['X-Real-IP','2001:db8::1']],
    ['10.42.0.9',['X-Real-IP','fe80::1%eth0']],
    ['10.42.0.9',['X-Real-IP','3fff::1']],
    ['10.42.0.9',['X-Real-IP','224.0.0.1']]
  ])assert.equal(resolve(req(peer,headers)),null);
  // X-Real-IP remains forgeable from the allowed peer itself: no claim of
  // cryptographic origin authentication. The reviewed network is a prerequisite.
  assert.equal(resolve(req('10.42.0.9',['X-Real-IP','1.1.1.1'])),'1.1.1.1');
});
test('reject unreviewed, wildcard, CIDR and malformed peers',()=>{
  for(const config of [{},{...approved,topologyReviewed:false},{...approved,trustedPeers:[]},
    {...approved,trustedPeers:['10.42.0.0/16']},{...approved,trustedPeers:['*']},
    {...approved,trustedPeers:['10.42.0.9','::ffff:10.42.0.9']},
    {...approved,trustedPeers:['127.0.0.1']},{...approved,trustedPeers:['::']}])
    assert.throws(()=>createIngressResolver(config));
});
const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve(s.address().port)));
const close=s=>new Promise(resolve=>s.close(resolve));
test('actual candidate uses adapter before signing; no upstream on rejected headers',async()=>{
  const old=process.env.NODE_ENV;process.env.NODE_ENV='test';
  const key='11'.repeat(32),subject='22'.repeat(32),seen=[];
  const receiver=createProxyReceiver({activeHex:key});
  const upstream=createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    seen.push({proof:receiver.verify({assertion:req.headers['x-kanto-proxy-identity'],
      method:req.method,path:req.url,body:Buffer.concat(chunks)}),headers:req.headers});
    res.writeHead(200,{'Content-Type':'application/json'});res.end('{}');
  });
  let gateway;
  try{
    const upstreamPort=await listen(upstream),origin='https://gateway-ci.up.railway.app';
    gateway=createReviewedAuthGateway({upstreamOrigin:'http://127.0.0.1:'+upstreamPort,clientOrigin:origin,
      issuerConfig:{activeHex:key,subjectHex:subject,subjectPolicy:'ipv6-prefix64-v2'},
      ingressConfig:{trustedPeers:['127.0.0.1'],topologyReviewed:true},loopbackTest:true});
    const port=await listen(gateway),body='{}';
    const post=extra=>new Promise((resolve,reject)=>{
      const r=request({host:'127.0.0.1',port,path:'/api/v1/auth/login',method:'POST',
        headers:['Host','127.0.0.1:'+port,'Origin',origin,'Content-Type','application/json',
          'Content-Length','2',...extra]},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
      r.on('error',reject);r.end(body);
    });
    for(const h of [[],['X-Real-IP','10.0.0.1'],['X-Real-IP','8.8.8.8','X-Real-IP','1.1.1.1'],
      ['X-Real-IP','8.8.8.8','Connection','X-Real-IP']])assert.equal(await post(h),403);
    assert.equal(seen.length,0);
    assert.equal(await post(['X-Real-IP','2606:4700:1:2::1','X-Kanto-Proxy-Identity','forged']),200);
    assert.equal(await post(['X-Real-IP','2606:4700:1:2::2']),200);
    assert.equal(seen.length,2);assert.ok(seen[0].proof);assert.ok(seen[1].proof);
    assert.equal(seen[0].proof.subject,seen[1].proof.subject);
    assert.equal(seen[0].headers['x-real-ip'],undefined);
    assert.notEqual(seen[0].headers['x-kanto-proxy-identity'],'forged');
  }finally{
    if(gateway?.listening)await close(gateway);
    if(upstream.listening)await close(upstream);
    if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old;
  }
});
