/**
 * Exportação e CONFERÊNCIA de pacotes de recuperação: somente leitura.
 * Nenhum arquivo recebido é importado para localStorage nem aplicado ao jogo.
 * O backup exportado também não promove rascunhos ou save v0.2.
 */
import { LEGACY_SAVE_KEY } from './legacySave';
import {
  inspectRecoveryBundle, prepareRecoveryBundle
} from './officialSaveV02';

export const MAX_RECOVERY_FILE_BYTES = 8 * 1024 * 1024;

export interface ReadStorage {
  getItem(key: string): string | null;
}

export type RecoveryExport =
  | { readonly status: 'ready'; readonly fileName: string; readonly json: string }
  | { readonly status: 'blocked'; readonly reason: string };

export type RecoveryFileCheck =
  | { readonly status: 'matching'; readonly reason: string; readonly sha256: string }
  | { readonly status: 'different' | 'missing'; readonly reason: string; readonly sha256: string }
  | { readonly status: 'invalid' | 'unavailable'; readonly reason: string };

/**
 * Gera bytes de arquivo downloadável SÓ quando o save visto pela UI é
 * idêntico ao atual durante toda a operação assíncrona do SHA-256.
 * v0.1 pode alterar seu save após a última leitura: por isso não é
 * uma transação e não concede permissão de migração.
 */
export async function prepareVerifiedRecoveryExport(
  storage: ReadStorage, expectedLegacyRaw: string, createdAt: number
): Promise<RecoveryExport> {
  try {
    if (storage.getItem(LEGACY_SAVE_KEY) !== expectedLegacyRaw) {
      return {
        status: 'blocked',
        reason: 'O progresso mudou em outra aba. Atualize antes de exportar.'
      };
    }
    const generated = await prepareRecoveryBundle(expectedLegacyRaw, createdAt);
    if (generated.status !== 'ok') {
      return { status: 'blocked', reason: generated.reason };
    }
    if (storage.getItem(LEGACY_SAVE_KEY) !== expectedLegacyRaw) {
      return {
        status: 'blocked',
        reason: 'O progresso mudou durante o cálculo do backup.'
      };
    }
    const json = JSON.stringify(generated.value, null, 2);
    const inspected = await inspectRecoveryBundle(json);
    if (inspected.status !== 'verified'
      || inspected.sourceRaw !== expectedLegacyRaw) {
      return {
        status: 'blocked',
        reason: 'O pacote gerado não passou na verificação de integridade.'
      };
    }
    if (storage.getItem(LEGACY_SAVE_KEY) !== expectedLegacyRaw) {
      return {
        status: 'blocked',
        reason: 'O save foi atualizado; não exportamos uma cópia potencialmente antiga.'
      };
    }
    return {
      status: 'ready',
      fileName: 'kanto-idle-v01-recovery-verified.json',
      json
    };
  } catch {
    return {
      status: 'blocked',
      reason: 'Armazenamento ou verificação SHA-256 indisponível.'
    };
  }
}

/**
 * Conferência de arquivo externo; NUNCA restaura, escreve ou exclui dados.
 * "matching" só indica igualdade literal do backup com o progresso atual,
 * e NÃO garante que uma aba v0.1 deixe de escrever logo em seguida.
 */
export async function inspectRecoveryFile(
  fileRaw: string, storage: ReadStorage
): Promise<RecoveryFileCheck> {
  try {
    if (new TextEncoder().encode(fileRaw).byteLength > MAX_RECOVERY_FILE_BYTES) {
      return { status: 'invalid', reason: 'Arquivo excede o limite de 8 MiB.' };
    }
    const inspected = await inspectRecoveryBundle(fileRaw);
    if (inspected.status !== 'verified') {
      return { status: 'invalid', reason: inspected.reason };
    }
    const source = storage.getItem(LEGACY_SAVE_KEY);
    if (source === null) {
      return {
        status: 'missing',
        reason: 'Pacote íntegro, mas não há save v0.1 nesta origem. Nenhum dado importado.',
        sha256: inspected.bundle.backup.sha256
      };
    }
    if (source !== inspected.sourceRaw) {
      return {
        status: 'different',
        reason: 'Pacote íntegro, mas diferente do save atual. Não misturar progressos.',
        sha256: inspected.bundle.backup.sha256
      };
    }
    return {
      status: 'matching',
      reason: 'Pacote íntegro e igual ao save atual. Nenhum dado foi restaurado.',
      sha256: inspected.bundle.backup.sha256
    };
  } catch {
    return { status: 'unavailable', reason: 'Não foi possível conferir o arquivo.' };
  }
}
