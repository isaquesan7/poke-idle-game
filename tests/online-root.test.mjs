import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

test('ONLINE-01: / é landing provisória, v0.1 indisponível, /play preservado',async()=>{
  const port=40000+Math.floor(Math.random()*20000);
  const child=spawn(process.execPath,['server.mjs'],{
    cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,PORT:String(port)},stdio:'ignore'
  });
  const base='http://127.0.0.1:'+port;
  try{
    let up=false;
    for(let i=0;i<60;i++){
      try{const res=await fetch(base+'/');if(res.status===200){up=true;break;}}
      catch{}
      await new Promise(done=>setTimeout(done,50));
    }
    assert.equal(up,true,'Servidor precisa responder na raiz');
    const root=await fetch(base+'/');
    const html=await root.text();
    assert.equal(root.status,200);
    assert.match(html,/Poke Idle Game/);
    assert.match(html,/href="\/play"/);
    assert.doesNotMatch(html,/kanto-idle-lab-save-v01/);
    for(const path of ['/index.html','/styles/app.css',
      '/styles/tokens.css','/scripts/pokemon-sprites.js']){
      const res=await fetch(base+path);
      assert.equal(res.status,410,'Rota v0.1 '+path+' deve estar desativada');
    }
    const page=await fetch(base+'/play');
    assert.ok(page.status===200||page.status===503,
      'Rota /play preservada (503 apenas sem dist no teste isolado)');
    assert.equal((await fetch(base+'/landing.html')).status,404);
    assert.equal((await fetch(base+'/services/api/sql/001_online_foundation.sql')).status,404);
  }finally{child.kill('SIGTERM');}
});
