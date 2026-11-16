/** Adaptação somente de LEITURA para o save da v0.1. Nenhuma migração nesta fase. */
export const LEGACY_SAVE_KEY = 'kanto-idle-lab-save-v01';
export const LEGACY_CACHE_KEY = 'kanto-idle-lab-cache-v01';

export interface LegacyPokemon {
  readonly uid: number;
  readonly pokemonId: number;
  readonly level: number;
  readonly affinity: number;
  readonly [key: string]: unknown;
}

export interface LegacySave {
  readonly version: 1;
  readonly name: string;
  readonly coins: number;
  readonly trainer: { readonly level: number; readonly [key: string]: unknown };
  readonly roster: readonly LegacyPokemon[];
  readonly team: readonly number[];
  readonly badges: readonly string[];
  readonly [key: string]: unknown;
}

export type LegacySaveResult =
  | { readonly status: 'valid'; readonly raw: string; readonly save: LegacySave }
  | { readonly status: 'absent' | 'invalid' | 'unsupported' | 'unavailable' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNatural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Preserva o JSON ORIGINAL para backup, não normaliza nem grava progresso. */
export function parseLegacySave(raw: string | null): LegacySaveResult {
  if (raw === null) return { status: 'absent' };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { status: 'invalid' }; }
  if (!isRecord(value)) return { status: 'invalid' };
  if (value.version !== 1) return { status: 'unsupported' };
  if (!isRecord(value.trainer) || !isNatural(value.trainer.level)
    || value.trainer.level < 1 || value.trainer.level > 100
    || typeof value.name !== 'string' || !isNatural(value.coins)
    || !Array.isArray(value.roster) || value.roster.length === 0
    || !Array.isArray(value.team) || !Array.isArray(value.badges)
    || !value.team.every(isNatural) || !value.badges.every(x => typeof x === 'string')) {
    return { status: 'invalid' };
  }
  if (!value.roster.every(p => isRecord(p)
    && isNatural(p.uid) && isNatural(p.pokemonId)
    && isNatural(p.level) && p.level >= 1 && p.level <= 100
    && isNatural(p.affinity) && p.affinity <= 100)) {
    return { status: 'invalid' };
  }
  return { status: 'valid', raw, save: value as unknown as LegacySave };
}

/** Recebe função de leitura injetada para testar sem DOM/localStorage reais. */
export function readLegacySave(getItem: (key: string) => string | null): LegacySaveResult {
  try { return parseLegacySave(getItem(LEGACY_SAVE_KEY)); }
  catch { return { status: 'unavailable' }; }
}
