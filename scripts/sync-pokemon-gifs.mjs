/**
 * Importação reproduzível dos GIFs Kanto para o REPOSITÓRIO DO JOGO.
 * Faz somente GET no repositório original, fixado em um commit conhecido.
 * Execute: npm run sync:gifs
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';

const SOURCE_REVISION = 'd86ba82e1f6b2b0da708ff6c304b71e1f70aa139';
const SOURCE_BASE = 'https://raw.githubusercontent.com/isaquesan7/pokedex/' +
  SOURCE_REVISION + '/config/img/pokemons/';
const DESTINATION = new URL('../assets/pokemon-gifs/', import.meta.url);
const IDS = Array.from({ length: 151 }, (_, i) => i + 1);

function validGif(bytes) {
  if (bytes.length < 100 || bytes.length > 16 * 1024 * 1024) return false;
  const header = bytes.subarray(0, 6).toString('ascii');
  return header === 'GIF87a' || header === 'GIF89a';
}

async function fetchOne(id) {
  const filename = 'poke_' + id + '.gif';
  const target = new URL(filename, DESTINATION);
  try {
    if (validGif(await readFile(target))) return 'existing';
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(SOURCE_BASE + filename);
      if (!response.ok) throw new Error(filename + ': HTTP ' + response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!validGif(bytes)) throw new Error(filename + ': GIF inválido');
      const temp = new URL(filename + '.download', DESTINATION);
      await writeFile(temp, bytes);
      await rename(temp, target);
      return 'downloaded';
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}

async function main() {
  await mkdir(DESTINATION, { recursive: true });
  let cursor = 0;
  let downloaded = 0;
  async function worker() {
    while (cursor < IDS.length) {
      const id = IDS[cursor++];
      if (await fetchOne(id) === 'downloaded') downloaded++;
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  console.log('GIFs Kanto verificados: 151; baixados nesta execução: ' + downloaded);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
