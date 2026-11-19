/**
 * D-054 — elegibilidade das fontes (não é autorização de recompensa).
 *
 * Equipamentos: Loja, drop ou crafting, desde que a futura tabela de
 * itens/receitas/probabilidades autorize a operação específica.
 * Expansor de Mochila, Pokébolas e cura: EXCLUSIVOS da Loja.
 *
 * Ainda não há preços, raridades, receitas ou tabelas de drop.
 * Esta política de categoria NÃO autoriza grants ao jogador.
 */
export const INVENTORY_ACQUISITION_POLICY_VERSION=2 as const;
export const STORE_EXCLUSIVE_ITEM_KINDS=[
  'bag-expansion','pokeball','healing'
] as const;
export type StoreExclusiveItemKind=typeof STORE_EXCLUSIVE_ITEM_KINDS[number];
export type AcquisitionSource='shop'|'drop'|'craft';

export function isStoreExclusiveItemKind(value:unknown):value is StoreExclusiveItemKind{
  return typeof value==='string'&&
    (STORE_EXCLUSIVE_ITEM_KINDS as readonly string[]).includes(value);
}

/** Elegibilidade ampla de categoria; não verifica item, chance, receita ou saldo. */
export function canAcquireItemFromSource(kind:unknown,source:unknown):boolean{
  if(source!=='shop'&&source!=='drop'&&source!=='craft')return false;
  if(kind==='equipment')return true;
  if(isStoreExclusiveItemKind(kind))return source==='shop';
  // Materiais/refinados sem catálogo permanecem sem fonte habilitada.
  return false;
}
