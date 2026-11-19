/**
 * D-053 — contrato puro e SOMENTE LEITURA de propriedade/capacidade.
 *
 * NÃO é a concessão de itens, uma migração de saves nem um mecanismo de loja.
 * A v0.2 preserva o catálogo de teste até que exista uma fonte de aquisição
 * autorizada, writer atômico e migração aprovada para contas existentes.
 */
import {LEGACY_ITEMS} from '../legacy/catalog.js';

export const BASE_BAG_SLOTS=10;
export interface InventoryOwnershipV1 {
  readonly version:1;
  readonly ownedEquipment:Readonly<Record<string,number>>;
  readonly extraBagSlots:number;
}
export type InventoryOwnershipRead=
  | {readonly status:'legacy-untracked'}
  | {readonly status:'valid';readonly inventory:InventoryOwnershipV1}
  | {readonly status:'invalid';readonly reason:string};

const knownItems=new Set(LEGACY_ITEMS.map(item=>item.id));
const isCount=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;

/** Ausência não é "zero itens" nem prova de posse. Saves antigos não têm ledger. */
export function inspectInventoryOwnership(value:unknown):InventoryOwnershipRead{
  if(value===undefined)return{status:'legacy-untracked'};
  if(value===null||typeof value!=='object'||Array.isArray(value))
    return{status:'invalid',reason:'Registro de inventário inválido.'};
  const record=value as Record<string,unknown>;
  if(record.version!==1||!isCount(record.extraBagSlots)||
     record.extraBagSlots>1000||
     record.ownedEquipment===null||typeof record.ownedEquipment!=='object'||
     Array.isArray(record.ownedEquipment)){
    return{status:'invalid',reason:'Versão, capacidade ou equipamentos inválidos.'};
  }
  const entries=Object.entries(record.ownedEquipment as Record<string,unknown>);
  if(entries.some(([id,count])=>!knownItems.has(id)||!isCount(count)||count===0))
    return{status:'invalid',reason:'Equipamento não catalogado ou quantidade inválida.'};
  return{status:'valid',inventory:{
    version:1,
    ownedEquipment:Object.fromEntries(entries) as Record<string,number>,
    extraBagSlots:record.extraBagSlots as number
  }};
}
/** Conta pilhas, não quantidades individuais; não desaparece com sobrecapacidade. */
export function inventorySlotsUsed(stacks:Readonly<Record<string,number>>):number{
  return Object.values(stacks).filter(q=>Number.isSafeInteger(q)&&q>0).length;
}
export function inventorySlotsAvailable(used:number,extraSlots:number):number|null{
  if(!isCount(used)||!isCount(extraSlots)||extraSlots>1000)return null;
  return Math.max(0,BASE_BAG_SLOTS+extraSlots-used);
}
/** Só terá efeito no writer depois de migrar e autorizar a aquisição real. */
export function mayEquipOwnedItem(
  itemId:string,slot:string,owned:InventoryOwnershipV1
):boolean{
  const item=LEGACY_ITEMS.find(entry=>entry.id===itemId);
  return Boolean(item&&item.slot===slot&&(owned.ownedEquipment[itemId]??0)>0);
}
