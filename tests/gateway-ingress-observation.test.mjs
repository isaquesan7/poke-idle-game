import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request} from 'node:http';
import {createGatewayObservation} from '../scripts/gateway-ingress-observation.mjs';

test('23E21: observation never returns a proof or grants production trust',async()=>{
  const token='b'.repeat(64);let now=1700000000000;
  const server=createGatewayObservation({token,now:()=>now,maxRequests:5,lifetimeMs:1000});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=new URL('http://127.0.0.1:'+server.address().port+'/probe');
  const call=(headers,authorized=true)=>new Promise((resolve,reject)=>{
    const req=request(url,{headers:['Host',url.host,...(authorized?['Authorization','Bearer '+token]:[]),...headers]},res=>{
      let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,text,body:JSON.parse(text)}));
    });req.on('error',reject);req.end();
  });
  try{
    assert.equal((await call([],false)).status,404);
    const baseline=await call([]);assert.equal(baseline.body.syntheticProofVerified,false);
    const forged=await call(['X-Real-IP','192.0.2.10','X-Kanto-Probe-Expected','192.0.2.10','X-Railway-Edge','fake']);
    assert.equal(forged.body.syntheticProofVerified,true);
    assert.equal(forged.body.matchesExpected,true);
    assert.equal(forged.body.productionTrustGranted,false);assert.equal(forged.body.upstreamContacted,false);
    assert.ok(!forged.text.includes('192.0.2.10')&&!forged.text.includes(token));
    assert.ok(!Object.hasOwn(forged.body,'assertion')&&!Object.hasOwn(forged.body,'subject'));
    const duplicate=await call(['X-Real-IP','192.0.2.10','X-Real-IP','192.0.2.11']);
    assert.equal(duplicate.body.syntheticProofVerified,false);
    const nominated=await call(['X-Real-IP','192.0.2.10','Connection','close, x-real-ip']);
    assert.equal(nominated.body.syntheticProofVerified,false);
    const invalid=await call(['X-Real-IP','not-ip']);assert.equal(invalid.body.syntheticProofVerified,false);
    assert.equal((await call([])).status,410);
    now+=1001;assert.equal((await call([])).status,410);
  }finally{server.close();await once(server,'close');}
});
