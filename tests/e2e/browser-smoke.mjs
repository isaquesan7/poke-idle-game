/**
 * Smoke E2E Playwright: offline determinístico, duas resoluções e save legado.
 * Dependência Playwright instalada exclusivamente no workflow, não em produção.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const SAVE = 'kanto-idle-lab-save-v01';
const CACHE = 'kanto-idle-lab-cache-v01';
const root = new URL('../../', import.meta.url);
const artifacts = new URL('../../artifacts/browser/', import.meta.url);
const base = 'http://127.0.0.1:3187';
const state = JSON.parse(await readFile(new URL('../fixtures/legacy-save-v01.json', import.meta.url), 'utf8'));
await mkdir(artifacts, { recursive: true });
const snapshots = {
  1: { id:1,name:'bulbasaur',types:['grass','poison'],base:{hp:45,attack:49,defense:49,specialAttack:65,specialDefense:65,speed:45},moves:['vine-whip','tackle'] },
  4: { id:4,name:'charmander',types:['fire'],base:{hp:39,attack:52,defense:43,specialAttack:60,specialDefense:50,speed:65},moves:['ember','scratch'] },
  7: { id:7,name:'squirtle',types:['water'],base:{hp:44,attack:48,defense:65,specialAttack:50,specialDefense:64,speed:43},moves:['water-gun','tackle'] }
};
const cached = {
  pokemon:snapshots,
  moves:{
    'vine-whip':{name:'vine-whip',power:45,type:'grass',category:'physical',accuracy:100,priority:0},
    tackle:{name:'tackle',power:40,type:'normal',category:'physical',accuracy:100,priority:0}
  },
  types:{}
};
const server = spawn(process.execPath, ['server.mjs'], {
  cwd:root.pathname,env:{...process.env,PORT:'3187'},stdio:'pipe'
});
let stderr = '';
server.stderr.on('data', buffer => { stderr += buffer.toString(); });
async function ready() {
  for(let i=0;i<60;i++) {
    try { if ((await fetch(base+'/health')).ok) return; } catch {}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error('Servidor não iniciou: '+stderr);
}
async function offline(page) {
  await page.route('https://pokeapi.co/**',route=>route.abort());
  await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
}
async function legacy(browser, label, viewport) {
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await offline(page);
  // Interceptar ANTES de Pokédex/Arena: GIF #25 pode ficar no cache do Chromium.
  // Assim a falha simulada e o fallback PNG são determinísticos.
  await page.route('**/assets/pokemon-gifs/poke_25.gif',route=>route.fulfill({
    status:404,body:'',headers:{'cache-control':'no-store'}
  }));
  await page.addInitScript(({s,k,saved,cache})=>{
    if (!localStorage.getItem(s)) localStorage.setItem(s,JSON.stringify(saved));
    localStorage.setItem(k,JSON.stringify(cache));
  },{s:SAVE,k:CACHE,saved:state,cache:cached});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#view-overview .hero').waitFor({state:'visible'});
  assert.match(await page.locator('#top-level').innerText(),/21/);
  await page.waitForFunction(()=>{
    const img=document.querySelector('#view-overview img[src="assets/pokemon-gifs/poke_1.gif"]');
    return Boolean(img && img.complete && img.naturalWidth>0);
  },null,{timeout:15000});
  const primary=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim());
  assert.equal(primary,'#69d6e5');
  await page.screenshot({path:new URL(label+'-overview.png',artifacts).pathname,animations:'disabled'});
  await page.locator('.navbtn[data-view="trainer"]').click();
  const plus=page.locator('#view-trainer button[data-action="stat-trainer"][data-stat="attack"]');
  assert.equal(await plus.isEnabled(),true);
  await plus.click();
  assert.equal(await plus.isEnabled(),false);
  let saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.equal(saved.trainer.manual.attack,40);
  await page.locator('.navbtn[data-view="pokemon"]').click();
  await page.locator('#view-pokemon img[src="assets/pokemon-gifs/poke_1.gif"]').first().waitFor();
  await page.screenshot({path:new URL(label+'-pokemon.png',artifacts).pathname,animations:'disabled'});
  await page.locator('.navbtn[data-view="pokedex"]').click();
  await page.locator('#view-pokedex .dexentry').first().waitFor();
  assert.equal(await page.locator('#view-pokedex .dexentry').count(),151);
  await page.locator('#dex-filter').fill('bulbasaur');
  assert.equal(await page.locator('#view-pokedex .dexentry').count(),1);
  await page.locator('#dex-filter').fill('');
  await page.screenshot({path:new URL(label+'-pokedex.png',artifacts).pathname,animations:'disabled'});
  // A rota de falha da imagem já foi instalada ANTES do primeiro carregamento.
  await page.locator('.navbtn[data-view="arena"]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#view-arena .fighter img')].some(img=>img.src.includes('/official-artwork/25.png')));
  await page.screenshot({path:new URL(label+'-arena.png',artifacts).pathname,animations:'disabled'});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#view-overview .hero').waitFor();
  saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.equal(saved.version,1);
  assert.equal(saved.name,'Save legado v0.1');
  assert.equal(saved.trainer.manual.attack,40);
  assert.equal(saved.coins,321);
  assert.equal(saved.roster[0].affinity,73);
  assert.equal(saved.roster[0].uid,1);
  assert.deepEqual(saved.team,[1]);
  assert.deepEqual(saved.badges,['boulder']);
  assert.deepEqual(errors,[]);
  console.log(label+': CSS, GIF, fallback, 5 telas, Pokédex e save v0.1 OK');
  await context.close();
}
async function newGame(browser) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await offline(page);
  await page.addInitScript(({k,cache})=>localStorage.setItem(k,JSON.stringify(cache)),{k:CACHE,cache:cached});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#starter-modal .starter').first().waitFor({state:'visible'});
  await page.locator('#starter-modal button[data-action="starter"][data-id="1"]').click();
  await page.locator('#view-overview .hero').waitFor();
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.equal(saved.version,1);
  assert.equal(saved.roster[0].pokemonId,1);
  assert.deepEqual(saved.team,[1]);
  assert.deepEqual(errors,[]);
  console.log('Novo jogo no mobile e save v0.1 OK');
  await context.close();
}
let browser;
try{
  await ready();
  browser=await chromium.launch({headless:true});
  await legacy(browser,'desktop',{width:1365,height:768});
  await legacy(browser,'mobile',{width:390,height:844});
  await newGame(browser);
  console.log('PASS: regressão completa no Chromium');
}catch(error){
  console.error(error);
  process.exitCode=1;
}finally{
  if(browser) await browser.close();
  server.kill('SIGTERM');
}
