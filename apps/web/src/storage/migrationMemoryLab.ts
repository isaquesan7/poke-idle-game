/**
 * Laboratório v0.1 → v0.2 ESTRITAMENTE EM MEMÓRIA.
 *
 * A classe possui seu próprio Map PRIVADO. Não aceita Storage, localStorage,
 * IndexedDB, callbacks de escrita ou chaves configuráveis de fora; portanto
 * NENHUM método desta classe pode alterar o progresso real do navegador.
 *
 * O protocolo futuro ainda precisa de writer único, rollback e paridade
 * completa do jogo. Um 'committed' de laboratório NÃO libera escrita real.
 */
import { LEGACY_SAVE_KEY } from './legacySave';
import {
  COMMIT_MARKER_V02_KEY, OFFICIAL_V02_KEY,
  ORIGIN_BACKUP_V02_KEY, prepareRecoveryBundle, utf8ByteLength
} from './officialSaveV02';
import {
  auditRecoveryJournal, extractRecoverableLegacyRaw, planRecoveryJournal
} from './recoveryJournal';
import type { JournalAudit, RecoverySlots } from './recoveryJournal';
import { checkCooperativeRevision } from './writerCoordination';
import type { RevisionCheck } from './writerCoordination';

/** Exigida a cada simulação, não é consentimento para a migração real. */
export const LAB_CONFIRMATION_PHRASE = 'SIMULAR SOMENTE EM MEMORIA';

export type LabStep = 1 | 2 | 3;
export type LabFailureMode = 'none' | 'quota' | 'crash-after-backup'
  | 'crash-after-candidate' | 'crash-after-marker' | 'legacy-change-after-backup';

export type LabOutcome =
  | { readonly status: 'simulated'; readonly message: string }
  | { readonly status: 'interrupted' | 'blocked'; readonly message: string };

export interface LabSnapshot {
  readonly sourceRaw: string | null;
  readonly backupRaw: string | null;
  readonly candidateRaw: string | null;
  readonly markerRaw: string | null;
  readonly revision: number;
}

/** Nenhum objeto de armazenamento pode ser injetado: somente Map privado. */
export class MigrationMemoryLab {
  private readonly memory = new Map<string, string>();
  private readonly quotaBytes: number | null;
  private running = false;
  private revision = 0;

  constructor(sourceRaw: string, options: { readonly quotaBytes?: number } = {}) {
    this.memory.set(LEGACY_SAVE_KEY, sourceRaw);
    const quota = options.quotaBytes;
    this.quotaBytes = quota === undefined ? null : quota;
  }

  /** Snapshot somente leitura de valores do laboratório, nunca do navegador. */
  snapshot(): LabSnapshot {
    return {
      sourceRaw: this.memory.get(LEGACY_SAVE_KEY) ?? null,
      backupRaw: this.memory.get(ORIGIN_BACKUP_V02_KEY) ?? null,
      candidateRaw: this.memory.get(OFFICIAL_V02_KEY) ?? null,
      markerRaw: this.memory.get(COMMIT_MARKER_V02_KEY) ?? null,
      revision: this.revision
    };
  }

  private slots(): RecoverySlots {
    const now = this.snapshot();
    return {
      legacyRaw: now.sourceRaw, backupRaw: now.backupRaw,
      candidateRaw: now.candidateRaw, markerRaw: now.markerRaw
    };
  }

  /** Emula QuotaExceededError de uma gravação individual sem sair do Map. */
  private memoryWrite(key: string, value: string): boolean {
    if (this.quotaBytes !== null) {
      if (!Number.isSafeInteger(this.quotaBytes) || this.quotaBytes < 0) return false;
      let bytes = 0;
      for (const [existingKey, existingValue] of this.memory) {
        if (existingKey !== key) bytes += utf8ByteLength(existingKey) + utf8ByteLength(existingValue);
      }
      bytes += utf8ByteLength(key) + utf8ByteLength(value);
      if (bytes > this.quotaBytes) return false;
    }
    this.memory.set(key, value);
    return this.memory.get(key) === value;
  }

  /**
   * Simula a outra aba v0.1 (apenas no Map). NÃO faz save real nem mescla.
   * Usado para provar conflito com writer antigo não cooperativo.
   */
  simulateLegacyTabSave(nextRaw: string): void {
    this.memory.set(LEGACY_SAVE_KEY, nextRaw);
  }

  /**
   * Executa a sequência planejada no Map privado, somente após opt-in literal.
   * Trava double-submit, confere origem após cada await/etapa e para na primeira
   * falha; NUNCA apaga dados parciais para esconder um crash.
   */
  async simulateCutover(args: {
    readonly phrase: string;
    readonly expectedSourceRaw: string;
    readonly createdAt: number;
    readonly failure?: LabFailureMode;
  }): Promise<LabOutcome> {
    if (this.running) {
      return { status: 'blocked', message: 'Outra simulação já está em andamento.' };
    }
    if (args.phrase !== LAB_CONFIRMATION_PHRASE) {
      return { status: 'blocked', message: 'Confirmação explícita do laboratório necessária.' };
    }
    this.running = true;
    try {
      if (this.snapshot().sourceRaw !== args.expectedSourceRaw) {
        return { status: 'blocked', message: 'Origem do laboratório alterada; não mesclar.' };
      }
      const prepared = await prepareRecoveryBundle(args.expectedSourceRaw, args.createdAt);
      if (prepared.status !== 'ok') {
        return { status: 'blocked', message: prepared.reason };
      }
      const plan = await planRecoveryJournal(JSON.stringify(prepared.value), this.slots());
      if (plan.status !== 'planned') {
        return { status: 'blocked', message: plan.reason };
      }

      for (let index = 0; index < plan.steps.length; index++) {
        const stepNumber = (index + 1) as LabStep;
        if (this.snapshot().sourceRaw !== args.expectedSourceRaw) {
          return { status: 'interrupted', message: 'Save legado mudou antes da etapa seguinte.' };
        }
        const step = plan.steps[index]!;
        if (!this.memoryWrite(step.key, step.value)) {
          return {
            status: 'interrupted',
            message: 'Falha simulada de quota/permissão. Dados parciais preservados.'
          };
        }
        if (this.memory.get(step.key) !== step.value) {
          return { status: 'interrupted', message: 'Read-back falhou no laboratório.' };
        }
        if (args.failure === 'legacy-change-after-backup' && stepNumber === 1) {
          this.simulateLegacyTabSave(args.expectedSourceRaw + ' ');
        }
        const crashOn: Record<string, LabStep> = {
          'crash-after-backup': 1,
          'crash-after-candidate': 2,
          'crash-after-marker': 3
        };
        if (crashOn[args.failure ?? 'none'] === stepNumber) {
          return {
            status: 'interrupted',
            message: 'Crash simulado após a etapa ' + stepNumber + '; auditar o journal.'
          };
        }
      }
      const audited = await this.inspect();
      if (audited.status !== 'committed') {
        return {
          status: 'interrupted',
          message: 'Journal não ficou íntegro; não declarar migração concluída.'
        };
      }
      return {
        status: 'simulated',
        message: 'Journal íntegro SOMENTE EM MEMÓRIA. Nenhuma migração real foi feita.'
      };
    } catch {
      return { status: 'interrupted', message: 'Exceção no ensaio; preservar estado parcial.' };
    } finally {
      this.running = false;
    }
  }

  async inspect(): Promise<JournalAudit> {
    return auditRecoveryJournal(this.slots());
  }

  /** Extrai backup verificado apenas como TEXTO; NÃO restaura e não grava. */
  async extractBackup(): Promise<
    { readonly status: 'ok'; readonly originalRaw: string }
    | { readonly status: 'blocked'; readonly reason: string }
  > {
    return extractRecoverableLegacyRaw(this.slots());
  }

  /**
   * Simula revisões concorrentes de duas abas v0.2, sem tocar em save algum.
   * Cada chamada usa o número esperado anteriormente exibido pela aba.
   */
  simulateRevision(expectedRevision: number): RevisionCheck {
    const checked = checkCooperativeRevision(expectedRevision, this.revision);
    if (checked.status === 'fresh') this.revision = checked.nextRevision;
    return checked;
  }
}
