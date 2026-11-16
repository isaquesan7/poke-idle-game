/**
 * Checagem offline do acervo #001-#151 antes de versionar e publicar os GIFs.
 */
import assert from 'node:assert/strict';
import { open, readdir, stat } from 'node:fs/promises';

const folder = new URL('../assets/pokemon-gifs/', import.meta.url);
const expected = Array.from({ length: 151 }, (_, i) => 'poke_' + (i + 1) + '.gif');
const actual = (await readdir(folder)).filter(name => name.endsWith('.gif')).sort();
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
  totalBytes += info.size;
}
console.log('Acervo Kanto OK: 151 GIFs (' + totalBytes + ' bytes)');
