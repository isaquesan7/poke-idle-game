/**
 * D-054 — laboratório de transações do inventário, sem ativação no /play.
 *
 * Esta função é PURA: não confia no jogador, navegador ou relógio. Recebe
 * eventos PREVIAMENTE autorizados por uma camada ainda a implementar.
 * Idempotência/revisão não provam que a origem do evento é verdadeira.
 *
 * Nenhum botão, save writer ou recompensa usa este código nesta fase.
 */
import {LEGACY_ITEMS} from '../legacy/catalog.js';
import {LEGACY_EQUIPMENT_SLOTS} from '../legacy/trainerDraft.js';
import {inspectInventoryOwnership} from './ownership.js';
import type {InventoryOwnershipV1} from './ownership.js';

type RecordValue=Record<string,unknown>;
const isRecord=(v:unknown):v is RecordValue=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const natural=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const positive=(v:unknown):v is number=>natural(v)&&v>0;
const validEventId=(id:string)=>/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/.test(id);
const equipment=new Map(LEGACY_ITEMS.map(item=>[item.id,item]));
export const INVENTORY_EQUIPMENT_STACK_MAX=99;
export const INVENTORY_BAG_EXTRA_SLOTS_MAX=1000;

export type InventoryGrant=
  | {readonly kind:'equipment';readonly eventId:string;readonly itemId:string;readonly count:number}
  | {readonly kind:'bag-capacity';readonly eventId:string;readonly slots:number};

export interface InventoryGrantReceipt {
  readonly eventId:string;
  readonly payload:string;
}
export interface InventoryGrantJournal{
  readonly raw:string;
  readonly revision:number;
  readonly receipts:readonly InventoryGrantReceipt[];
}
export type InventoryGrantResult=
  | {readonly status:'applied'|'duplicate';readonly journal:InventoryGrantJournal}
  | {readonly status:'rejected';readonly reason:string;readonly journal:InventoryGrantJournal};

/** Migração EXPLÍCITA (não automática): preserva só equipamentos já em uso. */
export function planLegacyEquipmentMigration(raw:string):
  | {readonly status:'ready';readonly raw:string;readonly equippedIds:readonly string[]}
  | {readonly status:'already-migrated'|'invalid';readonly reason:string}{
  let parsed:unknown;
  try{parsed=JSON.parse(raw);}catch{return{status:'invalid',reason:'JSON inválido.'};}
  if(!isRecord(parsed)||parsed.version!==1||!isRecord(parsed.trainer)
    ||!isRecord(parsed.trainer.equipped))
    return{status:'invalid',reason:'Treinador legado inválido.'};
  const state=inspectInventoryOwnership(parsed.inventory);
  if(state.status==='valid')return{status:'already-migrated',reason:'Inventário já existente.'};
  if(state.status==='invalid')return{status:'invalid',reason:'Inventário atual inválido.'};
  const equipped=parsed.trainer.equipped;
  const owned:Record<string,number>=Object.create(null) as Record<string,number>;
  for(const [slot,itemId] of Object.entries(equipped)){
    if(!LEGACY_EQUIPMENT_SLOTS.includes(slot as typeof LEGACY_EQUIPMENT_SLOTS[number])
      ||typeof itemId!=='string')return{status:'invalid',reason:'Slot de equipamento inválido.'};
    if(itemId==='')continue;
    const item=equipment.get(itemId);
    if(!item||item.slot!==slot)return{status:'invalid',reason:'Equipamento legado não catalogado.'};
    owned[itemId]=1;
  }
  const inventory:InventoryOwnershipV1={
    version:1,ownedEquipment:owned,extraBagSlots:0
  };
  // Só é emitida uma proposta; nunca persiste ou altera o JSON de origem.
  return{status:'ready',raw:JSON.stringify({...parsed,inventory}),
    equippedIds:Object.keys(owned).sort()};
}

function payload(grant:InventoryGrant):string{
  return grant.kind==='equipment'
    ? JSON.stringify(['equipment',grant.itemId,grant.count])
    : JSON.stringify(['bag-capacity',grant.slots]);
}
function journalValid(j:InventoryGrantJournal):boolean{
  if(typeof j?.raw!=='string'||!natural(j.revision)
    ||!Array.isArray(j.receipts)||j.receipts.length!==j.revision)return false;
  const ids=new Set<string>();
  for(const receipt of j.receipts){
    if(!receipt||typeof receipt.eventId!=='string'||!validEventId(receipt.eventId)
      ||typeof receipt.payload!=='string'||ids.has(receipt.eventId))return false;
    ids.add(receipt.eventId);
  }
  return true;
}

/**
 * Prévia determinística e idempotente de grant autorizado.
 * NÃO chamar diretamente por botão/UI: ainda falta validar a fonte do evento.
 */
export function applyAuthorizedInventoryGrant(
  journal:InventoryGrantJournal,expectedRevision:number,grant:InventoryGrant
):InventoryGrantResult{
  const reject=(reason:string):InventoryGrantResult=>({status:'rejected',reason,journal});
  if(!journalValid(journal)||!natural(expectedRevision)
    ||typeof grant?.eventId!=='string'||!validEventId(grant.eventId))
    return reject('Journal, revisão ou identificador inválido.');
  const fingerprint=payload(grant);
  const existing=journal.receipts.find(r=>r.eventId===grant.eventId);
  if(existing){
    return existing.payload===fingerprint
      ?{status:'duplicate',journal}
      :reject('Conflito: evento repetido com recompensa diferente.');
  }
  if(expectedRevision!==journal.revision)return reject('Revisão desatualizada.');
  if(grant.kind==='equipment'){
    if(!equipment.has(grant.itemId)||!positive(grant.count)||grant.count>INVENTORY_EQUIPMENT_STACK_MAX)
      return reject('Equipamento ou quantidade não permitidos.');
  }else if(grant.kind==='bag-capacity'){
    if(!positive(grant.slots)||grant.slots>INVENTORY_BAG_EXTRA_SLOTS_MAX)
      return reject('Expansão inválida.');
  }else return reject('Tipo de recompensa não autorizado.');
  let state:unknown;
  try{state=JSON.parse(journal.raw);}catch{return reject('Save inválido.');}
  if(!isRecord(state)||state.version!==1)return reject('Formato legado desconhecido.');
  const parsed=inspectInventoryOwnership(state.inventory);
  if(parsed.status!=='valid')return reject('É necessário migrar e verificar o inventário antes da concessão.');
  const inventory=parsed.inventory;
  let next:InventoryOwnershipV1;
  if(grant.kind==='equipment'){
    const current=inventory.ownedEquipment[grant.itemId]??0;
    if(!natural(current)||current+grant.count>INVENTORY_EQUIPMENT_STACK_MAX)
      return reject('Limite de pilha atingido.');
    next={...inventory,ownedEquipment:{...inventory.ownedEquipment,[grant.itemId]:current+grant.count}};
  }else{
    if(inventory.extraBagSlots+grant.slots>INVENTORY_BAG_EXTRA_SLOTS_MAX)
      return reject('Limite de capacidade atingido.');
    next={...inventory,extraBagSlots:inventory.extraBagSlots+grant.slots};
  }
  if(journal.revision===Number.MAX_SAFE_INTEGER)return reject('Limite de revisões atingido.');
  return{status:'applied',journal:{
    raw:JSON.stringify({...state,inventory:next}),
    revision:journal.revision+1,
    receipts:[...journal.receipts,{eventId:grant.eventId,payload:fingerprint}]
  }};
}
