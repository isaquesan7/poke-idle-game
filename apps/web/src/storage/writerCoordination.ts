/**
 * Coordenação experimental do futuro writer v0.2.
 *
 * NÃO grava saves, não migra e não tenta bloquear o jogo v0.1: abas já
 * abertas da v0.1 gravam sem Web Locks e NÃO participam deste protocolo.
 * A única resolução segura de um desvio entre v0.1/v0.2 é alertar e
 * preservar AMBAS as versões, sem mesclar progresso automaticamente.
 */
import { auditRecoveryJournal } from './recoveryJournal';
import type { RecoverySlots } from './recoveryJournal';

/** Nome exclusivo para writers v0.2 cooperativos, distinto do lock do draft. */
export const OFFICIAL_V02_LOCK_NAME = 'kanto-idle-v02-official-writer';

export type WriterHandoff = {
  readonly state:
    | 'legacy-only' | 'backup-incomplete' | 'v02-isolated'
    | 'legacy-diverged' | 'damaged';
  readonly canWriteRealSave: false;
  readonly message: string;
  readonly recoveryRaw?: string;
};

/**
 * Interpreta snapshots já obtidos do armazenamento, sem acessar browser.
 * Mesmo em v02-isolated a escrita REAL continua explicitamente proibida:
 * o motor v0.2 e a política de cutover ainda não estão em produção.
 */
export async function inspectWriterHandoff(
  slots: RecoverySlots
): Promise<WriterHandoff> {
  const audit = await auditRecoveryJournal(slots);
  switch (audit.status) {
    case 'empty':
      return {
        state: 'legacy-only',
        canWriteRealSave: false,
        message: 'Somente v0.1 detectada. Nenhuma migração foi iniciada.'
      };
    case 'backup-only':
    case 'staged':
      return {
        state: 'backup-incomplete',
        canWriteRealSave: false,
        message: 'Transição incompleta. Preserve os dados e examine o backup.',
        recoveryRaw: audit.recoverableRaw
      };
    case 'committed':
      return {
        state: 'v02-isolated',
        canWriteRealSave: false,
        message: 'Commit v0.2 estruturalmente íntegro. Escrita real permanece desabilitada.',
        recoveryRaw: audit.recoverableRaw
      };
    case 'conflict':
      return {
        state: 'legacy-diverged',
        canWriteRealSave: false,
        message: 'v0.1 mudou após a cópia; as duas versões devem permanecer separadas.',
        ...(audit.recoverableRaw === undefined ? {} : { recoveryRaw: audit.recoverableRaw })
      };
    case 'damaged':
      return {
        state: 'damaged',
        canWriteRealSave: false,
        message: 'Journal inválido ou incompleto. Não aplicar alterações.',
        ...(audit.recoverableRaw === undefined ? {} : { recoveryRaw: audit.recoverableRaw })
      };
  }
}

export type RevisionCheck =
  | { readonly status: 'fresh'; readonly nextRevision: number }
  | { readonly status: 'stale' | 'invalid'; readonly reason: string };

/** Validação a ser repetida DENTRO do lock antes de toda futura escrita. */
export function checkCooperativeRevision(
  expectedRevision: number, observedRevision: number
): RevisionCheck {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0
    || !Number.isSafeInteger(observedRevision) || observedRevision < 0
    || observedRevision >= Number.MAX_SAFE_INTEGER) {
    return { status: 'invalid', reason: 'Revisão inválida ou esgotada.' };
  }
  if (expectedRevision !== observedRevision) {
    return { status: 'stale', reason: 'Outra aba já avançou a revisão do save v0.2.' };
  }
  return { status: 'fresh', nextRevision: observedRevision + 1 };
}

export type ExclusiveOutcome<T> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'blocked'; readonly reason: string };

/**
 * Pede Web Lock sem fila para uma futura operação COOPERATIVA v0.2.
 * Nunca executa a operação se não houver suporte ou se outra aba usar
 * o lock. O callback é um ensaio agora; não é conectado ao progresso real.
 *
 * Exceções não são interpretadas como "nada foi escrito": no futuro,
 * eventual falha depois de escrita exige auditoria do journal.
 */
export async function withExclusiveV02Writer<T>(
  locks: LockManager | null | undefined, action: () => Promise<T> | T
): Promise<ExclusiveOutcome<T>> {
  if (!locks || typeof locks.request !== 'function') {
    return {
      status: 'blocked',
      reason: 'Web Locks indisponível. Escrita v0.2 não deve acontecer.'
    };
  }
  try {
    return await locks.request(
      OFFICIAL_V02_LOCK_NAME,
      { mode: 'exclusive', ifAvailable: true },
      async lock => {
        if (!lock) {
          return {
            status: 'blocked' as const,
            reason: 'Outra aba possui o lock v0.2. Recarregue antes de editar.'
          };
        }
        return { status: 'ok' as const, value: await action() };
      }
    );
  } catch {
    return {
      status: 'blocked',
      reason: 'Operação v0.2 falhou. Audite o journal antes de qualquer nova tentativa.'
    };
  }
}
