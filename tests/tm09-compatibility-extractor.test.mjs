import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  SNAPSHOT, gitBlobSha1, parseCsv, extractTm09Compatibility,
} from '../scripts/extract-tm09-compatibility.mjs';

function blobHash(content) {
  const bytes = Buffer.from(content);
  return createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
}
const header = 'pokemon_id,version_group_id,move_id,pokemon_move_method_id,level,order\n';
const lines = [
  '1,7,331,4,0,1',
  '3,7,331,4,0,1',
  '3,7,331,4,0,2',
  '25,7,331,1,5,1',
  '10,8,331,4,0,1',
  '152,7,331,4,0,1',
  '151,7,330,4,0,1',
];
const fixture = header + lines.join('\n') + '\n';

test('Git blob SHA-1 inclui cabeçalho e tamanho em bytes', () => {
  assert.equal(gitBlobSha1(Buffer.from(fixture)), blobHash(fixture));
  assert.equal(SNAPSHOT.gitBlobSha1, 'f66f614adf535af6940c65f434efe5ddeec4687a');
});

test('extrai somente group7/move331/method4, IDs 1..151, distintos e ordenados', () => {
  const result = extractTm09Compatibility(Buffer.from(fixture), blobHash(fixture));
  assert.deepEqual(result.speciesIds, [1, 3]);
  assert.equal(result.matchingRows, 3);
  assert.equal(result.nonKantoMatchingRows, 1);
  assert.equal(result.state, 'review-only-not-released');
});

test('falha fechado para bytes incorretos mesmo com CSV válido', () => {
  assert.throws(() => extractTm09Compatibility(Buffer.from(fixture)), /Snapshot não corresponde/);
  assert.throws(() => extractTm09Compatibility(Buffer.from(fixture + ' '), blobHash(fixture)), /Snapshot não corresponde/);
});

test('não confia em cabeçalho ausente, colunas inválidas ou ID adulterado', () => {
  for (const csv of [
    'pokemon_id,version_group_id,move_id,level\n1,7,331,0\n',
    header + '1,7,331,4,0\n',
    header + '1,7,331,4,0,1,extra\n',
    header + '-1,7,331,4,0,1\n',
    header + '1,7,331,4,0,1\n2,7,331,nope,0,1\n',
    header + '1,7,331,4,0,1\n1,7,331,4,0,1"\n',
    header + '25,7,331,1,0,1\n',
  ]) {
    assert.throws(() => extractTm09Compatibility(csv, blobHash(csv)));
  }
});

test('parser suporta quoted CSV e rejeita aspas incompletas', () => {
  assert.deepEqual(parseCsv('a,b\r\n"1,2","x""y"\r\n'), [['a','b'],['1,2','x"y']]);
  assert.throws(() => parseCsv('"unclosed'), /sem fechamento/);
});
