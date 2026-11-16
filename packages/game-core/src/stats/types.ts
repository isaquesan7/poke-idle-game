/** Atributos oficiais da regra do laboratório (não confundir com base_stat da API). */
export const STATS = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const;
export type Stat = (typeof STATS)[number];
export type StatValues = Record<Stat, number>;
export type StatBonus = Partial<StatValues>;

/** Cria uma instância independente para impedir compartilhamento de mutações. */
export function zeroStats(): StatValues {
  return { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
}

/** Valida pontos recebidos no limite do core; não arredonda silenciosamente. */
export function points(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(label + ' deve ser inteiro não negativo');
  }
  return value;
}
