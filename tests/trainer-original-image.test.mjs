/**
 * Gate D-050: a arte do treinador é propriedade visual do projeto e deve
 * permanecer idêntica ao PNG originalmente fornecido pelo autor.
 * Nunca substituir por placeholder em uma release aprovada.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const SOURCE_SHA256='661fec876c4305f55cd9b6a0321bdaec74cdc908166cd14e05dafe0cf18435f3';
const PATH='apps/web/public/assets/trainer-original.png';
test('D050: PNG original do treinador deve estar presente, intacto e versionado',async()=>{
  const bytes=await readFile(PATH);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),SOURCE_SHA256,
    'Arte deve ser exatamente o PNG original enviado pelo autor');
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});
