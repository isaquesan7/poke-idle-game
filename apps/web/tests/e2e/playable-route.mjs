/** Teste de aceitação da rota /play servida pelo mesmo server.mjs do Railway. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../../../', import.meta.url);
const shots = new URL('artifacts/playable/', root);
await mkdir(shots,{recursive:true});
const PORT = 43117;
const BASE = 'http://127.0.0.1:' + PORT;
const SAVE = 'kanto-idle-play-v02';
const LEGACY = 'kanto-idle-lab-save-v01';
const server = spawn(process.execPath, [new URL('server.mjs',root).pathname], {
  cwd:root.pathname,
  env:{...process.env,PORT:String(PORT)},
  stdio:'pipe'
});
let stderr = '';
server.stderr.on('data',data => { stderr += data.toString(); });

async function ready() {
  for(let i=0;i<80;i++) {
    try { if((await fetch(BASE+'/health')).ok) return; } catch {}
    await new Promise(r=>setTimeout(r,250));
  }
  throw Error('Servidor não iniciou: '+stderr);
}

async function exercise(browser, label, viewport) {
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({key})=>localStorage.setItem(key,'LEGACY-DO-NOT-TOUCH'),{key:LEGACY});
  const response=await page.goto(BASE+'/play',{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200);
  await page.getByRole('heading',{name:'O começo da sua aventura.'}).waitFor();
  await page.getByLabel('Nome do treinador').fill('Treinador Teste');
  await page.getByRole('radio',{name:/Charmander/}).check();
  await page.getByRole('checkbox',{name:/modo demonstração/}).check();
  await page.getByRole('button',{name:'Começar aventura'}).click();
  await page.getByRole('heading',{name:'Bem-vindo de volta, Treinador Teste!'}).waitFor();

  let snapshot=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.equal(snapshot.schemaVersion,2);
  assert.equal(snapshot.revision,0);
  assert.equal(JSON.parse(snapshot.journal.raw).roster[0].pokemonId,4);
  await page.getByRole('button',{name:'Treinador',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar ponto em ATK do treinador'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===1,SAVE);
  await page.getByRole('button',{name:'Pokémon',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar ponto em DEF do Pokémon'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===2,SAVE);
  snapshot=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  assert.equal(JSON.parse(snapshot.journal.raw).trainer.manual.attack,1);
  assert.equal(JSON.parse(snapshot.journal.raw).roster[0].manual.defense,1);

  await page.getByRole('button',{name:'Expedição',exact:true}).click();
  await page.getByRole('button',{name:'Iniciar expedição'}).click();
  await page.getByRole('heading',{name:'Expedição em andamento'}).waitFor();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===3,SAVE);
  // Ensaio em navegador: acelera apenas o cursor do save de teste.
  // Não existe relógio confiável nem anti-cheat nesta versão local.
  await page.evaluate(key=>{
    const snapshot=JSON.parse(localStorage.getItem(key));
    const game=JSON.parse(snapshot.journal.raw);
    game.expedition.lastClaimAt-=31000;
    snapshot.journal.raw=JSON.stringify(game);
    localStorage.setItem(key,JSON.stringify(snapshot));
  },SAVE);
  await page.reload();
  await page.getByRole('button',{name:'Expedição',exact:true}).click();
  await page.getByRole('button',{name:'Resgatar recompensas'}).click();
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.revision===4,SAVE);
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE);
  const game=JSON.parse(after.journal.raw);
  assert.ok(game.coins>=221, 'Três ciclos devem render pelo menos 21 moedas na demo');
  assert.ok(game.trainer.xp>=12);
  assert.ok(game.roster[0].xp>=15);
  assert.equal(after.revision,4); // 2 pontos, start, claim
  assert.equal(after.journal.receipts.length,2);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),LEGACY),'LEGACY-DO-NOT-TOUCH');

  await page.screenshot({path:new URL(label+'-play.png',shots).pathname,fullPage:true,animations:'disabled'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=1,'Overflow horizontal em '+label+': '+overflow);
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(label+': /play, onboarding, treino, persistência, reload e claim OK');
}

let browser;
try {
  await ready();
  assert.equal((await fetch(BASE+'/')).status,200,'protótipo v0.1 preservado na raiz');
  assert.equal((await fetch(BASE+'/health')).status,200);
  browser=await chromium.launch({headless:true});
  await exercise(browser,'desktop',{width:1365,height:768});
  await exercise(browser,'mobile',{width:390,height:844});
  console.log('PASS: experiência React jogável no servidor de produção');
} catch(error) {
  console.error(error);
  process.exitCode=1;
} finally {
  if(browser) await browser.close();
  server.kill('SIGTERM');
}
