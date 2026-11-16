/**
 * Regressão de segurança do rascunho v0.2 em Chromium desktop/mobile.
 * Cada mutação da UI deve escrever SOMENTE a chave de simulação.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const SAVE_KEY = 'kanto-idle-lab-save-v01';
const DRAFT_KEY = 'kanto-idle-lab-save-v02-draft';
const BASE = 'http://127.0.0.1:5173';
const root = new URL('../../../../', import.meta.url);
const shots = new URL('artifacts/draft-preview/', root);
const fixture = await readFile(new URL('../../../../tests/fixtures/legacy-save-v01.json', import.meta.url), 'utf8');
const json = JSON.parse(fixture);
const original = JSON.stringify(json);
await mkdir(shots, { recursive: true });
const vite = spawn(process.execPath, [
  new URL('node_modules/vite/bin/vite.js', root).pathname,
  '--host', '127.0.0.1', '--port', '5173', '--strictPort'
], { cwd: new URL('../../', import.meta.url).pathname, stdio: 'pipe' });
let stderr = '';
vite.stderr.on('data', data => { stderr += data.toString(); });

async function ready() {
  for(let i=0;i<80;i++) {
    try { if ((await fetch(BASE)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve,250));
  }
  throw Error('Vite não iniciou: '+stderr);
}

async function check(browser,label,viewport) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ saveKey, content }) => {
    if (localStorage.getItem(saveKey) === null) localStorage.setItem(saveKey, content);
  }, { saveKey: SAVE_KEY, content: original });
  await page.goto(BASE, {waitUntil:'domcontentloaded'});
  const create = page.getByRole('button',{name:'Criar simulação v0.2'});
  await create.waitFor();
  await create.click();
  await page.getByText('Simulação separada ativa · revisão 0.').waitFor();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY),original);

  await page.getByRole('button',{name:'Treinador',exact:true}).click();
  await page.getByRole('heading',{name:'Simulação de treinamento v0.2'}).waitFor();
  await page.getByRole('button',{name:'Simular +1 ATK'}).click();
  await page.getByText('Simulação separada ativa · revisão 1.').waitFor();
  await page.getByText('40 manual + 5 extra').waitFor();
  await page.getByLabel('Equipamento: Luvas').selectOption('gloves-tech');
  await page.getByText('Simulação separada ativa · revisão 2.').waitFor();
  await page.getByText('Luvas Táticas').first().waitFor();
  const draft = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
  assert.equal(draft.schemaVersion,2);
  assert.equal(draft.revision,2);
  assert.equal(draft.sourceRaw,original);
  const edited=JSON.parse(draft.workingRaw);
  assert.equal(edited.trainer.manual.attack,40);
  assert.equal(edited.trainer.equipped.gloves,'gloves-tech');
  assert.equal(edited.coins,original && json.coins);
  assert.equal(edited.trainer.xp,json.trainer.xp);
  assert.deepEqual(edited.roster,json.roster);
  assert.deepEqual(edited.badges,json.badges);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY),original);

  await page.screenshot({path:new URL(label+'-draft.png',shots).pathname,fullPage:true,animations:'disabled'});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByText('Simulação separada ativa · revisão 2.').waitFor();
  await page.getByRole('button',{name:'Treinador',exact:true}).click();
  await page.getByText('40 manual + 2 extra').waitFor(); // +2 do anel, luva agora SP.ATK

  // Backup sempre exporta O SAVE REAL e nunca o rascunho.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button',{name:'Exportar backup v0.1'}).click();
  const download = await downloadPromise;
  const backup = await readFile(await download.path(),'utf8');
  assert.equal(backup,original);
  const overflow = await page.evaluate(()=>document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 1,'Overflow horizontal em '+label+': '+overflow);

  // Jogo legado em outra aba atualiza o save: rascunho fica stale e bloqueado.
  await page.evaluate(({key,value})=>localStorage.setItem(key,value),
    {key:SAVE_KEY,value:JSON.stringify({...json,coins:999})});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByText('Save real mudou desde o início da simulação. Edições bloqueadas.').waitFor();
  assert.equal(await page.getByRole('button',{name:'Simular +1 ATK'}).count(),0);
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).revision,DRAFT_KEY),2);

  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Descartar simulação'}).click();
  await page.getByRole('button',{name:'Criar simulação v0.2'}).waitFor();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),DRAFT_KEY),null);
  assert.equal(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),SAVE_KEY)).coins,999);
  assert.deepEqual(errors,[]);
  console.log(label+': create/edit/equip/reload/backup/stale/discard e save real OK');
  await context.close();
}

let browser;
try {
  await ready();
  browser = await chromium.launch({headless:true});
  await check(browser,'desktop',{width:1365,height:768});
  await check(browser,'mobile',{width:390,height:844});
  console.log('PASS: rascunho v0.2 e save v0.1 isolados em desktop/mobile');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if(browser) await browser.close();
  vite.kill('SIGTERM');
}
