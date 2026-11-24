import test from 'node:test';
import assert from 'node:assert/strict';
import {observePublicGateway,safeObservation} from '../scripts/run-gateway-public-observation.mjs';
const token='a'.repeat(64),url='https://gateway-isolation-target-test.up.railway.app/probe';
const valid={status:200,realIpHeaderCount:1,realIpValid:true,expectedValid:true,
  matchesExpected:true,matchesSocketPeer:false,forwardedHeaderPresent:false,edgeHeaderPresent:true,
  syntheticProofVerified:true,productionTrustGranted:false,upstreamContacted:false};
test('seven cases retain raw duplicate headers and reference family, report no secrets',async()=>{
  for(const [family,expectedIp] of [[4,'192.0.2.10'],[6,'2001:db8::10']]){
    const calls=[];
    const report=await observePublicGateway({url,token,expectedIp,family,
      probe:async(target,headers,f)=>{calls.push(headers);assert.equal(target.host,new URL(url).host);
        assert.equal(f,family);assert.equal(headers[0],'Host');assert.ok(headers.includes(expectedIp));
        return {...valid,unexpected:expectedIp,token};}});
    assert.equal(report.publicGatewayConsistent,true);
    assert.equal(report.referenceFamily,family);assert.equal(calls.length,7);
    assert.equal(calls[3].filter(x=>x==='X-Real-IP').length,2);
    assert.ok(calls[6].includes('X-Railway-Edge'));
    assert.equal(report.productionTrustGranted,false);
    assert.ok(!JSON.stringify(report).includes(expectedIp)&&!JSON.stringify(report).includes(token));
  }
});
test('missing, ambiguous, forged, expired, or unavailable results fail closed',async()=>{
  for(const partial of [{realIpHeaderCount:2},{matchesExpected:false},{syntheticProofVerified:false},
    {matchesSocketPeer:true},{productionTrustGranted:true},{upstreamContacted:true},
    {expectedValid:false},{realIpValid:false},{status:410},{status:null,error:'network-error'},
    {syntheticProofVerified:undefined}]){
    const report=await observePublicGateway({url,token,expectedIp:'192.0.2.10',family:4,
      probe:async()=>({...valid,...partial})});
    assert.equal(report.publicGatewayConsistent,false);
  }
});
test('rejects production target, mismatched family and mapped IP before traffic',async()=>{
  for(const args of [{url:'https://kanto-idle-web-production.up.railway.app/probe'},
    {family:6},{expectedIp:'::ffff:192.0.2.10',family:6},{token:'bad'},
    {expectedIp:'fe80::1%eth0',family:6},{url:url+'?x=1'}]){
    await assert.rejects(observePublicGateway({url,token,expectedIp:'192.0.2.10',family:4,
      probe:async()=>assert.fail('unexpected request'),...args}));
  }
});
test('response sanitization never returns arbitrary body content',()=>{
  assert.deepEqual(safeObservation(404,'secret'),{status:404});
  assert.throws(()=>safeObservation(200,'{}'));
  assert.ok(!('unexpected' in safeObservation(200,JSON.stringify({...valid,unexpected:'secret'}))));
});
