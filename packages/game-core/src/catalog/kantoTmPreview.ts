/**
 * D-048 — contrato de dados de TMs FUTURAS, somente leitura.
 *
 * Política híbrida DELIBERADA: movimentos já jogáveis preservam metadados
 * publicados (snapshot PokéAPI atual) e saves/replays; futuras TMs do recorte
 * FireRed/LeafGreen deverão usar ficha HISTÓRICA Gen III explícita, nunca
 * inferir categoria/poder atuais por acidente. Isso não altera a tabela de
 * tipos ou a economia SP do Idle.
 *
 * Referências auditadas:
 * - PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a:
 *   machines.csv blob 0ccca49159ef5fde36026f0503296ef766d39ee6:
 *   linha "9,7,313,331": máquina número9, FRLG group7, item313, move331.
 *   pokemon_move_methods.csv blob ebd7be9a1bcbb1fa7321c51f5a45d41953dc7cea:
 *   método 4 = machine; version_group_pokemon_move_methods.csv grupo7
 *   admite método 4.
 *   moves.csv blob a55116329ca22f230fea953de94c2d1dffe2ad0e:
 *   id331 modernizado, power25, físico, PP30, precisão100.
 * - Geração III histórica, TM09 Bullet Seed:
 *   https://pokemondb.net/move/bullet-seed
 *   https://www.psypokes.com/dex/techdex/331/all
 *   Grass / Especial / poder10 por hit / PP30 / precisão100.
 * - Multi-hit histórico 2..5: pesos 3/8,3/8,1/8,1/8,
 *   https://bulbapedia.bulbagarden.net/wiki/Multistrike_move
 *
 * pokemon_moves.csv snapshot completo é grande e a API de leitura direta
 * do conector não retornou conteúdo. Portanto não há allowlist positiva
 * de espécies nesta etapa; fail-closed até conferir TODO o método machine.
 * NÃO há interface de ensinar, drop, item concedido ou consumo de TM aqui.
 */
export const KANTO_TM_SOURCE_COMMIT =
  'ac2f1acb055026e3dff1e0aca743bb46256a810a';
export const KANTO_TM_SOURCE_BLOBS=Object.freeze({
  machines:'0ccca49159ef5fde36026f0503296ef766d39ee6',
  moves:'a55116329ca22f230fea953de94c2d1dffe2ad0e',
  moveMethods:'ebd7be9a1bcbb1fa7321c51f5a45d41953dc7cea',
  pokemonMoves:'f66f614adf535af6940c65f434efe5ddeec4687a'
});

export const KANTO_TM_VERSION_POLICY=Object.freeze({
  existingMoveStats:'published-modern-snapshot-preserved',
  newMachineStats:'gen3-historical-explicit',
  learnsetVersionGroup:'firered-leafgreen',
  learnsetVersionGroupId:7,
  learnMethod:'machine',
  learnMethodId:4,
  targetGeneration:3,
  releasedMachines:0
} as const);

export type KantoTmPreviewHit =Readonly<{hits:2|3|4|5;weight:number}>;

export const KANTO_TM09_PREVIEW=Object.freeze({
  machineNumber:9,
  tmId:'tm09',
  itemId:313,
  moveId:331,
  moveName:'bullet-seed',
  learnMethod:'machine',
  versionGroup:'firered-leafgreen',
  versionGroupId:7,
  targetGeneration:3,
  type:'grass',
  category:'special',
  powerPerHit:10,
  pp:30,
  accuracy:100,
  priority:0,
  hitWeights:Object.freeze([
    Object.freeze({hits:2,weight:3}),
    Object.freeze({hits:3,weight:3}),
    Object.freeze({hits:4,weight:1}),
    Object.freeze({hits:5,weight:1})
  ] as const satisfies readonly KantoTmPreviewHit[]),
  // Em nenhum caso um preview define o que pode ser ensinado ou equipado.
  state:'not-released',
  speciesCompatibility:'verified-read-only',
  inventoryEconomy:'not-implemented'
} as const);

/**
 * Não confundir preview histórico com KANTO_BATTLE_MOVES.
 * NUNCA retornar um KantoMove executável desta função.
 */
export function kantoTmPreview(tmId:string):typeof KANTO_TM09_PREVIEW|null{
  return tmId===KANTO_TM09_PREVIEW.tmId?KANTO_TM09_PREVIEW:null;
}

/**
 * Fail-closed explícito: o CSV completo de compatibilidade por espécie,
 * inventário e writer ainda não estão disponíveis. Nunca inferir que
 * "Bulbasaur pode aprender TM09" apenas por tipo ou por prévia de SP.
 */
const ENABLED_MACHINE_IDS:ReadonlySet<string>=new Set();
// Nenhuma TM liberada. Somente confirmar elegibilidade não bastará no futuro:
// exigir também estoque, versão e escrita atômica no writer.
export function kantoTmIsTeachEnabled(tmId:string,speciesId:number):boolean{
  return kantoTmPreview(tmId)!==null&&Number.isSafeInteger(speciesId)
    &&speciesId>=1&&speciesId<=151
    &&ENABLED_MACHINE_IDS.has(tmId);
}

/** Valor esperado calculado dos pesos históricos, não heurística SP D-039. */
export function kantoTmPreviewMeanHits(tmId:string):number{
  const move=kantoTmPreview(tmId);
  if(!move)throw new RangeError('TM inexistente.');
  const total=move.hitWeights.reduce((sum,x)=>sum+x.weight,0);
  return move.hitWeights.reduce((sum,x)=>sum+x.hits*x.weight,0)/total;
}

/**
 * Seleção determinística para TESTES de distribuição (sem consumir seed).
 * Não participa de simulateKantoBattle, não tem efeitos no jogo ou PP/SP.
 * No futuro o motor forneceria 1 roll PRÓPRIO da seed por ação efetiva.
 */
export function kantoTmPreviewHitCount(tmId:string,roll:number):number{
  const move=kantoTmPreview(tmId);
  if(!move||!Number.isFinite(roll)||roll<0||roll>=1)
    throw new RangeError('TM ou rolagem inválida.');
  const total=move.hitWeights.reduce((sum,x)=>sum+x.weight,0);
  let position=roll*total;
  for(const x of move.hitWeights){
    if(position<x.weight)return x.hits;
    position-=x.weight;
  }
  throw new RangeError('Distribuição inválida.');
}
