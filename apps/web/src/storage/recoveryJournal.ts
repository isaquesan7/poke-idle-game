/**
 * Plano de journal para migração FUTURA. Somente calcula comandos/diagnósticos;
 * nunca importa StoragePort nem chama localStorage / setItem / removeItem.
 *
 * Ordem de gravação projetada: backup → candidato → marcador de commit.
 * A coordenação de writers v0.1 ainda está PENDENTE e BLOQUEIA uso em produção.
 */
import {
  COMMIT_MARKER_V02_KEY, OFFICIAL_V02_KEY, ORIGIN_BACKUP_V02_KEY,
  inspectOriginBackup, inspectRecoveryBundle, sha256Hex
} from './officialSaveV02';
import { LEGACY_SAVE_KEY } from './legacySave';

export interface RecoverySlots {
  readonly legacyRaw: string | null;
  readonly backupRaw: string | null;
  readonly candidateRaw: string | null;
  readonly markerRaw: string | null;
}

export interface PlannedWrite {
  readonly key: typeof ORIGIN_BACKUP_V02_KEY
    | typeof OFFICIAL_V02_KEY | typeof COMMIT_MARKER_V02_KEY;
  readonly value: string;
}

interface CommitMarkerV02 {
  readonly kind: 'kanto-v02-commit';
  readonly markerVersion: 1;
  readonly sourceSha256: string;
  readonly backupSha256: string;
  readonly candidateSha256: string;
  readonly candidateRevision: 0;
}

export type WritePlan =
  | { readonly status: 'planned'; readonly steps: readonly PlannedWrite[] }
  | { readonly status: 'blocked'; readonly reason: string };

export type JournalAudit =
  | { readonly status: 'empty' }
  | { readonly status: 'backup-only' | 'staged' | 'committed'; readonly recoverableRaw: string }
  | { readonly status: 'conflict' | 'damaged'; readonly reason: string; readonly recoverableRaw?: string };

function record(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Produz instruções para ENSAIO, nunca executa. Se já existir qualquer chave
 * reservada, se o legado não coincidir ou se o pacote não for íntegro, bloqueia.
 */
export async function planRecoveryJournal(
  bundleJson: string, slots: RecoverySlots
): Promise<WritePlan> {
  if (slots.backupRaw !== null || slots.candidateRaw !== null || slots.markerRaw !== null) {
    return { status: 'blocked', reason: 'Há dados v0.2 anteriores. Não sobrescrever chaves existentes.' };
  }
  const bundle = await inspectRecoveryBundle(bundleJson);
  if (bundle.status !== 'verified') {
    return { status: 'blocked', reason: bundle.reason };
  }
  if (slots.legacyRaw !== bundle.sourceRaw) {
    return { status: 'blocked', reason: 'O save original mudou ou está ausente.' };
  }
  const backupRaw = JSON.stringify(bundle.bundle.backup);
  const candidateRaw = JSON.stringify(bundle.bundle.candidate);
  try {
    const marker: CommitMarkerV02 = {
      kind: 'kanto-v02-commit', markerVersion: 1,
      sourceSha256: bundle.bundle.backup.sha256,
      backupSha256: await sha256Hex(backupRaw),
      candidateSha256: await sha256Hex(candidateRaw),
      candidateRevision: 0
    };
    return {
      status: 'planned',
      steps: [
        { key: ORIGIN_BACKUP_V02_KEY, value: backupRaw },
        { key: OFFICIAL_V02_KEY, value: candidateRaw },
        { key: COMMIT_MARKER_V02_KEY, value: JSON.stringify(marker) }
      ]
    };
  } catch {
    return { status: 'blocked', reason: 'Não foi possível calcular checksums para o ensaio.' };
  }
}

/**
 * Reconhece estágios após crash sem promover dados nem "consertar" storage.
 * O retorno committed é diagnóstico para TESTES, não autorização de ativação.
 * A v0.1 pode gravar a qualquer instante, mesmo depois desta verificação.
 */
export async function auditRecoveryJournal(slots: RecoverySlots): Promise<JournalAudit> {
  const { backupRaw, candidateRaw, markerRaw, legacyRaw } = slots;
  if (backupRaw === null) {
    return candidateRaw === null && markerRaw === null
      ? { status: 'empty' }
      : { status: 'damaged', reason: 'Backup ausente; candidato ou marcador órfão.' };
  }

  const backup = await inspectOriginBackup(backupRaw);
  if (backup.status !== 'verified') {
    return { status: 'damaged', reason: backup.reason };
  }
  const recoverableRaw = backup.sourceRaw;
  if (legacyRaw !== recoverableRaw) {
    return {
      status: 'conflict',
      reason: 'O save v0.1 mudou desde a cópia. Nunca aplicar candidato antigo.',
      recoverableRaw
    };
  }
  if (candidateRaw === null) {
    return markerRaw === null
      ? { status: 'backup-only', recoverableRaw }
      : {
        status: 'damaged', reason: 'Marcador sem candidato; recuperação manual disponível.',
        recoverableRaw
      };
  }

  // Reusa todas as validações do contrato para detectar snapshot divergente.
  const bundle = await inspectRecoveryBundle(JSON.stringify({
    kind: 'kanto-recovery-bundle',
    bundleVersion: 1,
    createdAt: 0,
    backup: backup.backup,
    candidate: (() => {
      try { return JSON.parse(candidateRaw) as unknown; }
      catch { return null; }
    })()
  }));
  if (bundle.status !== 'verified') {
    return { status: 'damaged', reason: bundle.reason, recoverableRaw };
  }
  if (markerRaw === null) return { status: 'staged', recoverableRaw };

  let marker: unknown;
  try { marker = JSON.parse(markerRaw); }
  catch {
    return { status: 'damaged', reason: 'Marcador de commit ilegível.', recoverableRaw };
  }
  if (!record(marker) || marker.kind !== 'kanto-v02-commit'
    || marker.markerVersion !== 1 || marker.candidateRevision !== 0
    || marker.sourceSha256 !== backup.backup.sha256) {
    return { status: 'damaged', reason: 'Marcador incompatível.', recoverableRaw };
  }
  try {
    if (marker.backupSha256 !== await sha256Hex(backupRaw)
      || marker.candidateSha256 !== await sha256Hex(candidateRaw)) {
      return {
        status: 'damaged', reason: 'Checksums do candidato ou do backup divergentes.',
        recoverableRaw
      };
    }
  } catch {
    return { status: 'damaged', reason: 'Falha de verificação do marcador.', recoverableRaw };
  }
  return { status: 'committed', recoverableRaw };
}

/** Recuperação dos bytes do backup, mesmo se candidato/commit falharem. Sem gravar. */
export async function extractRecoverableLegacyRaw(slots: RecoverySlots): Promise<
  { readonly status: 'ok'; readonly originalRaw: string }
  | { readonly status: 'blocked'; readonly reason: string }
> {
  if (slots.backupRaw === null) {
    return { status: 'blocked', reason: 'Nenhum backup existe.' };
  }
  const examined = await inspectOriginBackup(slots.backupRaw);
  return examined.status === 'verified'
    ? { status: 'ok', originalRaw: examined.sourceRaw }
    : { status: 'blocked', reason: examined.reason };
}

export const RESERVED_RECOVERY_KEYS = [
  LEGACY_SAVE_KEY, ORIGIN_BACKUP_V02_KEY, OFFICIAL_V02_KEY, COMMIT_MARKER_V02_KEY
] as const;
