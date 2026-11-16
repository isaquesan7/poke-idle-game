import { points } from '../stats/types.js';

/** Afinidade acompanha a instância do Pokémon e sempre fica entre 0 e 100. */
export function clampAffinity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(value)));
}

/** Taxa de 8% até 10% do TOTAL do treinador, nunca do próprio Pokémon. */
export function affinityRate(affinity: number): number {
  return 0.08 + 0.02 * clampAffinity(affinity) / 100;
}

/** Bônus ADITIVO em pontos com arredondamento para baixo (GDD). */
export function trainerContribution(total: number, affinity: number): number {
  return Math.floor(points(total, 'trainerTotal') * affinityRate(affinity));
}
