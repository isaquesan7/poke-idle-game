import {describe,it,expect} from 'vitest';
import {
  BASE_BAG_SLOTS,inspectInventoryOwnership,inventorySlotsUsed,
  inventorySlotsAvailable,mayEquipOwnedItem
} from '../src/inventory/ownership.js';

describe('D053 — propriedade segura de equipamento (projeto offline)',()=>{
  it('distingue save legado de propriedade nula; nunca concede catálogo por omissão',()=>{
    expect(inspectInventoryOwnership(undefined)).toEqual({status:'legacy-untracked'});
    expect(inspectInventoryOwnership(null).status).toBe('invalid');
  });
  it('aceita somente registros versionados com IDs de equipamento e quantidades positivas',()=>{
    const ok=inspectInventoryOwnership({version:1,ownedEquipment:{cap:1,gloves:2},extraBagSlots:0});
    expect(ok.status).toBe('valid');
    if(ok.status!=='valid')return;
    expect(mayEquipOwnedItem('cap','hat',ok.inventory)).toBe(true);
    expect(mayEquipOwnedItem('cap','jacket',ok.inventory)).toBe(false);
    expect(mayEquipOwnedItem('ring-a','ring1',ok.inventory)).toBe(false);
    for(const bad of [
      {version:2,ownedEquipment:{cap:1},extraBagSlots:0},
      {version:1,ownedEquipment:{unknown:1},extraBagSlots:0},
      {version:1,ownedEquipment:{cap:0},extraBagSlots:0},
      {version:1,ownedEquipment:{cap:1.5},extraBagSlots:0},
      {version:1,ownedEquipment:{cap:1},extraBagSlots:-1},
      {version:1,ownedEquipment:{cap:1},extraBagSlots:1001}
    ])expect(inspectInventoryOwnership(bad).status).toBe('invalid');
  });
  it('conta pilhas reais, preserva sobrecapacidade e não esconde itens',()=>{
    expect(BASE_BAG_SLOTS).toBe(10);
    expect(inventorySlotsUsed({'fire-stone':4,'water-stone':0,'thunder-stone':2})).toBe(2);
    expect(inventorySlotsAvailable(2,0)).toBe(8);
    expect(inventorySlotsAvailable(13,0)).toBe(0);
    expect(inventorySlotsAvailable(13,5)).toBe(2);
    expect(inventorySlotsAvailable(-1,0)).toBe(null);
    expect(inventorySlotsAvailable(0,-1)).toBe(null);
  });
});
