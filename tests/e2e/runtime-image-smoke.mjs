/**
 * D-044 — smoke do artefato MINIMAL de produção, servido pela imagem Docker
 * via npm start (mesmo comando do Railway). Não depende de Playwright/React.
 * Executar com D044_SMOKE_BASE_URL apontando ao contêiner isolado.
 */
import assert from 'node:assert/strict';

const BASE=process.env.D044_SMOKE_BASE_URL ?? 'http://127.0.0.1:18080';
async function request(path){
  // D064AR: timer vivo + AbortController. AbortSignal.timeout isolado
  // pode deixar fetch aguardando sem handles (Node exit 13) durante boot Docker.
  const controller=new AbortController();
  let timer;
  try{
    return await Promise.race([
      (async()=>{
        const res=await fetch(BASE+path,{redirect:'manual',signal:controller.signal});
        const body=await res.arrayBuffer();
        return {status:res.status,headers:res.headers,body:Buffer.from(body)};
      })(),
      new Promise((_,reject)=>{
        timer=setTimeout(()=>{
          controller.abort();
          reject(new Error('HTTP smoke timeout em '+path));
        },3000);
      })
    ]);
  }finally{clearTimeout(timer);}
}

let healthy=false;
for(let i=0;i<60;i++){
  try{
    const r=await request('/health');
    if(r.status===200&&r.body.toString('utf8')==='ok'){healthy=true;break;}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
}
assert.equal(healthy,true,'/health deve iniciar sem dependências npm de desenvolvimento');

const landing=await request('/');
assert.equal(landing.status,200);
assert.match(landing.body.toString(),/Poke Idle Game/);
assert.match(landing.body.toString(),/href="\/play"/);
assert.doesNotMatch(landing.body.toString(),/Protótipo v0\.1/);
assert.match(landing.headers.get('content-type')??'',/text\/html/);
assert.match(landing.body.toString(),/id="submit" type="submit" disabled/);
assert.match(landing.body.toString(),/registrationEnabled===true/);
for(const route of ['/verify-email','/reset-password']){
  const authPage=await request(route);
  assert.equal(authPage.status,200,'Página de conta deve carregar: '+route);
  assert.match(authPage.body.toString(),/id="auth-form"/);
  assert.match(authPage.body.toString(),/name="password"/);
}

const modern=await request('/play');
assert.equal(modern.status,200,'build React precisa existir ANTES do start');
const html=modern.body.toString();
assert.match(html,/<div id="root"><\/div>/);
const script=html.match(/<script[^>]+src="(\/assets\/[^"]+\.js)"/)?.[1];
const css=html.match(/<link[^>]+href="(\/assets\/[^"]+\.css)"/)?.[1];
assert.ok(script,'bundle JavaScript Vite precisa estar no contêiner');
assert.ok(css,'bundle CSS Vite precisa estar no contêiner');
for(const path of [script,css]){
  const r=await request(path);
  assert.equal(r.status,200, 'asset React ausente: '+path);
  assert.ok(r.body.length>50, 'asset incompleto: '+path);
}
for(const path of ['/index.html','/styles/tokens.css','/styles/app.css',
  '/scripts/pokemon-sprites.js']){
  const r=await request(path);
  assert.equal(r.status,410,'Protótipo v0.1 deve permanecer desativado: '+path);
}

for(const id of [1,4,25,151]){
  const r=await request('/assets/pokemon-gifs/poke_'+id+'.gif');
  assert.equal(r.status,200,'GIF Kanto '+id+' ausente');
  assert.equal(r.headers.get('content-type'),'image/gif');
  assert.equal(r.body.subarray(0,3).toString(),'GIF');
}
for(const path of ['/package.json','/package-lock.json','/apps/web/src/play/PlayApp.tsx',
  '/node_modules/vite/package.json','/packages/game-core/src/index.ts',
  '/assets/pokemon-gifs/poke_152.gif','/assets/../../package.json']){
  const r=await request(path);
  assert.equal(r.status,404,'rota privada/inválida deve retornar 404: '+path);
}
const slash=await request('/play/');
assert.equal(slash.status,200,'variante /play/ também funciona');
console.log('ONLINE01_RUNTIME_SMOKE_OK: landing /, /play, /play/, /health, assets React, GIFs, v0.1 HTTP 410 e isolamento');
