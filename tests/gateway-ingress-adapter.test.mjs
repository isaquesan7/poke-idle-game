import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {createIngressResolver,createReviewedAuthGateway} from '../scripts/gateway-ingress-adapter.mjs';
import {createProxyReceiver} from '../services/api/src/proxyKeyring.mjs';

const reviewedTopology={projectId:'11111111-1111-4111-8111-111111111111',
  environmentId:'22222222-2222-4222-8222-222222222222',
  serviceId:'33333333-3333-4333-8333-333333333333',
  commitSha:'a'.repeat(40),publicDomain:'gateway-ci.up.railway.app',
  serviceCount:1,replicaCount:1,tcpProxyCount:0,publicDomainCount:1,
  privateCallersExcluded:true,changeControlReviewed:true,reviewReference:'CI synthetic topology'};
const testRuntime={RAILWAY_PROJECT_ID:reviewedTopology.projectId,
  RAILWAY_ENVIRONMENT_ID:reviewedTopology.environmentId,RAILWAY_SERVICE_ID:reviewedTopology.serviceId,
  RAILWAY_GIT_COMMIT_SHA:reviewedTopology.commitSha,RAILWAY_PUBLIC_DOMAIN:reviewedTopology.publicDomain};
const req=(peer,rawHeaders)=>({socket:{remoteAddress:peer},rawHeaders});
function withTestMode(fn){
  const old=process.env.NODE_ENV;process.env.NODE_ENV='test';
  try{return fn();}finally{if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old;}
}
test('reviewed isolated ingress accepts changing peers, rejects ambiguous IP',()=>withTestMode(()=>{
  const resolve=createIngressResolver({review:reviewedTopology,testRuntime,loopbackTest:true});
  for(const peer of ['10.42.0.9','10.42.0.8','fd00::9','100.64.1.2'])
    assert.equal(resolve(req(peer,['X-Real-IP','8.8.8.8','X-Railway-Edge','ignored'])),'8.8.8.8');
  assert.equal(resolve(req('fd00::9',['X-Real-IP','2606:4700:0:0::1'])),'2606:4700::1');
  for(const [peer,headers] of [
    ['unknown',['X-Real-IP','8.8.8.8']],['::',['X-Real-IP','8.8.8.8']],
    ['8.8.8.8',['X-Real-IP','8.8.8.8']],
    ['10.42.0.9',['X-Forwarded-For','8.8.8.8']],
    ['10.42.0.9',['X-Real-IP','8.8.8.8','x-real-ip','1.1.1.1']],
    ['10.42.0.9',['X-Real-IP','8.8.8.8, 1.1.1.1']],
    ['10.42.0.9',['X-Real-IP','8.8.8.8','Connection','keep-alive, X-Real-IP']],
    ...['10.42.0.8','::ffff:127.0.0.1','100.64.1.2','2001:db8::1','fe80::1%eth0','3fff::1','224.0.0.1']
      .map(ip=>['10.42.0.9',['X-Real-IP',ip]])
  ])assert.equal(resolve(req(peer,headers)),null);
  // This explicitly documents residual risk: an arbitrary reachable private
  // peer can forge a header. Isolation, not this parser, excludes that path.
  assert.equal(resolve(req('10.42.0.7',['X-Real-IP','1.1.1.1'])),'1.1.1.1');
}));
test('fail closed on topology, revision or identity mismatch',()=>withTestMode(()=>{
  for(const patch of [{serviceCount:2},{replicaCount:2},{tcpProxyCount:1},{publicDomainCount:2},
    {privateCallersExcluded:false},{changeControlReviewed:false},{reviewReference:''},
    {publicDomain:'example.com'},{commitSha:'HEAD'},{trustedPeers:['*']}])
    assert.throws(()=>createIngressResolver({review:{...reviewedTopology,...patch},testRuntime,loopbackTest:true}));
  for(const k of Object.keys(testRuntime))
    assert.throws(()=>createIngressResolver({review:reviewedTopology,testRuntime:{...testRuntime,[k]:'different'},loopbackTest:true}));
  assert.throws(()=>createIngressResolver({review:reviewedTopology,testRuntime}));
  assert.throws(()=>createIngressResolver({}));
}));
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
      ingressConfig:{review:reviewedTopology,testRuntime},loopbackTest:true});
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
