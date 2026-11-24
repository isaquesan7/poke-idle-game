/** Offline bounded cleanup job. No scheduler or production configuration.
 * Each invocation performs at most maxBatches autocommit operations.
 * A real scheduler must be separately approved, with failure/backlog alerts.
 */
import {pruneProxyIdentityNonces} from './proxyNonceGuard.mjs';

export async function cleanExpiredProxyNonces(pool,{batchSize=500,maxBatches=10}={}){
  if(!Number.isInteger(batchSize)||batchSize<1||batchSize>500||
     !Number.isInteger(maxBatches)||maxBatches<1||maxBatches>10)
    throw new TypeError('Invalid bounded nonce maintenance settings');
  let removed=0,batches=0;
  for(;batches<maxBatches;){
    const count=await pruneProxyIdentityNonces(pool,{limit:batchSize});
    if(!Number.isInteger(count)||count<0||count>batchSize)
      throw new Error('Invalid nonce maintenance result');
    batches++;
    removed+=count;
    if(count<batchSize)return {removed,batches,mayHaveBacklog:false};
  }
  // A full last batch does not prove backlog, nor does an empty SKIP LOCKED
  // batch prove absence of rows locked by another worker.
  return {removed,batches,mayHaveBacklog:true};
}
