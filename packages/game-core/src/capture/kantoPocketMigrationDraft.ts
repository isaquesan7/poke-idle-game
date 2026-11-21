/**
 * D-064N — migração EXPERIMENTAL e explícita de bolso no RewardJournal.
 *
 * Não conectada à criação de save, PlayAction ou qualquer writer de produção.
 * Preserva todos os campos (incluindo expedição antiga ativa), rejeita bolso
 * parcialmente inválido e impede reinicializações/duplicações por recibo.
 *
 * A origem do kit deve vir de uma decisão de release (não do cliente):
 * 'legacy-empty' não concede quantidade fictícia; 'starter-proposal'
 * concede o KIT HIPOTÉTICO de 12 Poké Balls já documentado na D-064I.
 */
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
import type {RewardJournal,RewardEventResult} from '../legacy/rewardEvents.js';
import {inspectKantoBallPocket} from './kantoBallPocket.js';
import {D064_DRAFT_STARTER_BALLS} from './draftBallSupply.js';

export type D064PocketMigrationPolicy='legacy-empty'|'starter-proposal';
export interface D064PocketMigrationCommand {
  readonly id:string;
  readonly expectedRevision:number;
  readonly policy:D064PocketMigrationPolicy;
}
const deny=(journal:RewardJournal,reason:string):RewardEventResult=>({
  status:'rejected',journal,reason
});
const good=(n:unknown):n is number=>
  typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;

/** Uma cópia integral do raw e uma única revisão, sem I/O. */
export function migrateD064PocketDraft(
  journal:RewardJournal,command:D064PocketMigrationCommand
):RewardEventResult{
  if(!journal||typeof journal.raw!=='string'||!good(journal.revision)
    ||!Array.isArray(journal.receipts)||journal.receipts.length!==journal.revision
    ||!command||!good(command.expectedRevision)
    ||!/(?:^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$)/.test(command.id)
    ||!['legacy-empty','starter-proposal'].includes(command.policy))
    return deny(journal,'Migração de bolso inválida.');
  const fingerprint=JSON.stringify(command);
  const old=journal.receipts.find(r=>r.id===command.id);
  if(old)return old.fingerprint===fingerprint
    ?{status:'duplicate',journal}
    :deny(journal,'Identificador de migração reutilizado com outra política.');
  if(journal.revision!==command.expectedRevision)
    return deny(journal,'Revisão do progresso desatualizada.');
  if(prepareRewardJournal(journal.raw)===null)
    return deny(journal,'Save não é compatível com a migração.');
  let state:Record<string,unknown>;
  try{
    const value:unknown=JSON.parse(journal.raw);
    if(!value||typeof value!=='object'||Array.isArray(value))
      return deny(journal,'Save de migração inválido.');
    state=value as Record<string,unknown>;
  }catch{return deny(journal,'Save de migração inválido.');}
  const existing=inspectKantoBallPocket(state.ballPocket);
  if(existing.status==='invalid')return deny(journal,existing.reason);
  if(existing.status==='valid')
    return deny(journal,'Bolso já inicializado; não é permitido conceder o kit novamente.');

  state.ballPocket=command.policy==='legacy-empty'
    ?{version:1,quantities:{}}
    :{version:1,quantities:{...D064_DRAFT_STARTER_BALLS.quantities}};
  return{status:'applied',journal:{
    raw:JSON.stringify(state),
    revision:journal.revision+1,
    receipts:[...journal.receipts,{id:command.id,fingerprint}]
  }};
}
