import test from 'node:test';
import assert from 'node:assert/strict';
import {observeCrossProject,publicTarget,privateLiteral,observeDirectCrossProject} from '../scripts/run-gateway-cross-project.mjs';

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

const directDns=async name=>{
  assert.equal(name,'gateway-isolation-control.railway.internal');
  return [{address:'10.30.0.1',family:4},{address:'fd00::1',family:6}];
};
const directBlocked={...blocked,reason:'ENETUNREACH'};
const targets=['10.40.0.2','fd00::2'];
function directProbe(cross=directBlocked,calls=[]){
  return async u=>{
    calls.push(u.hostname);
    return ['10.40.0.2','[fd00::2]'].includes(u.hostname)?cross:good;
  };
}
test('direct targets are literals, fixed port, private-only, canonicalized',()=>{
  assert.equal(privateLiteral('fd00:0:0:0:0:0:0:2').url.hostname,'[fd00::2]');
  assert.equal(privateLiteral('172.16.0.1').family,4);
  assert.equal(privateLiteral('192.168.0.1').url.port,'3000');
  for(const value of ['8.8.8.8','127.0.0.1','169.254.169.254','172.32.0.1',
    '100.64.0.1','::1','fe80::1','::ffff:10.1.1.1','fd00::1%eth0','[fd00::1]',
    '10.1.1.1:3000','gateway-isolation-target.railway.internal',' 10.1.1.1'])
    assert.throws(()=>privateLiteral(value));
});
test('direct observations require same-family private controls before and after, no raw addresses',async()=>{
  const calls=[];
  const report=await observeDirectCrossProject({publicUrl:url,token,targetAddresses:targets,
    resolve:directDns,probe:directProbe(directBlocked,calls)});
  assert.deepEqual(calls,[new URL(url).hostname,'10.30.0.1','10.40.0.2','10.30.0.1',
    '[fd00::1]','[fd00::2]','[fd00::1]',new URL(url).hostname]);
  assert.deepEqual(report.observations.map(o=>o.family),[4,6]);
  assert.equal(report.controlsPassed,true);
  assert.equal(report.noDirectAccessObserved,true);
  assert.equal(report.productionTrustGranted,false);
  for(const v of [...targets,'10.30.0.1','fd00::1',token])assert.ok(!JSON.stringify(report).includes(v));
});
test('direct reachable, refused, timed out or invalid controls cannot pass',async()=>{
  for(const cross of [good,{...directBlocked,connected:true},{...blocked,reason:'ECONNREFUSED'},
    {...blocked,reason:'timeout'},{...blocked,reason:'ENOTFOUND'}]){
    const report=await observeDirectCrossProject({publicUrl:url,token,targetAddresses:targets,
      resolve:directDns,probe:directProbe(cross)});
    assert.equal(report.noDirectAccessObserved,false);
  }
  const report=await observeDirectCrossProject({publicUrl:url,token,targetAddresses:targets,
    resolve:directDns,probe:async u=>u.hostname==='[fd00::1]'?blocked:directProbe()(u)});
  assert.equal(report.controlsPassed,false);
  assert.equal(report.noDirectAccessObserved,false);
});
test('missing family, overlap, canonical duplicate and unbounded inventory rejected before HTTP',async()=>{
  for(const targetAddresses of [[],['10.30.0.1'],['fd00::2','fd00:0:0:0:0:0:0:2'],
    ['10.1.1.1','10.1.1.2','10.1.1.3','10.1.1.4','10.1.1.5']]){
    await assert.rejects(observeDirectCrossProject({publicUrl:url,token,targetAddresses,
      resolve:directDns,probe:async()=>assert.fail('unexpected network request')}));
  }
  let requested=false;
  await assert.rejects(observeDirectCrossProject({publicUrl:url,token,targetAddresses:['fd00::2'],
    resolve:async()=>[{address:'10.30.0.1',family:4}],probe:async()=>{requested=true;return good;}}));
  assert.equal(requested,false);
});
