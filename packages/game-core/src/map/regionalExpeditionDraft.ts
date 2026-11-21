/**
 * D-064M — experimento PURO de expedição regional versionada em RewardJournal.
 * Não é o writer publicado. Preserva expedições antigas: se ativa sem regionId,
 * recusa a transição regional, sem migrá-las nem descartar ciclos acumulados.
 *
 * Proposta de XP do Treinador durante expedição regional: zero NESTE modelo,
 * para medir progressão lenta. Ainda não é uma fórmula aprovada de produção.
 * Moedas continuam nos ciclos; XP por membro é limitado ao teto da região.
 */
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
import type {RewardJournal,RewardEventResult} from '../legacy/rewardEvents.js';
import {expeditionRewards} from '../rewards/expedition.js';
import {canStartRegionalExpedition,cappedRegionalPokemonXp} from './regionalExpeditionXp.js';
import {kantoRegion} from './kantoRegions.js';

export type RegionalExpeditionDraftCommand={
  readonly id:string;
  readonly expectedRevision:number;
  readonly operation:'start'|'claim'|'stop';
  readonly nowMs:number;
  readonly regionId:number;
};
type Mutable=Record<string,unknown>;
const object=(v:unknown):v is Mutable=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const natural=(v:unknown):v is number=>
  typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const positive=(v:unknown):v is number=>natural(v)&&v>0;
const rejected=(j:RewardJournal,reason:string):RewardEventResult=>
  ({status:'rejected',journal:j,reason});

export function applyRegionalExpeditionDraft(
  journal:RewardJournal,cmd:RegionalExpeditionDraftCommand
):RewardEventResult {
  if(!journal||typeof journal.raw!=='string'||!Array.isArray(journal.receipts)
    ||!natural(journal.revision)||journal.receipts.length!==journal.revision
    ||!cmd||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/.test(cmd.id)
    ||!natural(cmd.expectedRevision)||!natural(cmd.nowMs)
    ||!['start','claim','stop'].includes(cmd.operation)||!kantoRegion(cmd.regionId))
    return rejected(journal,'Comando de expedição regional inválido.');
  const fingerprint=JSON.stringify(cmd);
  const found=journal.receipts.find(receipt=>receipt.id===cmd.id);
  if(found)return found.fingerprint===fingerprint
    ?{status:'duplicate',journal}
    :rejected(journal,'ID regional reutilizado com payload diferente.');
  if(journal.revision!==cmd.expectedRevision)
    return rejected(journal,'Revisão de expedição desatualizada.');

  // O reducer legado é a validação estrutural mínima. O dry-run nunca
  // converte nem corrige saves existentes silenciosamente.
  if(prepareRewardJournal(journal.raw)===null)
    return rejected(journal,'Save incompatível com a expedição.');
  let state:Mutable;
  try{
    const data:unknown=JSON.parse(journal.raw);
    if(!object(data))return rejected(journal,'Save inválido.');
    state=data;
  }catch{return rejected(journal,'JSON inválido.');}
  if(!object(state.trainer)||!positive(state.trainer.level)
    ||state.trainer.level>100||!natural(state.coins)
    ||!Array.isArray(state.roster)||!Array.isArray(state.team))
    return rejected(journal,'Treinador ou equipe inválidos.');
  const trainer=state.trainer as Mutable;
  const roster=state.roster;
  const team=state.team;
  const teamUids=team.filter(positive);
  if(teamUids.length===0||teamUids.length>3||new Set(teamUids).size!==teamUids.length
    ||team.length!==teamUids.length)
    return rejected(journal,'Equipe da expedição inválida.');
  const members=teamUids.map(uid=>roster.find(entry=>object(entry)&&entry.uid===uid));
  if(members.some(member=>!object(member)||!positive(member.level)
    ||member.level>100||!natural(member.xp)||!natural(member.affinity)
    ||member.affinity>100))
    return rejected(journal,'Pokémon da expedição inválido.');

  if(cmd.operation==='start'){
    if(state.expedition!==null)
      return rejected(journal,'Já existe uma expedição em andamento.');
    if(!teamUids.every(uid=>{
      const member=roster.find(entry=>object(entry)&&entry.uid===uid) as Mutable;
      return canStartRegionalExpedition(trainer.level as number,
        member.level as number,cmd.regionId);
    }))return rejected(journal,'Treinador ou Pokémon sem acesso à região.');
    state.expedition={
      regionId:cmd.regionId,startedAt:cmd.nowMs,lastClaimAt:cmd.nowMs,
      teamUids:[...teamUids]
    };
  } else {
    const expedition=state.expedition;
    if(!object(expedition)||!natural(expedition.startedAt)
      ||!natural(expedition.lastClaimAt)||!Array.isArray(expedition.teamUids))
      return rejected(journal,'Expedição inexistente ou formato legado: não migrado.');
    if(expedition.regionId!==cmd.regionId)
      return rejected(journal,'Não é possível trocar a região sem encerrar a expedição.');
    if(cmd.nowMs<expedition.lastClaimAt||expedition.lastClaimAt<expedition.startedAt)
      return rejected(journal,'Relógio retrocedeu.');
    const capturedUids=expedition.teamUids;
    if(capturedUids.length===0||capturedUids.length>3
      ||capturedUids.some(uid=>!positive(uid))
      ||new Set(capturedUids).size!==capturedUids.length)
      return rejected(journal,'Membros da expedição inválidos.');
    const cycleRewards=expeditionRewards(cmd.nowMs-expedition.lastClaimAt);
    if(cmd.operation==='claim'&&cycleRewards.cycles===0)
      return rejected(journal,'Nenhum ciclo completo para resgatar.');
    if(!Number.isSafeInteger((state.coins as number)+cycleRewards.coins))
      return rejected(journal,'Moedas excederam o limite seguro.');
    state.coins=(state.coins as number)+cycleRewards.coins;
    const perMember:Record<string,number>={};
    for(const uid of capturedUids){
      const member=roster.find(entry=>object(entry)&&entry.uid===uid);
      if(!object(member)||!positive(member.level)||member.level>100
        ||!natural(member.xp)||!natural(member.affinity)||member.affinity>100)
        return rejected(journal,'Pokémon original da expedição ausente.');
      const cap=cappedRegionalPokemonXp({
        level:member.level,xp:member.xp
      },cycleRewards.pokemonXpPerMember,cmd.regionId);
      if(!cap)return rejected(journal,'Falha no limite de XP da região.');
      member.level=cap.level;
      member.xp=cap.xp;
      member.affinity=Math.min(100,member.affinity+cycleRewards.affinityGainPerMember);
      perMember[String(uid)]=cap.xpAccepted;
    }
    state.lastClaim={
      regionId:cmd.regionId,coins:cycleRewards.coins,trainerXP:0,
      pokemonXP:cycleRewards.pokemonXpPerMember,
      pokemonXpByUid:perMember,cycles:cycleRewards.cycles
    };
    if(cmd.operation==='stop')state.expedition=null;
    else expedition.lastClaimAt=cmd.nowMs;
  }

  return{status:'applied',journal:{
    raw:JSON.stringify(state),
    revision:journal.revision+1,
    receipts:[...journal.receipts,{id:cmd.id,fingerprint}]
  }};
}
