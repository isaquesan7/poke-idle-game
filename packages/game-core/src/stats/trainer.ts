import { STATS, points, zeroStats } from './types.js';
import type { Stat, StatBonus, StatValues } from './types.js';

export type EquipmentSlot = 'hat' | 'jacket' | 'gloves' | 'pants' | 'shoes'
  | 'necklace' | 'ring1' | 'ring2' | 'earrings';

export interface EquippedBonus { readonly slot: EquipmentSlot; readonly stats: StatBonus }
export interface BadgeBonus { readonly id: string; readonly stats: StatBonus }
export interface TrainerSources {
  readonly manual: Readonly<StatValues>;
  readonly equipment: readonly EquippedBonus[];
  readonly activeTitle?: StatBonus | null; // exatamente um título ativo no estado
  readonly badges: readonly BadgeBonus[]; // TODAS as insígnias conquistadas
}

export const MANUAL_TRAINER_CAP = 40;

/** GDD: teto 40 somente para pontos MANUAIS; equipamentos, título e insígnias acumulam. */
export function trainerTotals(input: TrainerSources): StatValues {
  const result = zeroStats();
  for (const stat of STATS) {
    const amount = points(input.manual[stat], 'manual.' + stat);
    if (amount > MANUAL_TRAINER_CAP) throw new RangeError('Máximo manual de 40 em ' + stat);
    result[stat] = amount;
  }

  function addBonus(bonus: StatBonus): void {
    for (const stat of STATS) {
      result[stat] += points(bonus[stat] ?? 0, 'bonus.' + stat);
    }
  }

  const slots = new Set<EquipmentSlot>();
  for (const item of input.equipment) {
    if (slots.has(item.slot)) throw new RangeError('Slot de equipamento duplicado: ' + item.slot);
    slots.add(item.slot);
    addBonus(item.stats);
  }
  if (input.activeTitle) addBonus(input.activeTitle);

  // Insígnias NÃO possuem slot ativo. IDs repetidos não podem gerar bônus dobrado.
  const badgeIds = new Set<string>();
  for (const badge of input.badges) {
    if (badgeIds.has(badge.id)) continue;
    badgeIds.add(badge.id);
    addBonus(badge.stats);
  }
  return result;
}

/** Impede novas distribuições acima do teto sem bloquear os bônus externos. */
export function canInvestTrainerPoint(
  manual: Readonly<StatValues>, stat: Stat, unspentPoints: number
): boolean {
  return points(unspentPoints, 'unspentPoints') > 0
    && points(manual[stat], 'manual.' + stat) < MANUAL_TRAINER_CAP;
}
