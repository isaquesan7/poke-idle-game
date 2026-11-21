/**
 * D-064J — transição ATÔMICA EXPERIMENTAL de recompensa regional no journal.
 *
 * Componente PURO, não ligado ao writer do jogo. Usa o reducer existente
 * para conceder resultado, e insere bolso/seen/caught no MESMO envelope e
 * revisão; não executa IO nem deixa débito separado da captura.
 *
 * IMPORTANTE: ainda aplica recompensas e curva LEGADAS do reducer.
 * Nunca conectar à UI antes de equilibrar XP/coins, validar vitória pelo
 * simulador real, definir migração/estoque e integração E2E.
 *
 * O resultado recebido em memória NÃO é uma prova antifraude. A futura
 * camada playSave precisa reconstruir o combate a partir do próprio save.
 */
import {applyRewardEvent} from '../legacy/rewardEvents.js';
import type {RewardCommand,RewardEventResult,RewardJournal} from '../legacy/rewardEvents.js';
import {KANTO_BATTLE_SPECIES} from '../combat/kantoBattle.js';
import {kantoRegionalEncounter,kantoRegion} from './kantoRegions.js';
import {inspectKantoBallPocket} from '../capture/kantoBallPocket.js';
import type {KantoBallPocketV1} from '../capture/kantoBallPocket.js';
import {resolveKantoCaptureAttempt} from '../capture/regionalCaptureAttempt.js';
import type {KantoBallId} from '../capture/kantoBalls.js';

export interface RegionalBattleDraftCommand {
  readonly id:string;
  readonly expectedRevision:number;
  readonly regionId:number;
  readonly seed:number;
  readonly activeUid:number;
  readonly outcome:'win'|'loss'|'draw';
  readonly affinityGain?:number;
  /** Ausência significa vencer sem tentar capturar. */
  readonly ballId?:KantoBallId;
}
const positive=(value:unknown):value is number=>
  typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
const reject=(journal:RewardJournal,reason:string):RewardEventResult=>
  ({status:'rejected',journal,reason});

/** Pré-requisitos de autorização e seleção de encontro revalidados pelo
 * core. O ID completo, inclusive bola e região, entra no fingerprint.
 */
export function applyRegionalBattleDraft(
  journal:RewardJournal,command:RegionalBattleDraftCommand
):RewardEventResult {
  if(!journal||typeof journal.raw!=='string'||!Array.isArray(journal.receipts)
    ||!command||!/^[-a-zA-Z0-9_.:]{1,96}$/.test(command.id)
    ||!Number.isSafeInteger(command.expectedRevision)
    ||!Number.isSafeInteger(command.seed)||command.seed<0||command.seed>0xffffffff
    ||!positive(command.activeUid)
    ||!['win','loss','draw'].includes(command.outcome)
    ||!Number.isSafeInteger(journal.revision)
    ||journal.receipts.length!==journal.revision)
    return reject(journal,'Comando ou journal regional inválido.');
  const fingerprint=JSON.stringify(command);
  const previous=journal.receipts.find(r=>r.id===command.id);
  if(previous)
    return previous.fingerprint===fingerprint
      ?{status:'duplicate',journal}
      :reject(journal,'ID regional reutilizado com payload diferente.');
  if(command.expectedRevision!==journal.revision)
    return reject(journal,'Revisão regional desatualizada.');

  let current:Record<string,unknown>;
  try{
    const parsed:unknown=JSON.parse(journal.raw);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))
      return reject(journal,'Save regional inválido.');
    current=parsed as Record<string,unknown>;
  }catch{return reject(journal,'JSON regional inválido.');}
  const trainer=current.trainer as Record<string,unknown>|undefined;
  const team=current.team as unknown[]|undefined;
  const roster=current.roster as Record<string,unknown>[]|undefined;
  const seen=current.seen as unknown[]|undefined;
  const region=kantoRegion(command.regionId);
  if(!trainer||!positive(trainer.level)||trainer.level>100
    ||!region||trainer.level<region.trainerUnlockLevel
    ||!Array.isArray(team)||team[0]!==command.activeUid
    ||!Array.isArray(roster)||!Array.isArray(seen))
    return reject(journal,'Região, treinador ou equipe inválidos.');
  const active=roster.find(p=>p&&p.uid===command.activeUid);
  if(!active||!positive(active.level)||active.level>100)
    return reject(journal,'Pokémon líder inválido.');
  const encounter=kantoRegionalEncounter(region.id,command.seed,active.level);
  if(!encounter)return reject(journal,'Encontro fora da região.');
  const species=KANTO_BATTLE_SPECIES[encounter.speciesId];
  if(!species)return reject(journal,'Espécie selvagem não disponível.');
  if(command.outcome!=='win'&&
    (command.affinityGain!==undefined||command.ballId!==undefined))
    return reject(journal,'Derrota não pode receber afinidade ou tentar capturar.');
  if(command.outcome==='win'){
    const gain=command.affinityGain;
    if(typeof gain!=='number'||!Number.isSafeInteger(gain)||gain<2||gain>5)
      return reject(journal,'Ganho de afinidade inválido.');
  }

  let capture:{readonly pokemonId:number;readonly moveName:string}|undefined;
  let spentPocket:KantoBallPocketV1|undefined;
  if(command.ballId!==undefined){
    const pocket=inspectKantoBallPocket(current.ballPocket);
    if(pocket.status!=='valid')
      return reject(journal,'Poké Bolas não inicializadas ou mochila inválida.');
    const attempt=resolveKantoCaptureAttempt({
      regionId:region.id,speciesId:species.id,
      ballId:command.ballId,pocket:pocket.pocket,
      maxHp:100,currentHp:0,seed:command.seed
    });
    if(attempt.status!=='resolved')return reject(journal,attempt.reason);
    spentPocket=attempt.pocket;
    if(attempt.captured)capture={pokemonId:species.id,moveName:species.move.name};
  }

  const base:RewardCommand={
    id:command.id,expectedRevision:journal.revision,
    type:'battle-result',activeUid:command.activeUid,
    wildLevel:encounter.level,outcome:command.outcome,
    ...(command.outcome==='win'?{affinityGain:command.affinityGain}:{}),
    ...(capture?{capture}:{})
  };
  const applied=applyRewardEvent(journal,base);
  if(applied.status!=='applied')return applied;
  const state=JSON.parse(applied.journal.raw) as Record<string,unknown>;
  const known=new Set((seen as unknown[]).filter(v=>positive(v)&&v<=151));
  known.add(species.id);
  state.seen=[...known];
  if(capture){
    const caught=Array.isArray(state.caughtSpecies)?state.caughtSpecies:[];
    const knownCaught=new Set(
      [...caught,...roster.map(p=>p.pokemonId),species.id]
        .filter(v=>positive(v)&&v<=151)
    );
    state.caughtSpecies=[...knownCaught];
  }
  if(spentPocket)state.ballPocket=spentPocket;
  const receipts=applied.journal.receipts.map(receipt=>
    receipt.id===command.id?{id:receipt.id,fingerprint}:receipt);
  return{status:'applied',journal:{
    raw:JSON.stringify(state),revision:applied.journal.revision,receipts
  }};
}
