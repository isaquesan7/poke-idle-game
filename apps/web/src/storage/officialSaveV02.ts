/**
 * Contratos candidatos para o save oficial v0.2 e backup de origem v0.1.
 *
 * Este módulo é deliberadamente PURO em relação a armazenamento:
 * NÃO chama localStorage, não regrava o jogo, não promove rascunhos.
 * SHA-256 detecta corrupção acidental; NÃO autentica dados do jogador.
 */
import { validLegacyTrainerDraft } from '@kanto/game-core';
import { LEGACY_SAVE_KEY, parseLegacySave } from './legacySave';
import type { LegacySave } from './legacySave';

/** Chaves RESERVADAS para desenho/ensaios; NENHUMA é usada pelo runtime. */
export const OFFICIAL_V02_KEY = 'kanto-idle-lab-save-v02';
export const ORIGIN_BACKUP_V02_KEY = 'kanto-idle-lab-save-v02-origin-backup';
export const COMMIT_MARKER_V02_KEY = 'kanto-idle-lab-save-v02-commit';

/** Progresso de compatibilidade, ainda SEM motor de ações v0.2 conectado. */
export interface OfficialSaveV02 {
  readonly kind: 'kanto-official-save';
  readonly schemaVersion: 2;
  readonly revision: 0;
  readonly origin: {
    readonly sourceKey: typeof LEGACY_SAVE_KEY;
    readonly sha256: string;
    readonly byteLength: number;
  };
  /** Payload completo v0.1. Campos desconhecidos e Pokémon são preservados. */
  readonly payloadFormat: 'legacy-v01';
  readonly progress: LegacySave;
}

export interface OriginBackupV02 {
  readonly kind: 'kanto-origin-backup';
  readonly backupVersion: 1;
  readonly sourceKey: typeof LEGACY_SAVE_KEY;
  readonly sha256: string;
  readonly byteLength: number;
  /** Texto exato, com whitespace, ordem, campos desconhecidos e tudo mais. */
  readonly sourceRaw: string;
}

export interface RecoveryBundleV02 {
  readonly kind: 'kanto-recovery-bundle';
  readonly bundleVersion: 1;
  readonly createdAt: number;
  readonly backup: OriginBackupV02;
  readonly candidate: OfficialSaveV02;
}

export type BundleResult =
  | { readonly status: 'ok'; readonly value: RecoveryBundleV02 }
  | { readonly status: 'invalid' | 'unsupported' | 'unavailable'; readonly reason: string };

export type BackupInspection =
  | { readonly status: 'verified'; readonly backup: OriginBackupV02; readonly sourceRaw: string }
  | { readonly status: 'invalid' | 'unsupported'; readonly reason: string };

export type RecoveryInspection =
  | { readonly status: 'verified'; readonly bundle: RecoveryBundleV02; readonly sourceRaw: string }
  | { readonly status: 'invalid' | 'unsupported'; readonly reason: string };

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function natural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

/** Hash hex para verificação de integridade, não assinatura/antifraude. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}

/**
 * Prepara a cópia intacta e um payload versionado para testes OFFLINE.
 * Não cria um save ativo; nem o resultado nem as chaves são escritos no navegador.
 */
export async function prepareRecoveryBundle(
  originalRaw: string, createdAt: number
): Promise<BundleResult> {
  const parsed = parseLegacySave(originalRaw);
  if (parsed.status === 'unsupported') {
    return { status: 'unsupported', reason: 'Versão de origem desconhecida; conversão recusada.' };
  }
  if (parsed.status !== 'valid'
    || !validLegacyTrainerDraft(originalRaw, originalRaw)
    || !natural(createdAt)) {
    return { status: 'invalid', reason: 'Origem inválida ou carimbo de criação inválido.' };
  }
  try {
    const sha256 = await sha256Hex(originalRaw);
    const byteLength = utf8ByteLength(originalRaw);
    const backup: OriginBackupV02 = {
      kind: 'kanto-origin-backup', backupVersion: 1,
      sourceKey: LEGACY_SAVE_KEY, sha256, byteLength, sourceRaw: originalRaw
    };
    const candidate: OfficialSaveV02 = {
      kind: 'kanto-official-save', schemaVersion: 2, revision: 0,
      origin: { sourceKey: LEGACY_SAVE_KEY, sha256, byteLength },
      payloadFormat: 'legacy-v01',
      progress: parsed.save
    };
    return {
      status: 'ok', value: {
        kind: 'kanto-recovery-bundle', bundleVersion: 1, createdAt,
        backup, candidate
      }
    };
  } catch {
    return { status: 'unavailable', reason: 'SHA-256 indisponível nesta sessão.' };
  }
}

/** Recupera bytes exatos apenas se o backup passar por verificação de versão e digest. */
export async function inspectOriginBackup(raw: string): Promise<BackupInspection> {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { return { status: 'invalid', reason: 'JSON de backup danificado.' }; }
  if (!record(value)) return { status: 'invalid', reason: 'Backup não é um objeto.' };
  if (value.backupVersion !== 1 || value.kind !== 'kanto-origin-backup') {
    return { status: 'unsupported', reason: 'Formato de backup desconhecido.' };
  }
  if (value.sourceKey !== LEGACY_SAVE_KEY
    || typeof value.sourceRaw !== 'string'
    || typeof value.sha256 !== 'string'
    || !/^[0-9a-f]{64}$/.test(value.sha256)
    || !natural(value.byteLength)
    || value.byteLength !== utf8ByteLength(value.sourceRaw)) {
    return { status: 'invalid', reason: 'Metadados ou tamanho do backup inconsistentes.' };
  }
  const parsed = parseLegacySave(value.sourceRaw);
  if (parsed.status !== 'valid'
    || !validLegacyTrainerDraft(value.sourceRaw, value.sourceRaw)) {
    return { status: 'invalid', reason: 'O backup não contém um save v0.1 válido.' };
  }
  try {
    if (await sha256Hex(value.sourceRaw) !== value.sha256) {
      return { status: 'invalid', reason: 'Checksum SHA-256 do backup não confere.' };
    }
  } catch {
    return { status: 'invalid', reason: 'Não foi possível verificar o digest do backup.' };
  }
  return {
    status: 'verified',
    backup: value as unknown as OriginBackupV02,
    sourceRaw: value.sourceRaw
  };
}

/** Garante que o save candidato espelha integralmente a origem legada. */
export async function inspectRecoveryBundle(raw: string): Promise<RecoveryInspection> {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { return { status: 'invalid', reason: 'Pacote de recuperação não é JSON válido.' }; }
  if (!record(value)) return { status: 'invalid', reason: 'Pacote não é um objeto.' };
  if (value.bundleVersion !== 1 || value.kind !== 'kanto-recovery-bundle') {
    return { status: 'unsupported', reason: 'Pacote de recuperação de versão desconhecida.' };
  }
  if (!natural(value.createdAt) || !record(value.backup) || !record(value.candidate)) {
    return { status: 'invalid', reason: 'Envelope de recuperação inválido.' };
  }
  const backup = await inspectOriginBackup(JSON.stringify(value.backup));
  if (backup.status !== 'verified') {
    return { status: 'invalid', reason: 'Backup não verificável: ' + backup.reason };
  }
  const candidate = value.candidate;
  if (candidate.kind !== 'kanto-official-save' || candidate.schemaVersion !== 2
    || candidate.revision !== 0 || candidate.payloadFormat !== 'legacy-v01'
    || !record(candidate.origin)
    || candidate.origin.sourceKey !== LEGACY_SAVE_KEY
    || candidate.origin.sha256 !== backup.backup.sha256
    || candidate.origin.byteLength !== backup.backup.byteLength
    || !record(candidate.progress)) {
    return { status: 'invalid', reason: 'Save v0.2 candidato incompatível com a origem.' };
  }
  const legacy = parseLegacySave(backup.sourceRaw);
  if (legacy.status !== 'valid'
    || JSON.stringify(candidate.progress) !== JSON.stringify(legacy.save)) {
    return { status: 'invalid', reason: 'Progresso candidato divergiu da origem v0.1.' };
  }
  return {
    status: 'verified',
    bundle: value as unknown as RecoveryBundleV02,
    sourceRaw: backup.sourceRaw
  };
}

/** Retorna exatamente a origem recuperável; NÃO grava em chave alguma. */
export async function recoverLegacySource(bundleJson: string): Promise<
  { readonly status: 'ok'; readonly originalRaw: string }
  | { readonly status: 'blocked'; readonly reason: string }
> {
  const examined = await inspectRecoveryBundle(bundleJson);
  return examined.status === 'verified'
    ? { status: 'ok', originalRaw: examined.sourceRaw }
    : { status: 'blocked', reason: examined.reason };
}
