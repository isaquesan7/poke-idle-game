import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractTm09,generate,gitBlobSha,SOURCE } from '../scripts/extract-tm09-compatibility.mjs';

test('hash de Git blob em bytes conhecidos',()=>{
 assert.equal(gitBlobSha(Buffer.from('test\n')),'9daeafb9864cf43055ae93beb0afd6c7d144bfa4');
});
test('filtra grupo7, machine4, move331 e Kanto; IDs ordenados',()=>{
 const csv='pokemon_id,version_group_id,move_id,pokemon_move_method_id,level,order\n'+[
  '25,7,331,4,0,','1,7,331,4,0,','1,7,331,1,0,1',
  '2,8,331,4,0,1','3,7,332,4,0,1','4,7,331,3,0,1','152,7,331,4,0,1'
 ].join('\n');
 const out=extractTm09(csv);
 assert.deepEqual(out.pokemonIds,[1,25]);
 assert.equal(out.matchingRows,2);assert.equal(out.rowsScanned,7);
 assert.equal(out.status,'verified-snapshot-only-not-released');
 assert.equal(out.sourceGitBlobSha,SOURCE.blob);
});
test('bloqueia CSV vazio, inválido, sem TM e duplicado',()=>{
 assert.throws(()=>extractTm09(''),/vazio/);
 assert.throws(()=>extractTm09('25,7,331,4,0'),/inválida/);
 assert.throws(()=>extractTm09('25,7,331,4,0,abc'),/inválida/);
 assert.deepEqual(extractTm09('25,7,331,4,0,').pokemonIds,[25]);
 assert.throws(()=>extractTm09('25,7,331,4,0,1\n25,7,331,4,0,1'),/Duplicata/);
 assert.throws(()=>extractTm09('25,7,331,1,0,1'),/sem TM09/);
});
test('hash divergente nunca gera arquivo',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tm09-test-'));
 const input=join(dir,'pokemon_moves.csv'),output=join(dir,'allowlist.json');
 await writeFile(input,'1,7,331,4,0,1\n');
 await assert.rejects(generate(input,output),/Snapshot divergente/);
 await assert.rejects(readFile(output),{code:'ENOENT'});
});
