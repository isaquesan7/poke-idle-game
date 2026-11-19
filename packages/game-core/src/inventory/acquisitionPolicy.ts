/**
 * D-054 — política fechada de fontes para futura economia.
 * Isto não cria drops, itens, preços, inventário ou comandos de loja.
 *
 * Decisão de produto: equipamentos, expansores, Pokébolas e cura
 * SOMENTE são adquiridos por compra na Loja. Raridades não excepcionam
 * essa regra; crafting/drop são reservados a materiais/outros produtos
 * especificamente catalogados no futuro.
 */
export const INVENTORY_ACQUISITION_POLICY_VERSION=1 as const;
export const STORE_EXCLUSIVE_ITEM_KINDS=[
  'equipment','bag-expansion','pokeball','healing'
] as const;
export type StoreExclusiveItemKind=typeof STORE_EXCLUSIVE_ITEM_KINDS[number];
export type AcquisitionSource='shop'|'drop'|'craft';

export function isStoreExclusiveItemKind(value:unknown):value is StoreExclusiveItemKind{
  return typeof value==='string'&&
    (STORE_EXCLUSIVE_ITEM_KINDS as readonly string[]).includes(value);
}

/** Falha fechado para categoria não conhecida ou origem não autorizada. */
export function canAcquireItemFromSource(
  kind:unknown,source:unknown
):boolean{
  if(source!=='shop'&&source!=='drop'&&source!=='craft')return false;
  if(isStoreExclusiveItemKind(kind))return source==='shop';
  // Materiais/refinados não estão catalogados neste estágio:
  // suas fontes só serão liberadas quando houver receita/drop registrado.
  return false;
}
