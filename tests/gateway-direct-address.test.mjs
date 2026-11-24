import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createGatewayObservation} from '../scripts/gateway-ingress-observation.mjs';
import {privateAddress,issueAddressManifest,readAddressManifest,observeDirectAddresses} from '../scripts/gateway-direct-address.mjs';
const token='a'.repeat(64),now=()=>1700000000000;
const target=[{address:'10.23.1.10',family:4},{address:'fd00::10',family:6}];
const control=[{address:'10.23.2.10',family:4},{address:'fd00::20',family:6}];
const manifest=(role,records)=>issueAddressManifest({role,token,now,resolve:async()=>records});
test('manifest is encrypted, role-bound, fresh, and private-only',async()=>{
  const m=await manifest('target',target),raw=JSON.stringify(m);
  assert.ok(!raw.includes(target[0].address)&&!raw.includes(target[1].address)&&!raw.includes(token));
  assert.deepEqual(readAddressManifest({role:'target',token,manifest:m,now}),target);
  for(const bad of ['127.0.0.1','169.254.169.254','8.8.8.8','::1','::ffff:10.0.0.1','2001:db8::1','fe80::1%eth0'])
    assert.equal(privateAddress(bad),null,bad);
  assert.throws(()=>readAddressManifest({role:'control',token,manifest:m,now}));
  assert.throws(()=>readAddressManifest({role:'target',token:'b'.repeat(64),manifest:m,now}));
  assert.throws(()=>readAddressManifest({role:'target',token,manifest:m,now:()=>now()+16000}));
  assert.throws(()=>readAddressManifest({role:'target',token,manifest:{...m,tag:'A'.repeat(22)},now}));
  await assert.rejects(()=>manifest('target',[{address:'8.8.8.8',family:4}]));
});
test('direct observation needs stable inventories and same-family positive controls',async()=>{
  const getManifest=role=>manifest(role,role==='target'?target:control);
  const connector=record=>control.some(x=>x.address===record.address)?'connected':'ENETUNREACH';
  const r=await observeDirectAddresses({token,now,getManifest,connect:connector});
  assert.equal(r.controlsPassed,true);assert.equal(r.noDirectAccessObserved,true);assert.equal(r.productionTrustGranted,false);
  assert.ok(!JSON.stringify(r).includes(target[0].address));
  for(const reason of ['connected','ECONNREFUSED','other']){
    const bad=await observeDirectAddresses({token,now,getManifest,connect:record=>
      control.some(x=>x.address===record.address)?'connected':reason});
    assert.equal(bad.noDirectAccessObserved,false);
  }
  const missing=await observeDirectAddresses({token,now,connect:connector,
    getManifest:role=>manifest(role,role==='target'?target:[control[0]])});
  assert.equal(missing.noDirectAccessObserved,false);
  const overlap=await observeDirectAddresses({token,now,connect:()=>{throw Error('must not connect');},
    getManifest:role=>manifest(role,target)});
  assert.equal(overlap.overlap,true);assert.equal(overlap.noDirectAccessObserved,false);
  let reads=0;
  const changing=await observeDirectAddresses({token,now,connect:connector,getManifest:role=>
    manifest(role,role==='control'?control:(reads++?target.slice(0,1):target))});
  assert.equal(changing.stable,false);assert.equal(changing.noDirectAccessObserved,false);
});
test('manifest endpoint is explicit, authenticated, bounded, and never plaintext',async()=>{
  const server=createGatewayObservation({token,addressRole:'target',resolveAddress:async()=>target,now,maxRequests:1});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const url='http://127.0.0.1:'+server.address().port+'/probe-address';
  try{
    assert.equal((await fetch(url)).status,404);
    const r=await fetch(url,{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);
    const raw=await r.text();assert.ok(!raw.includes(target[0].address)&&!raw.includes(target[1].address));
    assert.deepEqual(readAddressManifest({role:'target',token,manifest:JSON.parse(raw),now}),target);
    assert.equal((await fetch(url,{headers:{Authorization:'Bearer '+token}})).status,410);
  }finally{server.close();await once(server,'close');}
});
