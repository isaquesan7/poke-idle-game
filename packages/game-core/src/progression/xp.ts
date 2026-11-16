import { points } from '../stats/types.js';
export type ProgressionKind = 'trainer' | 'pokemon';
export interface LevelProgress { readonly level: number; readonly xp: number }
export interface XpResult extends LevelProgress { readonly gainedLevels: number }

/** Limiar da v0.1 (provisório), sem reinterpretar o balanceamento aprovado. */
export function xpThreshold(kind: ProgressionKind, level: number): number {
  const L = points(level, 'level');
  if (L < 1 || L > 100) throw new RangeError('Nível inválido');
  return kind === 'trainer' ? 95 + L * 27 : 65 + L * 22;
}

/** Progressão pura e determinística, sem alterar o objeto original. */
export function grantXp(kind: ProgressionKind, progress: LevelProgress, awardedXp: number): XpResult {
  let level = points(progress.level, 'level');
  let xp = points(progress.xp, 'xp') + points(awardedXp, 'awardedXp');
  if (level < 1 || level > 100) throw new RangeError('Nível inválido');
  let gainedLevels = 0;
  while (level < 100 && xp >= xpThreshold(kind, level)) {
    xp -= xpThreshold(kind, level);
    level++;
    gainedLevels++;
  }
  if (level === 100) xp = 0;
  return { level, xp, gainedLevels };
}
