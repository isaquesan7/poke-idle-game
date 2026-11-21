/**
 * D-064V — gate estrutural de persistência regional, SEM IO e SEM autorização.
 *
 * Confere um candidato produzido pela simulação D064T contra o envelope do
 * save original. O retorno contém somente metadados e canWrite:false; nunca
 * devolve JSON/candidato gravável. Validação estrutural não autentica RNG
 * nem substitui lock, backup recuperável ou política de economia aprovada.
 */
import {readPlaySave} from './playSave';
import type {PlaySnapshot} from './playSave';
import {RegionalWriterMemoryLab} from './regionalWriterMemoryLab';
import type {RegionalLabCommand} from './regionalWriterMemoryLab';

export type RegionalPersistenceGate =
  | {readonly status:'blocked';readonly reason:string;readonly canWrite:false}
  | {readonly status:'eligible-preview';readonly canWrite:false;
      readonly oldRevision:number;readonly projectedRevision:number;
      readonly addedReceipts:number};

const deny=(reason:string):RegionalPersistenceGate=>({
  status:'blocked',reason,canWrite:false
});
const valid=(value:unknown):value is PlaySnapshot=>{
  try {
    const result=readPlaySave({getItem:()=>JSON.stringify(value)});
    return result.status==='ready' &&
      result.snapshot.revision===result.snapshot.journal.revision;
  } catch {return false;}
};

/**
 * expectedRevision corresponde à revisão capturada na UI antes do ensaio.
 * Como não existe commit aqui, uma verificação posterior e lock cooperativo
 * serão obrigatórios antes de uma gravação real.
 */
export function inspectRegionalPersistenceCandidate(
  original:PlaySnapshot,candidate:PlaySnapshot,expectedRevision:number
):RegionalPersistenceGate {
  if(!valid(original)||!valid(candidate))
    return deny('Snapshot de origem ou candidato inválido.');
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0
    ||original.revision!==expectedRevision)
    return deny('Revisão de origem desatualizada.');
  if(candidate.schemaVersion!==2||original.schemaVersion!==2)
    return deny('Schema incompatível.');
  if(candidate.revision<=original.revision)
    return deny('O candidato não contém uma transação nova.');
  const oldReceipts=original.journal.receipts;
  const newReceipts=candidate.journal.receipts;
  if(newReceipts.length<=oldReceipts.length
    ||JSON.stringify(newReceipts.slice(0,oldReceipts.length))!==JSON.stringify(oldReceipts))
    return deny('Histórico de recibos divergiu; não sobrescrever o progresso.');
  // Toda migração/ação deve manter revisão e receipts no mesmo envelope.
  if(candidate.revision-original.revision!==newReceipts.length-oldReceipts.length)
    return deny('Quantidade de revisões e recibos inconsistente.');
  const originalIds=new Set(oldReceipts.map(r=>r.id));
  if(newReceipts.slice(oldReceipts.length).some(r=>originalIds.has(r.id)))
    return deny('ID de recibo reutilizado no candidato.');
  return {
    status:'eligible-preview',canWrite:false,
    oldRevision:original.revision,projectedRevision:candidate.revision,
    addedReceipts:newReceipts.length-oldReceipts.length
  };
}

/**
 * D-064W — compara um candidato com a execução canônica do motor regional.
 * Não aceita outcome, espécie, coins, captura ou recibos da interface como
 * prova: a simulação reconstruída a partir da ORIGEM deve ser idêntica.
 *
 * Ainda é somente leitura. Seed fornecida pelo cliente NÃO é antifraude;
 * para a versão com jogadores será necessária autoridade de servidor.
 */
export function inspectCanonicalRegionalProposal(
  original:PlaySnapshot,
  candidate:PlaySnapshot,
  command:RegionalLabCommand
):RegionalPersistenceGate {
  const structural=inspectRegionalPersistenceCandidate(
    original,candidate,command.expectedRevision
  );
  if(structural.status==='blocked')return structural;
  try{
    const lab=new RegionalWriterMemoryLab(original);
    const resolved=lab.apply(command);
    if(resolved.status!=='applied')
      return deny(resolved.status==='blocked'
        ?resolved.reason:'Comando regional duplicado não gera novo candidato.');
    // A comparação integral inclui recibos, moedas, XP, bolso, UID,
    // capturas, batalhas e todos os campos extras preservados.
    if(JSON.stringify(resolved.snapshot)!==JSON.stringify(candidate))
      return deny('Candidato difere do resultado calculado pelo motor regional.');
    return structural;
  }catch{
    return deny('Não foi possível verificar a proposta regional canônica.');
  }
}
