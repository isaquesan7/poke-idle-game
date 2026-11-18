/**
 * D-045 — recorte fechado de golpes com acertos múltiplos executáveis.
 * Double Kick (ID 24) atinge exatamente 2 vezes em FireRed/LeafGreen.
 * NUNCA inferir vários acertos apenas do power ou PP de um golpe arbitrário.
 * Bullet Seed continua apenas prévia e não está neste registro.
 *
 * Fonte: snapshot PokéAPI PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a
 * (moves.csv + move_meta.csv), e FRLG learnsets verificáveis em
 * https://pokemondb.net/pokedex/nidoran-m/moves/3
 */
export const KANTO_MULTI_HIT_MOVES:Readonly<Record<string,Readonly<{
  minHits:number;maxHits:number;
}>>> = Object.freeze({
  'double-kick':Object.freeze({minHits:2,maxHits:2})
});

/** Acertos por execução bem-sucedida. No recorte D-045, só há faixa fixa. */
export function kantoMoveHitCount(name:string):number{
  return KANTO_MULTI_HIT_MOVES[name]?.minHits ?? 1;
}
