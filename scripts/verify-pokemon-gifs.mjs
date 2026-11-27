/**
 * Checagem offline do acervo #001-#151 antes de versionar e publicar os GIFs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { open, readdir, stat, readFile } from 'node:fs/promises';

const folder = new URL('../assets/pokemon-gifs/', import.meta.url);
const expected = Array.from({ length: 151 }, (_, i) => 'poke_' + (i + 1) + '.gif');
// Owner-supplied animated originals, validated frame by frame on 27/11/2026.
const megaHashes = {
  'poke_10033.gif': '54924e5fe99ef002d661da81b18e4bb9db252feb4926a5b9b45043a0179a8e74',
  'poke_10034.gif': '864ee9ff47fbbd571f902805eba3dcd1cc344c3e54b715bb40885cebbbc848bc',
  'poke_10035.gif': '4733b029de6016d77603566c0b530927cef1b3ab284b1e1b40a571148a59e7eb',
  'poke_10036.gif': 'b74a8a9d03c58189dd26901666228a5bfc6c564cff00db900199dcd6ba9b6743'
};
const actual = (await readdir(folder)).filter(name => name.endsWith('.gif')).sort();
const megaNames = Object.keys(megaHashes);
const hasMega = megaNames.some(name => actual.includes(name));
if (hasMega || process.argv.includes('--require-mega')) expected.push(...megaNames);
assert.deepEqual(actual, [...expected].sort(), 'Acervo GIF incompleto ou com arquivos extras');

let totalBytes = 0;
for (const name of expected) {
  const url = new URL(name, folder);
  const info = await stat(url);
  assert.ok(info.size >= 100 && info.size <= 16 * 1024 * 1024, name + ': tamanho inválido');
  const file = await open(url, 'r');
  try {
    const header = Buffer.alloc(6);
    const { bytesRead } = await file.read(header, 0, 6, 0);
    assert.equal(bytesRead, 6, name + ': GIF incompleto');
    assert.ok(['GIF89a', 'GIF87a'].includes(header.toString('ascii')), name + ': cabeçalho GIF inválido');
  } finally {
    await file.close();
  }
  if (Object.hasOwn(megaHashes, name)) {
    const digest = createHash('sha256').update(await readFile(url)).digest('hex');
    assert.equal(digest, megaHashes[name], name + ': não corresponde ao original animado aprovado');
  }
  totalBytes += info.size;
}
console.log('Acervo Kanto OK: ' + expected.length + ' GIFs (' + totalBytes + ' bytes)');
if (!hasMega) console.log('GIFs Mega pendentes; --require-mega exige os quatro arquivos.');
