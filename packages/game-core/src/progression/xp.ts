import { points } from '../stats/types.js';
export type ProgressionKind = 'trainer' | 'pokemon';
export interface LevelProgress { readonly level: number; readonly xp: number }
export interface XpResult extends LevelProgress { readonly gainedLevels: number }

/** D-064AJ: treinador tem curva quadrática de longo prazo; Pokémon mantém a curva existente. */
export function xpThreshold(kind: ProgressionKind, level: number): number {
  const L = points(level, 'level');
  if (L < 1 || L > 100) throw new RangeError('Nível inválido');
  return kind === 'trainer' ? 140 + L * 35 + Math.ceil(3.5 * L * L) : 65 + L * 22;
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

/** XP de uma vitória contra selvagem: reduz a aceleração do treinador em áreas avançadas.
 * A mesma função alimenta o recibo e a interface, evitando exibir prêmios diferentes.
 */
export function battleTrainerXp(wildLevel:number):number {
  if(!Number.isSafeInteger(wildLevel)||wildLevel<2||wildLevel>100){
    throw new RangeError('Nível selvagem inválido para XP do treinador.');
  }
  return 50+3*wildLevel;
}
