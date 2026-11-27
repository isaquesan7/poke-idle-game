import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createAuthGateway} from '../scripts/auth-gateway-candidate.mjs';

async function listen(server){
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  return 'http://127.0.0.1:'+server.address().port;
}
function close(server){
  server.closeAllConnections();
  return new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}

test('gateway forwards only Kanto and the four approved Mega GIF asset IDs',async()=>{
  const received=[];
  const previous=process.env.NODE_ENV;
  process.env.NODE_ENV='test';
  const upstream=createServer((req,res)=>{
    received.push(req.url);
    res.writeHead(200,{'content-type':'image/gif','cache-control':'public, max-age=86400'});
    res.end('GIF89a');
  });
  let gateway;
  try{
    const upstreamOrigin=await listen(upstream);
    gateway=createAuthGateway({upstreamOrigin,clientOrigin:'http://127.0.0.1:1',
      issuer:{sign(){throw Error('assets must not be signed');}},
      resolveTrustedClientIp(){throw Error('assets do not require identity');},loopbackTest:true});
    const origin=await listen(gateway);
    const allowed=[1,151,10033,10034,10035,10036].map(id=>'/assets/pokemon-gifs/poke_'+id+'.gif');
    for(const path of allowed){
      const response=await fetch(origin+path);
      assert.equal(response.status,200,path);
      assert.equal(response.headers.get('content-type'),'image/gif');
      assert.equal(await response.text(),'GIF89a');
    }
    for(const id of ['0','152','10032','10037','100330','010033','-10033']){
      const response=await fetch(origin+'/assets/pokemon-gifs/poke_'+id+'.gif');
      assert.equal(response.status,404,id);
      await response.text();
    }
    const query=await fetch(origin+allowed[2]+'?other=1');
    assert.equal(query.status,404);await query.text();
    const post=await fetch(origin+allowed[2],{method:'POST'});
    assert.equal(post.status,405);await post.text();
    assert.deepEqual(received,allowed);
  }finally{
    if(gateway?.listening)await close(gateway);
    if(upstream.listening)await close(upstream);
    if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;
  }
});
