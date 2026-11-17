/**
 * Auditoria mínima automatizada: mudanças no catálogo de ações do index.html
 * devem atualizar a matriz de mutações antes de qualquer promoção a v0.2.
 * Este teste NÃO prova ausência de efeitos indiretos; a revisão manual segue.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const legacy=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const actions=[...legacy.matchAll(/if\(action==='([a-z-]+)'/g)].map(hit=>hit[1]);
const EXPECTED=[
  'starter','save-name','stat-trainer','reset-trainer','stat-pokemon',
  'reset-pokemon','select-pokemon','add-team','remove-team','upgrade-move',
  'encounter','battle','start-exp','claim-exp','stop-exp','dex-details',
  'encounter-specific','reset-all','equip','title','move'
];

test('todas as 21 ações legadas precisam constar na matriz de auditoria',()=>{
  assert.equal(actions.length,new Set(actions).size,'Ação duplicada encontrada');
  assert.deepEqual([...actions].sort(),[...EXPECTED].sort(),
    'Atualizar docs/LEGACY_MUTATION_MATRIX.md e esta lista quando mudar handler legado');
});

test('writers indiretos e persistência de saída permanecem sob auditoria',()=>{
  for(const signature of [
    'function save(){','function saveCache(){',
    'function addTrainerXP(','function addPokemonXP(',
    'function gainedBadges(','function ensureTitle(',
    'async function ensureMove(','async function encounter(',
    'async function battle(','function startExp(',
    'function claimExp(','function stopExp(','function resetAll(',
    "window.addEventListener('pagehide',save)"
  ]) {
    assert.ok(legacy.includes(signature),
      'Writer alterado/removido: revisar docs/LEGACY_MUTATION_MATRIX.md: '+signature);
  }
});
