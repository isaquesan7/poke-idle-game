import { trainerContribution } from '../affinity/affinity.js';
import { STATS, points, zeroStats } from './types.js';
import type { StatValues } from './types.js';

/** Status próprio, mantendo intocados os base_stat normalizados da PokéAPI. */
export function pokemonOwnStats(
  base: Readonly<StatValues>, level: number, manual: Readonly<StatValues>
): StatValues {
  const L = points(level, 'level');
  if (L < 1 || L > 100) throw new RangeError('Nível deve estar entre 1 e 100');
  const result = zeroStats();
  for (const stat of STATS) {
    const baseStat = points(base[stat], 'base.' + stat);
    const invested = points(manual[stat], 'manual.' + stat);
    const scaled = Math.floor(2 * baseStat * L / 100);
    result[stat] = stat === 'hp'
      ? scaled + L + 10 + 2 * invested
      : scaled + 5 + invested;
  }
  return result;
}

/** Soma ao próprio Pokémon os pontos de cada atributo TOTAL do treinador. */
export function pokemonFinalStats(
  base: Readonly<StatValues>, level: number, manual: Readonly<StatValues>,
  trainer: Readonly<StatValues>, affinity: number
): StatValues {
  const result = pokemonOwnStats(base, level, manual);
  for (const stat of STATS) result[stat] += trainerContribution(trainer[stat], affinity);
  return result;
}
