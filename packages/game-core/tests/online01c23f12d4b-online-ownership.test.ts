import {describe,it,expect} from 'vitest';
import {createOnlineDropGear,inspectOnlineGear,inspectOnlineInventory,onlineGearForSlot} from '../src/inventory/onlineOwnership.js';
import type {ProceduralGearRoll} from '../src/inventory/regionalLoot.js';
const roll:ProceduralGearRoll={templateId:'cap',slot:'hat',rarity:'rare',regionId:6,requiredLevel:50,stats:{hp:6,specialAttack:5}};
const id='00000000-0000-4000-8000-000000000001';
describe('D4B individual online gear contract',()=>{
 it('uses deterministic encounter identity and validates slots/level',()=>{
  const gear=createOnlineDropGear(id,roll)!;
  expect(gear.id).toBe('gear-'+id);
  expect(createOnlineDropGear(id,roll)).toEqual(gear);
  expect(createOnlineDropGear('client-input',roll)).toBeNull();
  const another=createOnlineDropGear('00000000-0000-4000-8000-000000000002',{...roll,stats:{attack:5,speed:6}})!;
  const bag=inspectOnlineInventory({version:1,extraBagSlots:0,gear:[gear,another]})!;
  expect(bag.gear).toHaveLength(2);
  expect(onlineGearForSlot(bag,gear.id,'hat',49)).toBeNull();
  expect(onlineGearForSlot(bag,gear.id,'hat',50)).toEqual(gear);
  expect(onlineGearForSlot(bag,gear.id,'jacket',100)).toBeNull();
  expect(inspectOnlineInventory({...bag,gear:[gear,gear]})).toBeNull();
  expect(inspectOnlineInventory({version:1,extraBagSlots:0,ownedEquipment:{cap:1}})).toBeNull();
 });
 it('rejects impossible rarity, stats, provenance and extra fields',()=>{
  const gear=createOnlineDropGear(id,roll)!;
  for(const patch of [{regionId:1},{requiredLevel:51},{rarity:'legendary'},
   {stats:{hp:99,specialAttack:5}},{stats:{hp:6}},{stats:{hp:6,specialAttack:5,speed:5}},
   {slot:'jacket'},{source:'shop'},{quantity:2},{stats:{hp:6,unknown:5}}])
    expect(inspectOnlineGear({...gear,...patch})).toBeNull();
 });
});