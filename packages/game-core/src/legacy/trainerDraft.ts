/**
 * Edição determinística do treinador no formato v0.1.
 * Produz OUTRO JSON; nunca acessa o DOM, localStorage, backend ou relógio.
 * Nenhuma concessão de XP, moedas, capturas ou insígnias é permitida aqui.
 */
import { STATS, zeroStats } from '../stats/types.js';
import type { Stat, StatValues } from '../stats/types.js';
import { canInvestTrainerPoint, MANUAL_TRAINER_CAP } from '../stats/trainer.js';
import type { EquipmentSlot } from '../stats/trainer.js';
import { LEGACY_ITEMS } from './catalog.js';

export type TrainerDraftAction =
  | { readonly type: 'invest'; readonly stat: Stat }
  | { readonly type: 'equip'; readonly slot: EquipmentSlot; readonly itemId: string };

export type TrainerDraftEditResult =
  | { readonly status: 'ok'; readonly json: string }
  | { readonly status: 'invalid'; readonly reason: string };

type AnyRecord = Record<string, unknown>;

function record(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function natural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseRecord(json: string): AnyRecord | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return record(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function manualPoints(trainer: AnyRecord): StatValues | null {
  if (!record(trainer.manual)) return null;
  const result = zeroStats();
  for (const stat of STATS) {
    const points = trainer.manual[stat] ?? 0;
    if (!natural(points) || points > MANUAL_TRAINER_CAP) return null;
    result[stat] = points;
  }
  return result;
}

function validBudget(level: unknown, manual: StatValues): boolean {
  if (!natural(level) || level < 1 || level > 100) return false;
  const spent = STATS.reduce((sum, stat) => sum + manual[stat], 0);
  return spent <= (level - 1) * 2;
}

/** Apenas estes nove slots podem receber IDs de itens do catálogo legado. */
export const LEGACY_EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'hat', 'jacket', 'gloves', 'pants', 'shoes',
  'necklace', 'ring1', 'ring2', 'earrings'
];

/** Valida a ação ANTES de escrever qualquer estado no rascunho. */
export function editLegacyTrainerJson(
  sourceJson: string, action: TrainerDraftAction
): TrainerDraftEditResult {
  const source = parseRecord(sourceJson);
  if (!source || source.version !== 1 || !record(source.trainer)) {
    return { status: 'invalid', reason: 'Save v0.1 não reconhecido.' };
  }
  const trainer = source.trainer;
  const manual = manualPoints(trainer);
  if (!manual || !validBudget(trainer.level, manual) || !record(trainer.manual) || !record(trainer.equipped)) {
    return { status: 'invalid', reason: 'Distribuição ou equipamentos inválidos no save.' };
  }
  if (action.type === 'invest') {
    if (!STATS.includes(action.stat)) {
      return { status: 'invalid', reason: 'Atributo desconhecido.' };
    }
    const available = (Number(trainer.level) - 1) * 2 -
      STATS.reduce((sum, stat) => sum + manual[stat], 0);
    if (!canInvestTrainerPoint(manual, action.stat, available)) {
      return { status: 'invalid', reason: 'Sem pontos disponíveis ou limite manual de 40 atingido.' };
    }
    trainer.manual[action.stat] = manual[action.stat] + 1;
  } else if (action.type === 'equip') {
    if (!LEGACY_EQUIPMENT_SLOTS.includes(action.slot)
      || (action.itemId !== '' && !LEGACY_ITEMS.some(item =>
        item.slot === action.slot && item.id === action.itemId))) {
      return { status: 'invalid', reason: 'Equipamento incompatível com o slot.' };
    }
    trainer.equipped[action.slot] = action.itemId;
  } else {
    return { status: 'invalid', reason: 'Ação não suportada no protótipo.' };
  }
  return { status: 'ok', json: JSON.stringify(source) };
}

/**
 * Verifica que um JSON de rascunho SÓ difere do legado em manual/equipped.
 * Não confia em campos de recompensa, nível, XP, UID ou título do rascunho.
 */
export function validLegacyTrainerDraft(sourceJson: string, editedJson: string): boolean {
  const source = parseRecord(sourceJson);
  const edited = parseRecord(editedJson);
  if (!source || !edited || source.version !== 1 || edited.version !== 1
    || !record(source.trainer) || !record(edited.trainer)
    || !record(source.trainer.manual) || !record(edited.trainer.manual)
    || !record(source.trainer.equipped) || !record(edited.trainer.equipped)) return false;

  const before = manualPoints(source.trainer);
  const after = manualPoints(edited.trainer);
  if (!before || !after || !validBudget(source.trainer.level, before)
    || !validBudget(edited.trainer.level, after)) return false;

  // Investimento manual só aumenta em atributos válidos; outros campos preservados.
  const manualBefore = source.trainer.manual;
  const manualAfter = edited.trainer.manual;
  const manualKeys = new Set([...Object.keys(manualBefore), ...Object.keys(manualAfter)]);
  for (const key of manualKeys) {
    if ((STATS as readonly string[]).includes(key)) {
      const stat = key as Stat;
      if (after[stat] < before[stat]) return false;
    } else if (JSON.stringify(manualBefore[key]) !== JSON.stringify(manualAfter[key])) return false;
  }

  // Troca de equipamento apenas nos slots do catálogo, nunca no inventário.
  const equipBefore = source.trainer.equipped;
  const equipAfter = edited.trainer.equipped;
  const equipKeys = new Set([...Object.keys(equipBefore), ...Object.keys(equipAfter)]);
  for (const key of equipKeys) {
    if (LEGACY_EQUIPMENT_SLOTS.includes(key as EquipmentSlot)) {
      const itemId = equipAfter[key];
      if (itemId !== equipBefore[key] && (
        typeof itemId !== 'string' ||
        itemId !== '' && !LEGACY_ITEMS.some(item => item.slot === key && item.id === itemId)
      )) return false;
    } else if (JSON.stringify(equipBefore[key]) !== JSON.stringify(equipAfter[key])) return false;
  }

  // Comparação integral de tudo que NÃO está dentro dos dois campos editáveis.
  const beforeRest = JSON.parse(sourceJson) as AnyRecord;
  const afterRest = JSON.parse(editedJson) as AnyRecord;
  const beforeTrainer = beforeRest.trainer as AnyRecord;
  const afterTrainer = afterRest.trainer as AnyRecord;
  delete beforeTrainer.manual;
  delete beforeTrainer.equipped;
  delete afterTrainer.manual;
  delete afterTrainer.equipped;
  return JSON.stringify(beforeRest) === JSON.stringify(afterRest);
}
