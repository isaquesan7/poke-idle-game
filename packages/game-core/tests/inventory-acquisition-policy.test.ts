import {describe,it,expect} from 'vitest';
import {
  INVENTORY_ACQUISITION_POLICY_VERSION,STORE_EXCLUSIVE_ITEM_KINDS,
  isStoreExclusiveItemKind,canAcquireItemFromSource
} from '../src/inventory/acquisitionPolicy.js';

describe('D054 — itens exclusivos de compra na loja',()=>{
  it('documenta exatamente as quatro categorias decididas',()=>{
    expect(INVENTORY_ACQUISITION_POLICY_VERSION).toBe(1);
    expect([...STORE_EXCLUSIVE_ITEM_KINDS]).toEqual([
      'equipment','bag-expansion','pokeball','healing'
    ]);
  });
  it.each(STORE_EXCLUSIVE_ITEM_KIN)(
    '%s: permite loja e proíbe drop/criação',kind=>{
      expect(isStoreExclusiveItemKind(kind)).toBe(true);
      expect(canAcquireItemFromSource(kind,'shop')).toBe(true);
      expect(canAcquireItemFromSource(kind,'drop')).toBe(false);
      expect(canAcquireItemFromSource(kind,'craft')).toBe(false);
    }
  );
  it('não libera materiais ou fontes desconhecidas antes do catálogo de drops/receitas',()=>{
    for(const kind of ['material','refined-material','tm','unknown',undefined,null]){
      for(const source of ['shop','drop','craft','quest',undefined]){
        expect(canAcquireItemFromSource(kind,source)).toBe(false);
      }
    }
  });
});
