import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createIngressProbe} from '../scripts/railway-ingress-probe.mjs';
import {runPrivateProbe,validatePrivateProbeTarget} from '../scripts/run-private-ingress-probe.mjs';

test('private client accepts only exact isolated internal destination',()=>{
  assert.equal(validatePrivateProbeTarget('http://ingress-target.railway.internal:3000/probe').hostname,'ingress-target.railway.internal');
  for(const value of ['http://kanto-idle-api.railway.internal:3000/probe','https://ingress-target.railway.internal:3000/probe',
    'http://ingress-target.railway.internal:3000/probe?x=1','http://user@ingress-target.railway.internal:3000/probe',
    'http://ingress-target.railway.internal:3001/probe'])
    assert.throws(()=>validatePrivateProbeTarget(value));
});
test('direct HTTP proves a fake IP and edge label can reach a listener',async()=>{
  const token='a'.repeat(64);
  const server=createIngressProbe({token});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const report=await runPrivateProbe({target:new URL('http://127.0.0.1:'+server.address().port+'/probe'),token});
    assert.equal(report.allObserved,true);
    assert.equal(report.forgedHeaderReachedTarget,true);
    assert.equal(report.results[0].matchesExpected,false);
    assert.equal(report.results[1].matchesExpected,true);
    assert.equal(report.results[2].edgeHeaderPresent,true);
    assert.equal(report.results[2].matchesExpected,true);
    assert.equal(report.results[3].realIpHeaderCount,2);
    assert.equal(report.results[3].realIpValid,false);
    const raw=JSON.stringify(report);
    assert.ok(!raw.includes(token)&&!raw.includes('192.0.2.123')&&!raw.includes('127.0.0.1'));
  }finally{server.close();await once(server,'close');}
});
