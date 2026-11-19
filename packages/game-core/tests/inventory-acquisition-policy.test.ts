import {describe,it,expect} from 'vitest';
import {
  INVENTORY_ACQUISITION_POLICY_VERSION,STORE_EXCLUSIVE_ITEM_KINDS,
  isStoreExclusiveItemKind,canAcquireItemFromSource
} from '../src/inventory/acquisitionPolicy.js';

describe('D054 — elegibilidade das fontes de equipamento e exclusivos da loja',()=>{
  it('separa equipamentos dos três grupos exclusivos da Loja',()=>{
    expect(INVENTORY_ACQUISITION_POLICY_VERSION).toBe(2);
    expect([...STORE_EXCLUSIVE_ITEM_KINDS]).toEqual([
      'bag-expansion','pokeball','healing'
    ]);
    expect(isStoreExclusiveItemKind('equipment')).toBe(false);
  });
  it('equipamento pode ter origem Loja, drop ou crafting, dependendo de futuro catálogo',()=>{
    for(const source of ['shop','drop','craft'])
      expect(canAcquireItemFromSource('equipment',source)).toBe(true);
    expect(canAcquireItemFromSource('equipment','quest')).toBe(false);
  });
  it.each(STORE_EXCLUSIVE_ITEM_KINDS)(
    '%s: somente Loja; proíbe drop/criação',kind=>{
      expect(isStoreExclusiveItemKind(kind)).toBe(true);
      expect(canAcquireItemFromSource(kind,'shop')).toBe(true);
      expect(canAcquireItemFromSource(kind,'drop')).toBe(false);
      expect(canAcquireItemFromSource(kind,'craft')).toBe(false);
    }
  );
  it('não libera materiais ou categorias desconhecidas antes dos respectivos catálogos',()=>{
    for(const kind of ['material','refined-material','tm','unknown',undefined,null]){
      for(const source of ['shop','drop','craft','quest',undefined])
        expect(canAcquireItemFromSource(kind,source)).toBe(false);
    }
  });
});
