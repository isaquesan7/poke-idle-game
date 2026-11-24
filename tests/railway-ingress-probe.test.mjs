import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {observeIngress,createIngressProbe} from '../scripts/railway-ingress-probe.mjs';

test('probe reports only boolean comparisons, rejects duplicate and invalid IP values',()=>{
  const expected='192.0.2.1',peer='10.0.0.1';
  const good=observeIngress(['X-Real-IP','::ffff:192.0.2.1','X-Kanto-Probe-Expected',expected],peer);
  assert.equal(good.matchesExpected,true);
  assert.equal(good.matchesSocketPeer,false);
  assert.equal(JSON.stringify(good).includes(expected),false);
  for(const h of [
    ['X-Real-IP',expected,'x-real-ip','192.0.2.2'],
    ['X-Real-IP',expected+', 192.0.2.2'],
    ['X-Real-IP','fe80::1%eth0'],
    []
  ]){
    const result=observeIngress([...h,'X-Kanto-Probe-Expected',expected],peer);
    assert.equal(result.realIpValid,false);assert.equal(result.matchesExpected,false);
  }
  assert.equal(observeIngress(['X-Real-IP',expected,'X-Kanto-Probe-Expected','192.0.2.2'],peer).matchesExpected,false);
});
test('standalone probe authenticates, limits, expires and never echoes headers',async()=>{
  let now=0;const token='a'.repeat(64);
  const server=createIngressProbe({token,now:()=>now,lifetimeMs:100,maxRequests:2});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  const headers={Authorization:'Bearer '+token,'X-Real-IP':'192.0.2.1','X-Kanto-Probe-Expected':'192.0.2.1'};
  try{
    assert.equal((await fetch(base+'/probe')).status,404);
    assert.equal((await fetch(base+'/wrong',{headers})).status,404);
    const response=await fetch(base+'/probe',{headers});
    assert.equal(response.status,200);const raw=await response.text();
    assert.equal(JSON.parse(raw).matchesExpected,true);
    assert.ok(!raw.includes(token)&&!raw.includes('192.0.2.1'));
    assert.equal(response.headers.get('cache-control'),'no-store');
    now=100;assert.equal((await fetch(base+'/probe',{headers})).status,410);
  }finally{server.close();await once(server,'close');}
});
test('request cap applies even before expiry',async()=>{
  const token='b'.repeat(64);
  const server=createIngressProbe({token,maxRequests:1});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const url='http://127.0.0.1:'+server.address().port+'/probe',headers={Authorization:'Bearer '+token};
    assert.equal((await fetch(url,{headers})).status,200);
    assert.equal((await fetch(url,{headers})).status,410);
  }finally{server.close();await once(server,'close');}
});
