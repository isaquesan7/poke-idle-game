import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/pokemon-sprites.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const calls = [];
const env = {
  window: {},
  document: { addEventListener(type, fn, capture) { calls.push({ type, fn, capture }); } }
};
vm.runInNewContext(source, env);
const { sourceFor, fallbackFor } = env.window.KantoSprites;

test('151 espécies de Kanto usam arquivos GIF locais sem alterar dados da PokéAPI', () => {
  for (let id = 1; id <= 151; id++) {
    assert.equal(sourceFor(id), 'assets/pokemon-gifs/poke_' + id + '.gif');
  }
  assert.equal(sourceFor(152), fallbackFor(152));
  assert.equal(sourceFor(1.5), fallbackFor(1.5));
  assert.match(html, /const iconFor=id=>window\.KantoSprites\.sourceFor\(id\)/);
  assert.match(html, /src="scripts\/pokemon-sprites\.js"/);
});

test('erro de GIF troca apenas a imagem afetada pelo PNG e evita fallback repetido', () => {
  const handler = calls.find(call => call.type === 'error');
  assert.ok(handler);
  assert.equal(handler.capture, true);
  const img = {
    tagName: 'IMG',
    dataset: {},
    getAttribute() { return 'assets/pokemon-gifs/poke_25.gif'; },
    src: 'assets/pokemon-gifs/poke_25.gif'
  };
  handler.fn({ target: img });
  assert.equal(img.src, fallbackFor(25));
  assert.equal(img.dataset.spriteFallback, '1');
  img.src = 'outro.png';
  handler.fn({ target: img });
  assert.equal(img.src, 'outro.png');
  const unrelated = { tagName: 'IMG', dataset: {}, getAttribute() { return 'logo.png'; }, src: 'logo.png' };
  handler.fn({ target: unrelated });
  assert.equal(unrelated.src, 'logo.png');
});

test('servidor permite apenas GIFs Kanto via rota local e mantém healthcheck', () => {
  assert.match(server, /spriteMatch/);
  assert.match(server, /Number\(spriteMatch\[1\]\) <= 151/);
  assert.match(server, /Content-Type': 'image\/gif'/);
  assert.match(server, /\/health/);
  assert.match(server, /scripts\/pokemon-sprites\.js/);
});

test('versão de save permanece a mesma (compatibilidade v0.1)', () => {
  assert.match(html, /const SAVE_KEY = 'kanto-idle-lab-save-v01'/);
  assert.match(html, /const CACHE_KEY = 'kanto-idle-lab-cache-v01'/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});
