/** Recompensas de laboratório; futura autoridade transacional será o backend. */
export interface ExpeditionRewards {
  readonly cycles: number;
  readonly coins: number;
  readonly trainerXp: number;
  readonly pokemonXpPerMember: number;
  readonly affinityGainPerMember: number;
}
export const EXPEDITION_CYCLE_MS = 10000;
export const MAX_EXPEDITION_CYCLES = 2880; // 8h de 10 em 10 segundos

/** Só calcula valores; não concede recompensas nem grava localStorage. */
export function expeditionRewards(elapsedMs: number): ExpeditionRewards {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const cycles = Math.min(MAX_EXPEDITION_CYCLES, Math.floor(elapsed / EXPEDITION_CYCLE_MS));
  return {
    cycles,
    coins: cycles * 7,
    trainerXp: cycles * 4,
    pokemonXpPerMember: cycles * 5,
    affinityGainPerMember: Math.floor(cycles / 3)
  };
}
