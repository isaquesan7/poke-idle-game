/**
 * D-064R — auditoria de rollout regional SEM escrita e SEM ações PlayAction.
 *
 * A próxima fase de integração precisa migrar XP e bolso, validar a região,
 * resolver uma batalha real e simular o journal de recompensas. Este serviço
 * ensaia essa sequência com recibos/versões, usando exclusivamente cópias em
 * memória. Nunca chama setItem, commit ou updatePlaySave.
 *
 * IMPORTANTE: o resultado não é um snapshot gravável. Ainda não existe
 * backend nem proteção antifraude para seeds fornecidas pelo cliente.
 */
import {
  D064_EXPERIMENTAL_ECONOMY_VERSION,
  inspectKantoBallPocket,migrateD064EconomyDraft,migrateD064PocketDraft
} from '@kanto/game-core';
import type {KantoBallId,RewardJournal,D064PocketMigrationPolicy} from '@kanto/game-core';
import {readPlaySave} from './playSave';
import type {PlayStorage} from './playSave';
import {dryRunRegionalBattleTransaction} from './regionalBattleBridge';

export interface RegionalRolloutAuditRequest {
  readonly expectedRevision:number;
  readonly regionId:number;
  readonly seed:number;
  readonly ballId?:KantoBallId;
  /** Política de lançamento explicitamente fornecida; nunca implícita. */
  readonly pocketPolicy:D064PocketMigrationPolicy;
}
export type RegionalRolloutAudit =
  | {readonly status:'blocked';readonly reason:string}
  | {readonly status:'ready';
      readonly originalRevision:number;
      readonly proposedJournalRevision:number;
      readonly operations:readonly ('migrate-xp'|'migrate-pocket'|'battle')[];
      readonly battleOutcome:'win'|'loss'|'draw';
      readonly speciesId:number;
      readonly ballCountBefore:number;
      readonly ballCountAfter:number;
      readonly originalCoins:number;
      readonly projectedCoins:number;
      readonly originalTrainerLevel:number;
      readonly projectedTrainerLevel:number;
      readonly originalRosterCount:number;
      readonly projectedRosterCount:number;
      readonly willWrite:false};

const isObject=(v:unknown):v is Record<string,unknown>=>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
const deny=(reason:string):RegionalRolloutAudit=>({status:'blocked',reason});
function parse(raw:string):Record<string,unknown>|null{
  try{
    const value:unknown=JSON.parse(raw);
    return isObject(value)?value:null;
  }catch{return null;}
}
function countBalls(state:Record<string,unknown>):number{
  const examined=inspectKantoBallPocket(state.ballPocket);
  if(examined.status!=='valid')return 0;
  return Object.values(examined.pocket.quantities)
    .reduce<number>((sum,n)=>sum+(n??0),0);
}
/**
 * Simula conversão e batalha, mas retorna apenas indicadores não graváveis.
 * Revalida a versão do save e a revisão antes de fazer cálculos. Nunca
 * efetua uma migração real — nem com pocketPolicy='starter-proposal'.
 */
export function auditRegionalRollout(
  storage:Pick<PlayStorage,'getItem'>,request:RegionalRolloutAuditRequest
):RegionalRolloutAudit{
  if(!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0
    ||!Number.isSafeInteger(request.regionId)||request.regionId<1||request.regionId>10
    ||!Number.isSafeInteger(request.seed)||request.seed<0||request.seed>0xffffffff
    ||!['legacy-empty','starter-proposal'].includes(request.pocketPolicy))
    return deny('Parâmetros da auditoria regional inválidos.');
  const source=readPlaySave(storage);
  if(source.status!=='ready')return deny('Save indisponível ou inválido.');
  if(source.snapshot.revision!==request.expectedRevision)
    return deny('Revisão do save desatualizada.');
  // A auditoria não pode confundir duas revisões divergentes no mesmo envelope.
  if(source.snapshot.journal.revision!==source.snapshot.revision)
    return deny('Revisões internas do save divergentes.');
  // Não reinterpreta ciclos antigos ou muda de área numa expedição ativa.
  const old=parse(source.snapshot.journal.raw);
  if(!old)return deny('Save de origem inválido.');
  if(old.expedition!==null)
    return deny('Encerre a Expedição antiga antes de planejar a migração regional.');
  const startingTrainer=old.trainer;
  if(!isObject(startingTrainer)||typeof startingTrainer.level!=='number'
    ||typeof old.coins!=='number'||!Array.isArray(old.roster))
    return deny('Progresso inicial incompleto.');
  let staged:RewardJournal=source.snapshot.journal;
  const operations:('migrate-xp'|'migrate-pocket'|'battle')[]=[];
  if(old.economyVersion===undefined){
    const event=migrateD064EconomyDraft(staged,{
      id:'d064-audit-economy-'+request.expectedRevision,
      expectedRevision:staged.revision
    });
    if(event.status!=='applied')
      return deny(event.status==='rejected'?event.reason:'Migração de XP não aplicada.');
    staged=event.journal;
    operations.push('migrate-xp');
  }else if(old.economyVersion!==D064_EXPERIMENTAL_ECONOMY_VERSION){
    return deny('Versão da economia desconhecida; não reinterpretar XP.');
  }
  const pocket=inspectKantoBallPocket(old.ballPocket);
  if(pocket.status==='invalid')return deny(pocket.reason);
  if(pocket.status==='legacy-untracked'){
    const event=migrateD064PocketDraft(staged,{
      id:'d064-audit-pocket-'+request.expectedRevision,
      expectedRevision:staged.revision,
      policy:request.pocketPolicy
    });
    if(event.status!=='applied')
      return deny(event.status==='rejected'?event.reason:'Bolso não inicializado.');
    staged=event.journal;
    operations.push('migrate-pocket');
  }
  const outcome=dryRunRegionalBattleTransaction(
    staged,request.regionId,request.seed,request.ballId
  );
  if(outcome.status!=='ready')return deny(outcome.reason);
  operations.push('battle');
  const final=parse(outcome.proposedJournal.raw);
  if(!final||!isObject(final.trainer)||!Array.isArray(final.roster)
    ||typeof final.coins!=='number')return deny('Resultado da auditoria inválido.');
  // Uma aba pode escrever enquanto o ensaio está calculando. A comparação
  // final não é CAS/lock, mas impede exibir como atual um resultado obsoleto.
  // O preflight permanece estritamente somente leitura.
  try {
    const latest=readPlaySave(storage);
    if(latest.status!=='ready'
      ||latest.snapshot.revision!==source.snapshot.revision
      ||latest.snapshot.journal.raw!==source.snapshot.journal.raw
      ||latest.snapshot.journal.revision!==source.snapshot.journal.revision
      ||JSON.stringify(latest.snapshot.journal.receipts)!==JSON.stringify(source.snapshot.journal.receipts))
      return deny('O progresso mudou durante a auditoria. Refaça a verificação.');
  } catch {
    return deny('Não foi possível verificar novamente o progresso.');
  }
  // Não devolvemos JSON nem RewardJournal para impedir commits de prévia.
  return{status:'ready',
    originalRevision:source.snapshot.revision,
    proposedJournalRevision:outcome.proposedJournal.revision,
    operations,battleOutcome:outcome.preview.battle.outcome,
    speciesId:outcome.preview.wildSpeciesId,
    ballCountBefore:countBalls(old),ballCountAfter:countBalls(final),
    originalCoins:old.coins,projectedCoins:final.coins,
    originalTrainerLevel:startingTrainer.level,
    projectedTrainerLevel:final.trainer.level as number,
    originalRosterCount:old.roster.length,projectedRosterCount:final.roster.length,
    willWrite:false
  };
}
