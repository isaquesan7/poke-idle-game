/** Regressão do backup da prévia React sem alterar o JSON v0.1. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const SAVE = 'kanto-idle-lab-save-v01';
const base = 'http://127.0.0.1:5173';
const webRoot = new URL('../../', import.meta.url);
const root = new URL('../../../../', import.meta.url);
const shots = new URL('artifacts/react-preview/', root);
await mkdir(shots, { recursive: true });

const example = {
  version: 1, name: 'Treinador de Kanto', coins: 321,
  trainer: { level: 21, xp: 17, manual: { attack: 40 } },
  roster: [{ uid: 1, pokemonId: 1, level: 20, affinity: 73 }],
  team: [1], badges: ['boulder'], note: 'campo antigo preservado'
};
const raw = JSON.stringify(example);
const vite = spawn(process.execPath, [
  new URL('node_modules/vite/bin/vite.js', root).pathname,
  '--host', '127.0.0.1', '--port', '5173', '--strictPort'
], { cwd: webRoot.pathname, env: process.env, stdio: 'pipe' });
let errors = '';
vite.stderr.on('data', data => { errors += data.toString(); });

async function waitForServer() {
  for (let i=0; i<80; i++) {
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw Error('Vite não iniciou: '+errors);
}

async function checkValid(browser, label, viewport) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: SAVE, value: raw });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByText('Progresso v0.1 encontrado neste navegador').waitFor();
  assert.match(await page.locator('main').innerText(), /Treinador/);
  assert.match(await page.locator('main').innerText(), /321/);
  await page.screenshot({
    path: new URL(label+'.png', shots).pathname, animations:'disabled', fullPage:true
  });
  const downloadStarted = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: 'Exportar backup v0.1' }).click();
  const download = await downloadStarted;
  assert.equal(download.suggestedFilename(), 'kanto-idle-save-v01-backup.json');
  const downloaded = await readFile(await download.path(), 'utf8');
  assert.equal(downloaded, raw); // export deve ser byte a byte igual ao save anterior
  const unchanged = await page.evaluate(key => localStorage.getItem(key), SAVE);
  assert.equal(unchanged, raw);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, 'Overflow horizontal no viewport '+label+': '+overflow);
  assert.deepEqual(pageErrors, []);
  await context.close();
  console.log(label+': React render, backup original, localStorage intacto e layout OK');
}

async function checkUnsupported(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const unknown = JSON.stringify({ ...example, version: 2 });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: SAVE, value: unknown });
  await page.goto(base);
  await page.getByText('Save de outra versão preservado sem modificações').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Exportar backup v0.1' }).count(), 0);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVE), unknown);
  await context.close();
  console.log('Versão futura preservada e sem exportação v0.1 equivocada');
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await checkValid(browser, 'desktop', { width: 1365, height: 768 });
  await checkValid(browser, 'mobile', { width: 390, height: 844 });
  await checkUnsupported(browser);
  console.log('PASS: preview React desktop/mobile e backup seguro');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  vite.kill('SIGTERM');
}
