/**
 * D-049: allowlist de leitura, verificada diretamente no Git blob oficial.
 * Origem: PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a
 * data/v2/csv/pokemon_moves.csv, blob SHA-1:
 * f66f614adf535af6940c65f434efe5ddeec4687a
 *
 * Colunas: pokemon_id,version_group_id,move_id,pokemon_move_method_id.
 * Filtro: pokemon 1..151, grupo7(FRLG), move331(Bullet Seed), method4(TM).
 * 665810 linhas de dados, 15 linhas e 15 espécies Kanto distintas,
 * 29 linhas de outras espécies no mesmo filtro TM.
 *
 * Este catálogo não distribui itens, NÃO libera ensino e não é checagem de
 * posse/estoque. Gate de lançamento separado continua fechado em D-049.
 */
export const KANTO_TM09_COMPATIBILITY_SOURCE = Object.freeze({
  commit:'ac2f1acb055026e3dff1e0aca743bb46256a810a',
  blobSha1:'f66f614adf535af6940c65f434efe5ddeec4687a',
  versionGroupId:7,moveId:331,learnMethodId:4,
  kantoMatchingRows:15,
  nonKantoMatchingRows:29,
  state:'verified-read-only'
} as const);

export const KANTO_TM09_COMPATIBLE_SPECIES = Object.freeze([
  1,2,3,43,44,45,46,47,69,70,71,102,103,114,151
] as const);

/** Aptidão da espécie à TM09 na versão FRLG; não concede TM nem ensino. */
const TM09_SPECIES_SET:ReadonlySet<number> = new Set(KANTO_TM09_COMPATIBLE_SPECIES);

export function kantoTm09SpeciesCompatible(speciesId:number):boolean {
  return Number.isSafeInteger(speciesId) && TM09_SPECIES_SET.has(speciesId);
}
