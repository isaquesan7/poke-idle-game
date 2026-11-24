import test from 'node:test';
import assert from 'node:assert/strict';
import {observeCrossProject,publicTarget} from '../scripts/run-gateway-cross-project.mjs';

const url='https://gateway-isolation-target-test.up.railway.app/probe',token='a'.repeat(64);
const dns=async name=>{
  if(name==='gateway-isolation-control.railway.internal')return [{address:'fd00::1',family:6}];
  throw Object.assign(Error('synthetic'),{code:'ENOTFOUND'});
};
const good={connected:true,status:200,validObservation:true,forgedMatched:true,reason:'http-response'};
const blocked={connected:false,status:null,validObservation:false,reason:'ENOTFOUND'};
test('positive controls before/after and private DNS/HTTP failure required',async()=>{
  const calls=[];
  const report=await observeCrossProject({publicUrl:url,token,resolve:dns,
    probe:async u=>{calls.push(u.hostname);return u.hostname==='gateway-isolation-target.railway.internal'?blocked:good;}});
  assert.equal(report.controlsPassed,true);
  assert.equal(report.noCrossAccessObserved,true);
  assert.equal(report.productionTrustGranted,false);
  assert.equal(calls.length,4);
  assert.ok(!JSON.stringify(report).includes('fd00::1')&&!JSON.stringify(report).includes(token));
});
test('reachable or inconclusive private target never passes',async()=>{
  for(const result of [good,{...blocked,connected:true},{...blocked,reason:'timeout'}]){
    const report=await observeCrossProject({publicUrl:url,token,resolve:dns,
      probe:async u=>u.hostname==='gateway-isolation-target.railway.internal'?result:good});
    assert.equal(report.noCrossAccessObserved,false);
  }
  const resolved=await observeCrossProject({publicUrl:url,token,resolve:async()=>[{address:'fd00::2',family:6}],
    probe:async u=>u.hostname==='gateway-isolation-target.railway.internal'?blocked:good});
  assert.equal(resolved.noCrossAccessObserved,false);
  const failure=await observeCrossProject({publicUrl:url,token,resolve:dns,probe:async()=>blocked});
  assert.equal(failure.controlsPassed,false);assert.equal(failure.noCrossAccessObserved,false);
});
test('only explicitly named disposable public domain accepted',()=>{
  assert.equal(publicTarget(url).pathname,'/probe');
  for(const bad of ['https://kanto-idle-web-production.up.railway.app/probe',
    'https://gateway-isolation-target-test.up.railway.app.evil.example/probe',
    'http://gateway-isolation-target.up.railway.app/probe',url+'?token=x',
    'https://x@gateway-isolation-target.up.railway.app/probe'])
    assert.throws(()=>publicTarget(bad));
});
