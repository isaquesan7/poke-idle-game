import { KANTO_FRLG_MOVE_META } from './kantoFrlgLevelupSnapshot.js';
/**
 * PP por movimento em snapshot fixo de PokeAPI/pokeapi (moves.csv).
 * Origem: https://github.com/PokeAPI/pokeapi/blob/ac2f1acb055026e3dff1e0aca743bb46256a810a/data/v2/csv/moves.csv
 * Blob SHA: a55116329ca22f230fea953de94c2d1dffe2ad0e
 * Cobre TODOS os movimentos atualmente executáveis da Arena v0.2,
 * incluindo Double Kick e Recover (D-045). PP é do CSV PokéAPI atual,
 * não PP histórico da cartucha FireRed/LeafGreen.
 * PP é dado OFICIAL por golpe; custo de SP é REGRA PRÓPRIA do Idle.
 * Consultas não acontecem durante combate/replay, para manter determinismo.
 */
export const KANTO_PP_SOURCE_COMMIT='ac2f1acb055026e3dff1e0aca743bb46256a810a';
export const KANTO_PP_SOURCE_BLOB='a55116329ca22f230fea953de94c2d1dffe2ad0e';
export const KANTO_MOVE_PP:Readonly<Record<string,number>>={
  // Novo snapshot publicado na D064AO: PP oficial atual dos golpes FRLG
  // de level-up (os valores anteriores abaixo têm prioridade explícita).
  ...Object.fromEntries(Object.values(KANTO_FRLG_MOVE_META)
    .filter(meta=>meta.pp!==null&&meta.pp>0)
    .map(meta=>[meta.name,meta.pp!])),
  // Historical TM and NPC signature PP. Eligibility is defined separately.
  'bullet-seed':30,
  'dragon-claw':15,
  'bulk-up':20,
  'sunny-day':5,
  'solar-beam':10,
  dig:10,
  'hyper-beam':5,
  rest:5,
  return:20,
  frustration:20,
  facade:20,
  'focus-punch':20,
  taunt:20,
  'double-team':15,
  'ice-beam':10,
  blizzard:5,
  'rain-dance':5,
  'sandstorm':10,
  'hail':10,
  'thunder':10,
  'reflect':20,
  'light-screen':30,
  'safeguard':25,
  'protect':10,
  'brick-break':15,
  'steel-wing':25,
  'overheat':5,
  'toxic':10,
  'calm-mind':20,
  'rock-tomb':10,
  'water-pulse':20,
  'shock-wave':20,
  'absorb':25,
  'bubble':30,
  'drill-peck':20,
  'double-kick':30,
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
  'recover':5,
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
