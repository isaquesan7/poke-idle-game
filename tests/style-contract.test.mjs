import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('index.html');
const app = read('styles/app.css');
const tokens = read('styles/tokens.css');
const server = read('server.mjs');

test('HTML carrega apenas os estilos centralizados', () => {
  assert.match(html, /href="styles\/tokens\.css"/);
  assert.match(html, /href="styles\/app\.css"/);
  assert.doesNotMatch(html, /<style>/);
});

test('toda variável referenciada no CSS possui definição em :root', () => {
  assert.match(tokens, /:root\s*\{/);
  const available = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map(x => x[1]));
  const used = [...app.matchAll(/var\((--[\w-]+)\)/g)].map(x => x[1]);
  assert.ok(used.length > 100);
  for (const name of used) assert.ok(available.has(name), 'Token ausente: ' + name);
});

test('CSS visual não usa cores hardcoded fora dos tokens', () => {
  assert.doesNotMatch(app, /#[a-f\d]{3,8}\b/i);
  assert.doesNotMatch(app, /rgba?\(/i);
  assert.match(tokens, /--color-primary:\s*#69d6e5/i);
});

test('cada classe principal permanece documentada', () => {
  for (const name of ['shell', 'navbtn', 'btn', 'panel', 'statrow',
    'poke-card', 'dexentry', 'fightlog', 'modal', 'toast']) {
    assert.match(app, new RegExp('\\/\\* [^\\n]*\\.' + name + '[^\\n]*:'));
  }
});

test('servidor mantém healthcheck e fornece arquivos CSS por rotas explícitas', () => {
  assert.match(server, /\/health/);
  assert.match(server, /\/styles\/tokens\.css/);
  assert.match(server, /\/styles\/app\.css/);
});
