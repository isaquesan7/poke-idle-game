/**
 * D-049: extrator OFFLINE, fechado por padrão, da compatibilidade TM09 FRLG.
 * Nunca consulta PokéAPI em runtime nem libera a TM no jogo.
 *
 * Uso: node scripts/extract-tm09-compatibility.mjs --input pokemon_moves.csv
 *      node scripts/extract-tm09-compatibility.mjs --input pokemon_moves.csv --output tm09-review.json
 * A entrada deve ser o arquivo exato do snapshot fixado; hash Git blob é validado
 * ANTES de interpretar qualquer linha. JSON gerado precisa de revisão humana.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const SNAPSHOT = Object.freeze({
  repository: 'PokeAPI/pokeapi',
  commit: 'ac2f1acb055026e3dff1e0aca743bb46256a810a',
  path: 'data/v2/csv/pokemon_moves.csv',
  gitBlobSha1: 'f66f614adf535af6940c65f434efe5ddeec4687a',
  versionGroupId: 7,
  moveId: 331,
  methodId: 4,
});

export function gitBlobSha1(bytes) {
  const header = Buffer.from('blob ' + bytes.byteLength + '\0');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

// CSV com aspas e campos escapados, sem dependências. Rejeita linhas malformadas.
export function parseCsv(text) {
  if (text.startsWith('\uFEFF')) throw new Error('BOM inesperado no snapshot CSV.');
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += c;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ''; closed = false;
      if (c !== ',') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        rows.push(row); row = [];
      }
    } else if (c === '"' && field === '' && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error('CSV com aspas inválidas.');
      field += c;
    }
  }
  if (quoted) throw new Error('CSV com campo sem fechamento.');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function extractTm09Compatibility(input, expectedSha = SNAPSHOT.gitBlobSha1) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const actualSha = gitBlobSha1(bytes);
  if (actualSha !== expectedSha) {
    throw new Error('Snapshot não corresponde ao Git blob fixado: ' + actualSha);
  }
  const rows = parseCsv(bytes.toString('utf8'));
  if (rows.length < 2) throw new Error('CSV vazio.');
  const header = rows.shift();
  const required = ['pokemon_id', 'version_group_id', 'move_id', 'pokemon_move_method_id'];
  if (new Set(header).size !== header.length || required.some(c => !header.includes(c))) {
    throw new Error('Cabeçalho do pokemon_moves.csv inesperado.');
  }
  const index = Object.fromEntries(required.map(k => [k, header.indexOf(k)]));
  const ids = new Set();
  let matches = 0, nonKantoMatches = 0;
  for (const row of rows) {
    if (row.length !== header.length) throw new Error('Número de colunas inválido.');
    const values = required.map(k => row[index[k]]);
    if (values.some(v => !/^(0|[1-9][0-9]*)$/.test(v) || !Number.isSafeInteger(Number(v)))) {
      throw new Error('ID inválido no snapshot CSV.');
    }
    const [pokemon, group, move, method] = values.map(Number);
    if (pokemon < 1 || group < 1 || move < 1 || method < 1) throw new Error('ID não positivo.');
    if (group !== SNAPSHOT.versionGroupId || move !== SNAPSHOT.moveId || method !== SNAPSHOT.methodId) continue;
    if (pokemon > 151) { nonKantoMatches++; continue; }
    matches++;
    ids.add(pokemon);
  }
  if (!matches || ids.size === 0) throw new Error('Nenhuma espécie elegível; revisar fonte.');
  const speciesIds = [...ids].sort((a,b) => a-b);
  return {
    state: 'review-only-not-released',
    source: { ...SNAPSHOT, gitBlobSha1: actualSha },
    matchingRows: matches,
    distinctKantoSpecies: speciesIds.length,
    nonKantoMatchingRows: nonKantoMatches,
    speciesIds,
  };
}

async function main(args) {
  const inputIndex = args.indexOf('--input');
  const outputIndex = args.indexOf('--output');
  if (inputIndex < 0 || !args[inputIndex + 1] || (outputIndex >= 0 && !args[outputIndex + 1])) {
    throw new Error('Uso: --input pokemon_moves.csv [--output tm09-review.json]');
  }
  const result = extractTm09Compatibility(await readFile(args[inputIndex + 1]));
  const json = JSON.stringify(result, null, 2) + '\n';
  if (outputIndex >= 0) await writeFile(args[outputIndex + 1], json, { flag: 'wx' });
  else process.stdout.write(json);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 1; });
}
