import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanExpiredProxyNonces} from '../src/proxyNonceMaintenance.mjs';

test('maintenance stops on partial batch and exposes only aggregate counts',async()=>{
  let calls=0;
  const pool={query:async(sql,params)=>{
    assert.match(sql,/FOR UPDATE SKIP LOCKED/);
    assert.deepEqual(params,[3]);
    return {rowCount:[3,1][calls++]};
  }};
  assert.deepEqual(await cleanExpiredProxyNonces(pool,{batchSize:3,maxBatches:5}),
    {removed:4,batches:2,mayHaveBacklog:false});
});
test('maintenance has a hard batch budget even when full',async()=>{
  let calls=0;
  const pool={query:async()=>{calls++;return {rowCount:500};}};
  assert.deepEqual(await cleanExpiredProxyNonces(pool),{removed:5000,batches:10,mayHaveBacklog:true});
  assert.equal(calls,10);
});
test('invalid configuration and DB failure do not look like success',async()=>{
  const pool={query:async()=>{throw new Error('unavailable');}};
  for(const options of [{batchSize:0},{batchSize:501},{maxBatches:11},{maxBatches:1.5}])
    await assert.rejects(()=>cleanExpiredProxyNonces(pool,options),TypeError);
  await assert.rejects(()=>cleanExpiredProxyNonces(pool),/unavailable/);
  await assert.rejects(()=>cleanExpiredProxyNonces({query:async()=>({rowCount:-1})}),/Invalid/);
});
