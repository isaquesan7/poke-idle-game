/**
 * D-064P — MIGRAÇÃO DE XP APENAS EM JOURNAL EXPERIMENTAL.
 * A curva regional é mais lenta; preservamos cada nível já conquistado,
 * convertendo somente a fração de progresso dentro do nível atual.
 * Não migra ou liquida expedições antigas, não modifica moedas/bolas/UID.
 * Ainda não conectado ao writer/playSave nem aprovado para produção.
 */
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
import type {RewardJournal,RewardEventResult} from '../legacy/rewardEvents.js';
import {xpThreshold} from '../progression/xp.js';
import {d064DraftXpThreshold} from './regionalEconomyDraft.js';

export const D064_EXPERIMENTAL_ECONOMY_VERSION='d064-regional-draft-v1';
type RecordValue=Record<string,unknown>;
const object=(value:unknown):value is RecordValue=>
  value!==null&&typeof value==='object'&&!Array.isArray(value);
const good=(value:unknown):value is number=>
  typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const error=(journal:RewardJournal,reason:string):RewardEventResult=>
  ({status:'rejected',journal,reason});

/** Nunca reduz nível. Para Lv100, XP permanece 0. Fração usa floor para
 * não conceder um nível acidentalmente durante a conversão. */
export function d064DraftConvertLegacyXp(
  kind:'trainer'|'pokemon',level:number,xp:number
):number|null{
  if(!Number.isSafeInteger(level)||level<1||level>100||!good(xp))
    return null;
  if(level===100)return xp===0?0:null;
  const old=xpThreshold(kind,level);
  const next=d064DraftXpThreshold(kind,level);
  if(next===null||xp>=old)return null;
  return Math.min(next-1,Math.floor((xp/old)*next));
}
export interface D064EconomyMigrationCommand{
  readonly id:string;
  readonly expectedRevision:number;
}
/** Operação idempotente com receipt: o journal inteiro muda de versão
 * econômica em uma única revisão, ou nenhuma alteração é retornada. */
export function migrateD064EconomyDraft(
  journal:RewardJournal,cmd:D064EconomyMigrationCommand
):RewardEventResult{
  if(!journal||typeof journal.raw!=='string'||!good(journal.revision)
    ||!Array.isArray(journal.receipts)||journal.receipts.length!==journal.revision
    ||!cmd||!good(cmd.expectedRevision)
    ||typeof cmd.id!=='string'
    ||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/.test(cmd.id))
    return error(journal,'Comando de migração econômica inválido.');
  const fingerprint=JSON.stringify(cmd);
  const previous=journal.receipts.find(receipt=>receipt.id===cmd.id);
  if(previous)return previous.fingerprint===fingerprint
    ?{status:'duplicate',journal}
    :error(journal,'Identificador de migração econômica reutilizado.');
  if(journal.revision!==cmd.expectedRevision)
    return error(journal,'Revisão da migração desatualizada.');
  if(prepareRewardJournal(journal.raw)===null)
    return error(journal,'Save legado inválido.');
  let state:RecordValue;
  try{
    const raw:unknown=JSON.parse(journal.raw);
    if(!object(raw))return error(journal,'Save inválido.');
    state=raw;
  }catch{return error(journal,'Save inválido.');}
  if(state.economyVersion!==undefined)
    return error(journal,'Versão econômica já definida; não migrar duas vezes.');
  if(!object(state.trainer)||!Array.isArray(state.roster))
    return error(journal,'Treinador ou equipe ausentes.');
  const trainer=state.trainer;
  const newTrainerXp=d064DraftConvertLegacyXp('trainer',
    trainer.level as number,trainer.xp as number);
  if(newTrainerXp===null)return error(journal,'XP do Treinador incompatível.');
  const newPokemonXps:number[]=[];
  for(const member of state.roster){
    if(!object(member))return error(journal,'Pokémon inválido.');
    const converted=d064DraftConvertLegacyXp('pokemon',
      member.level as number,member.xp as number);
    if(converted===null)return error(journal,'XP Pokémon incompatível.');
    newPokemonXps.push(converted);
  }
  trainer.xp=newTrainerXp;
  for(let i=0;i<state.roster.length;i++){
    (state.roster[i] as RecordValue).xp=newPokemonXps[i];
  }
  state.economyVersion=D064_EXPERIMENTAL_ECONOMY_VERSION;
  return{status:'applied',journal:{
    raw:JSON.stringify(state),
    revision:journal.revision+1,
    receipts:[...journal.receipts,{id:cmd.id,fingerprint}]
  }};
}
