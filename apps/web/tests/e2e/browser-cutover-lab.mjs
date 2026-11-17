/**
 * Teste Chromium REAL do localStorage, APENAS em Vite localhost/porta 5174.
 * Importa módulo com guarda de origem/rota e usa chaves __kanto_lab__.
 * Não conecta a URL de produção, não utiliza chave v0.1 nas operações.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5174';
const LAB = BASE + '/__kanto_v02_browser_lab__';
const ROOT = new URL('../../../../', import.meta.url);
const WEB = new URL('../../', import.meta.url);
const fixture = JSON.parse(await readFile(new URL('../../../../tests/fixtures/legacy-save-v01.json', import.meta.url),'utf8'));
const source = JSON.stringify({
  ...fixture, custom: { note:'Pokémon 🌿 — mantenha campos desconhecidos' }
},null,2) + '\r\n';
const realSave = JSON.stringify({...fixture,coins:99991});
const REAL_KEYS = [
  'kanto-idle-lab-save-v01',
  'kanto-idle-lab-save-v02',
  'kanto-idle-lab-save-v02-origin-backup',
  'kanto-idle-lab-save-v02-commit',
  'kanto-idle-lab-save-v02-draft',
  'kanto-idle-lab-cache-v01'
];
const vite=spawn(process.execPath,[
  new URL('node_modules/vite/bin/vite.js', ROOT).pathname,
  '--host','127.0.0.1','--port','5174','--strictPort'
],{cwd:WEB.pathname,env:process.env,stdio:'pipe'});
let errors='';
vite.stderr.on('data',x=>{errors+=x.toString();});

async function waitForServer() {
  for(let i=0;i<90;i++) {
    try {if((await fetch(BASE)).ok)return;}catch {}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error('Vite do sandbox não iniciou: '+errors);
}
async function openPage(context,path=LAB) {
  const page=await context.newPage();
  const response=await page.goto(path,{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200,'Rota Vite de laboratório deve carregar');
  return page;
}
async function lab(page,operation,params) {
  return page.evaluate(async ({operation,params})=>{
    const module=await import('/src/storage/browserSandboxCutover.ts');
    if(operation==='seed')return module.seedBrowserLab(params.source,params.consent);
    if(operation==='run')return module.runBrowserLab(params);
    if(operation==='inspect')return module.inspectBrowserLab();
    if(operation==='rollback')return module.rollbackBrowserLab(params.consent);
    if(operation==='backup')return module.extractBrowserLabBackup();
    if(operation==='snapshot')return module.snapshotBrowserLab();
    throw Error('Operação desconhecida');
  },{operation,params});
}
const CONSENT='CONFIRMO TESTE NO NAVEGADOR LOCAL';
const ROLLBACK='DESCARTAR APENAS CANDIDATO DE TESTE';

async function setRealSentinel(page) {
  await page.evaluate(([raw,key])=>{
    localStorage.setItem(key,raw);
  },[realSave,REAL_KEYS[0]]);
}
async function realValues(page) {
  return page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),REAL_KEYS);
}
async function checkRealUntouched(page) {
  const observed=await realValues(page);
  assert.deepEqual(observed,[realSave,null,null,null,null,null],
    'Módulo do lab NUNCA deve tocar chaves oficiais, draft ou cache');
}

async function checkOriginAndConsent(browser) {
  const context=await browser.newContext();
  try {
    const wrong=await openPage(context,BASE);
    await setRealSentinel(wrong);
    const refused=await lab(wrong,'seed',{source,consent:CONSENT});
    assert.equal(refused.status,'blocked','Rota pública não pode semear laboratório');
    await checkRealUntouched(wrong);
    const page=await openPage(context);
    const noConsent=await lab(page,'seed',{source,consent:'SIM'});
    assert.equal(noConsent.status,'blocked');
    assert.deepEqual(await lab(page,'snapshot'),{
      legacyRaw:null,backupRaw:null,candidateRaw:null,markerRaw:null
    });
    assert.equal((await lab(page,'seed',{source,consent:CONSENT})).status,'simulated');
    assert.equal((await lab(page,'seed',{source,consent:CONSENT})).status,'blocked',
      'Repetição jamais sobrescreve fixture existente');
    assert.equal((await lab(page,'run',{
      expectedSourceRaw:source,consent:'não'
    })).status,'blocked');
    await checkRealUntouched(page);
  } finally {await context.close();}
  console.log('PASS: origem exclusiva, confirmação e chaves reais protegidas');
}

async function checkCrashReloadConflict(browser) {
  const context=await browser.newContext();
  try {
    const first=await openPage(context);
    await setRealSentinel(first);
    assert.equal((await lab(first,'seed',{source,consent:CONSENT})).status,'simulated');
    const interrupted=await lab(first,'run',{
      expectedSourceRaw:source,consent:CONSENT,stopAfter:1
    });
    assert.deepEqual(
      {status:interrupted.status,stage:interrupted.stage},
      {status:'interrupted',stage:'backup-only'}
    );
    await first.close(); // Interrupção/recarregamento REAL de uma aba.
    const reopened=await openPage(context);
    assert.equal((await lab(reopened,'inspect')).status,'backup-only');
    assert.deepEqual(await lab(reopened,'backup'),{status:'ok',originalRaw:source});
    assert.equal((await lab(reopened,'run',{
      expectedSourceRaw:source,consent:CONSENT
    })).status,'blocked','Reenvio não pode sobrescrever journal parcial');

    // Aba v0.1 não coopera com Web Locks: aqui altera somente a chave de teste.
    const otherTab=await openPage(context);
    const changed=source+' ';
    await otherTab.evaluate(v=>localStorage.setItem('__kanto_lab__legacy',v),changed);
    assert.equal((await lab(reopened,'inspect')).status,'conflict');
    assert.equal((await lab(reopened,'rollback',{consent:ROLLBACK})).status,'blocked');
    assert.equal((await lab(reopened,'backup')).originalRaw,source);
    assert.equal((await lab(otherTab,'snapshot')).legacyRaw,changed);
    await checkRealUntouched(reopened);
    await checkRealUntouched(otherTab);
  } finally {await context.close();}
  console.log('PASS: crash/reload, backup, replay bloqueado e divergência v0.1');
}

async function checkStagedAndRollback(browser) {
  for(const stopAfter of [2,3]) {
    const context=await browser.newContext();
    try {
      const page=await openPage(context);
      await setRealSentinel(page);
      assert.equal((await lab(page,'seed',{source,consent:CONSENT})).status,'simulated');
      const interrupted=await lab(page,'run',{
        expectedSourceRaw:source,consent:CONSENT,stopAfter
      });
      assert.equal(interrupted.status,'interrupted');
      assert.equal(interrupted.stage,stopAfter===2?'staged':'committed');
      assert.equal((await lab(page,'inspect')).status,interrupted.stage);
      assert.equal((await lab(page,'rollback',{consent:'apagar'})).status,'blocked');
      const before=await lab(page,'snapshot');
      assert.equal(before.legacyRaw,source);
      assert.equal((await lab(page,'rollback',{consent:ROLLBACK})).status,'simulated');
      const after=await lab(page,'snapshot');
      assert.equal(after.legacyRaw,source);
      assert.equal(after.backupRaw,before.backupRaw);
      assert.equal(after.candidateRaw,null);
      assert.equal(after.markerRaw,null);
      assert.equal((await lab(page,'inspect')).status,'backup-only');
      await checkRealUntouched(page);
    } finally {await context.close();}
  }
  console.log('PASS: interrupção após candidato/marcador e rollback explícito');
}

async function checkCooperativeLock(browser) {
  const context=await browser.newContext();
  try {
    const first=await openPage(context);
    const second=await openPage(context);
    await setRealSentinel(first);
    assert.equal((await lab(first,'seed',{source,consent:CONSENT})).status,'simulated');
    // Segurar lock usando a própria API Web Locks de duas abas reais.
    const hold=first.evaluate(async()=>{
      const module=await import('/src/storage/browserSandboxCutover.ts');
      await navigator.locks.request(module.SANDBOX_LOCK,async()=>{
        await new Promise(resolve=>{window.__kantoReleaseSandboxLock=resolve;});
      });
    });
    await first.waitForFunction(()=>typeof window.__kantoReleaseSandboxLock==='function');
    const blocked=await lab(second,'run',{expectedSourceRaw:source,consent:CONSENT});
    assert.equal(blocked.status,'blocked');
    assert.match(blocked.message,/Outra aba/);
    assert.equal((await lab(second,'inspect')).status,'empty');
    await first.evaluate(()=>window.__kantoReleaseSandboxLock());
    await hold;
    assert.equal((await lab(second,'run',{
      expectedSourceRaw:source,consent:CONSENT
    })).status,'simulated');
    assert.equal((await lab(first,'inspect')).status,'committed');
    await checkRealUntouched(first);
  } finally {await context.close();}
  console.log('PASS: Web Locks entre duas abas cooperativas na origem do sandbox');
}

async function checkRealQuota(browser) {
  const context=await browser.newContext();
  try {
    const page=await openPage(context);
    await setRealSentinel(page);
    assert.equal((await lab(page,'seed',{source,consent:CONSENT})).status,'simulated');
    // Procurar o limite REAL do localStorage do Chromium somente na chave teste.
    const quota=await page.evaluate(()=>{
      const filler='__kanto_lab__quota_filler';
      let low=0;
      let high=512*1024;
      let rejected=false;
      for(;high<=32*1024*1024;high*=2) {
        try {localStorage.setItem(filler,'x'.repeat(high));low=high;}
        catch(error) {
          rejected=error instanceof DOMException && error.name==='QuotaExceededError';
          break;
        }
      }
      if(!rejected)return {rejected:false,low,high};
      // Deixar pouquíssimo espaço real para o próximo setItem de backup.
      while(high-low>2) {
        const midpoint=Math.floor((high+low)/2);
        try {localStorage.setItem(filler,'x'.repeat(midpoint));low=midpoint;}
        catch {high=midpoint;}
      }
      return {rejected:true,low,high};
    });
    assert.equal(quota.rejected,true,
      'Chromium deve lançar QuotaExceededError na origem isolada');
    const result=await lab(page,'run',{expectedSourceRaw:source,consent:CONSENT});
    assert.equal(result.status,'interrupted');
    assert.equal(result.stage,'quota','Erro real deve interromper journal antes do commit');
    assert.equal((await lab(page,'inspect')).status,'empty');
    assert.equal((await lab(page,'snapshot')).legacyRaw,source);
    await checkRealUntouched(page);
  } finally {await context.close();}
  console.log('PASS: QuotaExceededError REAL do Chromium sem perda de progresso');
}

let browser;
try {
  await waitForServer();
  browser=await chromium.launch({headless:true});
  await checkOriginAndConsent(browser);
  await checkCrashReloadConflict(browser);
  await checkStagedAndRollback(browser);
  await checkCooperativeLock(browser);
  await checkRealQuota(browser);
  console.log('PASS: laboratório browser-cutover, sem qualquer writer oficial v0.2');
} catch(error) {
  console.error(error);
  process.exitCode=1;
} finally {
  if(browser)await browser.close();
  vite.kill('SIGTERM');
}
