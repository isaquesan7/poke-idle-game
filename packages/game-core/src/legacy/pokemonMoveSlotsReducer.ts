/**
 * Slots de 1–4 golpes por UID, mantendo moveName legado como principal.
 * O reducer nunca recebe lista/poder/chance de golpes da interface:
 * valida tudo no catálogo fixo e no nível da espécie corrente.
 */
import {kantoLevelMoves} from '../catalog/kantoLevelMoves.js';
import {kantoSupportMoves,KANTO_SUPPORT_MOVES} from '../catalog/kantoSupportMoves.js';
import {KANTO_BATTLE_MOVES,KANTO_BATTLE_SPECIES} from '../combat/kantoBattle.js';
export type MoveSlotOperation='add'|'remove'|'primary'|'replace-primary';
export interface MoveSlotAction {readonly uid:number;readonly moveName:string;readonly operation:MoveSlotOperation}
export type MoveSlotResult={readonly status:'ok';readonly json:string}
  | {readonly status:'invalid';readonly reason:string};
type Entry=Record<string,unknown>;
const record=(v:unknown):v is Entry=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const name=(v:unknown):v is string=>typeof v==='string'&&v.length>=1&&v.length<=100&&v===v.trim();
const invalid=(reason:string):MoveSlotResult=>({status:'invalid',reason});
/** Save antigo sem moveNames continua valendo como slot único. */
export function pokemonMoveSlots(value:unknown,fallback:string):readonly string[]{
  if(!record(value))return[];
  if(Array.isArray(value.moveNames))return value.moveNames.filter(name);
  return [name(value.moveName)?value.moveName:fallback];
}
export function reducePokemonMoveSlotsJson(raw:string,action:MoveSlotAction):MoveSlotResult {
  let parsed:unknown;
  try{parsed=JSON.parse(raw);}catch{return invalid('Save malformado.');}
  if(!record(parsed)||parsed.version!==1||!Array.isArray(parsed.roster)
    ||!Array.isArray(parsed.team)||parsed.team.length<1||!Array.isArray(parsed.badges)
    ||!action||!positive(action.uid)||!name(action.moveName))
    return invalid('Comando ou save inválido.');
  const p=parsed.roster.find((v:unknown)=>record(v)&&v.uid===action.uid);
  if(!record(p)||!positive(p.pokemonId)||p.pokemonId>151
    ||!positive(p.level)||p.level>100)return invalid('Pokémon não encontrado pelo UID.');
  const species=KANTO_BATTLE_SPECIES[p.pokemonId];
  if(!species)return invalid('Espécie indisponível.');
  const slots=pokemonMoveSlots(p,species.move.name);
  if(slots.length<1||slots.length>4||new Set(slots).size!==slots.length
    ||(name(p.moveName)&&slots[0]!==p.moveName)
    ||!slots.every(n=>!!(KANTO_BATTLE_MOVES[n]??KANTO_SUPPORT_MOVES[n])))
    return invalid('Slots salvos inválidos.');
  const learned=new Set([
    ...kantoLevelMoves(p.pokemonId,p.level).map(x=>x.move.name),
    ...kantoSupportMoves(p.pokemonId,p.level).map(x=>x.move.name)
  ]);
  const has=slots.includes(action.moveName);
  let next:string[];
  if(action.operation==='add'){
    if(!learned.has(action.moveName))return invalid('Golpe não aprendido.');
    if(has||slots.length>=4)return invalid('Golpe duplicado ou quatro slots ocupados.');
    next=[...slots,action.moveName];
  }else if(action.operation==='remove'){
    if(!has||slots.length===1)return invalid('Não é possível retirar esse golpe.');
    next=slots.filter(n=>n!==action.moveName);
  }else if(action.operation==='primary'){
    if(!has)return invalid('Golpe não equipado.');
    next=[action.moveName,...slots.filter(n=>n!==action.moveName)];
  }else if(action.operation==='replace-primary'){
    if(!learned.has(action.moveName))return invalid('Golpe ainda não aprendido.');
    next=[action.moveName,...slots.slice(1).filter(n=>n!==action.moveName)];
  }else return invalid('Operação desconhecida.');
  if(!next.some(n=>(KANTO_BATTLE_MOVES[n]?.power??0)>0))
    return invalid('Mantenha um golpe ofensivo no conjunto.');
  p.moveNames=next;
  p.moveName=next[0];
  return {status:'ok',json:JSON.stringify(parsed)};
}
