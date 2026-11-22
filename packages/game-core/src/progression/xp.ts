import { points } from '../stats/types.js';
export type ProgressionKind = 'trainer' | 'pokemon';
export interface LevelProgress { readonly level: number; readonly xp: number }
export interface XpResult extends LevelProgress { readonly gainedLevels: number }

/**
 * D064BM: curva Pokémon preserva exatamente os níveis 1–20 da alfa anterior.
 * Acima do 20, o termo quadrático evita o líder superar a faixa de encontros
 * antes de o treinador alcançar o desbloqueio da próxima região. O treinador
 * continua usando a curva D064AJ original, sem qualquer XP retroativo.
 */
export function xpThreshold(kind: ProgressionKind, level: number): number {
  const L = points(level, 'level');
  if (L < 1 || L > 100) throw new RangeError('Nível inválido');
  if(kind === 'trainer')return 140 + L * 35 + Math.ceil(3.5 * L * L);
  const excess=Math.max(0,L-20);
  return 65 + L * 22 + 7 * excess * excess;
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


/** D064AZ: aprendizagem de um Pokémon recém-iniciado após derrota/empate.
 * Até alcançar o nível 2, quatro batalhas sem vitória são suficientes
 * para acumular 88 XP (limiar do Lv1: 87); depois é sempre zero.
 * Nunca concede XP de treinador, moedas, afinidade ou captura.
 */
export function beginnerBattleXp(pokemonLevel:number,outcome:'win'|'loss'|'draw'):number {
  if(!Number.isSafeInteger(pokemonLevel)||pokemonLevel<1||pokemonLevel>100)
    throw new RangeError('Nível do Pokémon inválido para aprendizagem inicial.');
  return pokemonLevel===1&&outcome!=='win'?22:0;
}
