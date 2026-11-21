/**
 * D-064J — transição ATÔMICA EXPERIMENTAL de recompensa regional no journal.
 *
 * Componente PURO, não ligado ao writer do jogo. Usa o reducer existente
 * para conceder resultado, e insere bolso/seen/caught no MESMO envelope e
 * revisão; não executa IO nem deixa débito separado da captura.
 *
 * IMPORTANTE: usa o reducer legado apenas como base estrutural/UID e
 * reconcilia recompensas para a curva EXPERIMENTAL D-064 na mesma revisão.
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
import {d064DraftBattleReward,d064DraftGrantXp} from './regionalEconomyDraft.js';
import {d064DraftBallDrop} from '../capture/draftBallSupply.js';

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
  // A bola pode ser selecionada antes do combate; se perder/empatar,
  // não se tenta capturar e a bola NÃO é consumida.
  if(command.outcome!=='win'&&command.affinityGain!==undefined)
    return reject(journal,'Derrota não pode receber afinidade.');
  if(command.outcome==='win'){
    const gain=command.affinityGain;
    if(typeof gain!=='number'||!Number.isSafeInteger(gain)||gain<2||gain>5)
      return reject(journal,'Ganho de afinidade inválido.');
  }

  let capture:{readonly pokemonId:number;readonly moveName:string}|undefined;
  let spentPocket:KantoBallPocketV1|undefined;
  if(command.outcome==='win'&&command.ballId!==undefined){
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
  // A transição legada conserva o mecanismo de UID/badges, mas seus
  // valores de XP e moedas NÃO podem vazar para a economia D-064.
  // Revalidamos ANTES do reducer para impedir migração implícita de XP:
  // essa curva somente poderá ir ao writer com política de rollout.
  const coins=current.coins;
  const sourceTrainerXp=trainer.xp;
  const sourceActiveXp=active.xp;
  if(typeof coins!=='number'||!Number.isSafeInteger(coins)||coins<0
    ||typeof sourceTrainerXp!=='number'||!Number.isSafeInteger(sourceTrainerXp)||sourceTrainerXp<0
    ||typeof sourceActiveXp!=='number'||!Number.isSafeInteger(sourceActiveXp)||sourceActiveXp<0)
    return reject(journal,'Saldo ou XP original inválido.');
  const draftReward=command.outcome==='win'
    ?d064DraftBattleReward(encounter.level):null;
  const trainerNext=d064DraftGrantXp('trainer',{
    level:trainer.level as number,xp:sourceTrainerXp
  },draftReward?.trainerXp??0);
  const pokemonNext=d064DraftGrantXp('pokemon',{
    level:active.level,xp:sourceActiveXp
  },draftReward?.pokemonXp??0);
  if(!trainerNext||!pokemonNext||!Number.isSafeInteger(coins+(draftReward?.coins??0)))
    return reject(journal,'XP precisa de migração para a nova curva ou saldo inválido.');
  const applied=applyRewardEvent(journal,base);
  if(applied.status!=='applied')return applied;
  const state=JSON.parse(applied.journal.raw) as Record<string,unknown>;
  if(command.outcome==='win'){
    const updatedTrainer=state.trainer as Record<string,unknown>;
    const updatedRoster=state.roster as Record<string,unknown>[];
    const updatedActive=updatedRoster.find(p=>p.uid===command.activeUid);
    if(!updatedActive)return reject(journal,'Pokémon ativo não encontrado após recompensa.');
    state.coins=coins+draftReward!.coins;
    updatedTrainer.level=trainerNext.level;
    updatedTrainer.xp=trainerNext.xp;
    updatedActive.level=pokemonNext.level;
    updatedActive.xp=pokemonNext.xp;
  }
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
  if(command.outcome==='win'){
    // Contagem de vitórias POR REGIÃO. O mesmo evento não pode somar
    // duas vezes: o recibo é escrito na revisão única abaixo.
    const oldWins=state.regionalWins;
    if(oldWins!==undefined&&(!oldWins||typeof oldWins!=='object'||Array.isArray(oldWins)))
      return reject(journal,'Contador regional inválido.');
    const rawWins=oldWins as Record<string,unknown>|undefined;
    if(rawWins&&Object.entries(rawWins).some(([id,count])=>
      !/^(?:[1-9]|10)$/.test(id)||!Number.isSafeInteger(count)
      ||typeof count!=='number'||count<0))
      return reject(journal,'Vitórias regionais inconsistentes.');
    const count=rawWins?.[String(region.id)]??0;
    if(typeof count!=='number'||!Number.isSafeInteger(count+1))
      return reject(journal,'Contador regional esgotado.');
    const nextWins=count+1;
    state.regionalWins={...rawWins,[String(region.id)]:nextWins};
    // O fornecimento é APENAS UM PROTÓTIPO; ainda não é concedido na
    // produção. Sem bolso migrado, não inventamos estoque.
    const pocket=inspectKantoBallPocket(state.ballPocket);
    if(pocket.status==='invalid')return reject(journal,pocket.reason);
    if(pocket.status==='valid'){
      const drop=d064DraftBallDrop(region.id,nextWins);
      if(!drop)return reject(journal,'Fonte de Poké Bolas indisponível.');
      const amounts={...pocket.pocket.quantities};
      for(const key of ['poke-ball','great-ball','ultra-ball'] as const){
        // Uma vitória sem drop não deve criar chaves zeradas no bolso.
        if(drop[key]===0)continue;
        const quantity=(amounts[key]??0)+drop[key];
        if(!Number.isSafeInteger(quantity)||quantity>100000)
          return reject(journal,'Estoque de Poké Bolas fora do limite.');
        amounts[key]=quantity;
      }
      state.ballPocket={version:1,quantities:amounts};
    }
  }
  const receipts=applied.journal.receipts.map(receipt=>
    receipt.id===command.id?{id:receipt.id,fingerprint}:receipt);
  return{status:'applied',journal:{
    raw:JSON.stringify(state),revision:applied.journal.revision,receipts
  }};
}
