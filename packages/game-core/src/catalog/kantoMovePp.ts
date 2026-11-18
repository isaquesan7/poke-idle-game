/**
 * PP por movimento em snapshot fixo de PokeAPI/pokeapi (moves.csv).
 * Origem: https://github.com/PokeAPI/pokeapi/blob/ac2f1acb055026e3dff1e0aca743bb46256a810a/data/v2/csv/moves.csv
 * Blob SHA: a55116329ca22f230fea953de94c2d1dffe2ad0e
 * Cobre TODOS os movimentos atualmente executáveis da Arena v0.2.
 * PP é dado OFICIAL por golpe; custo de SP é REGRA PRÓPRIA do Idle.
 * Consultas não acontecem durante combate/replay, para manter determinismo.
 */
export const KANTO_PP_SOURCE_COMMIT='ac2f1acb055026e3dff1e0aca743bb46256a810a';
export const KANTO_PP_SOURCE_BLOB='a55116329ca22f230fea953de94c2d1dffe2ad0e';
export const KANTO_MOVE_PP:Readonly<Record<string,number>>={
  'absorb':25,
  'bubble':30,
  'drill-peck':20,
  'egg-bomb':10,
  'ember':25,
  'growl':40,
  'gust':35,
  'horn-attack':25,
  'hydro-pump':5,
  'hyper-voice':10,
  'mega-kick':5,
  'mega-punch':20,
  'megahorn':10,
  'peck':35,
  'poison-powder':35,
  'poison-sting':35,
  'pound':35,
  'quick-attack':30,
  'rock-throw':15,
  'scratch':35,
  'slam':20,
  'tackle':35,
  'tail-whip':30,
  'thunder-shock':30,
  'thunder-wave':20,
  'vice-grip':30,
  'vine-whip':25,
  'water-gun':25,
  'wing-attack':35
};
