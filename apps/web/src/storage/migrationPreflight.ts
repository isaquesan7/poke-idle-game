/**
 * Pré-verificação SOMENTE DE LEITURA antes de desenhar uma migração real.
 * "candidate" não autoriza gravações: a v0.1 antiga usa um writer
 * não cooperativo e pode alterar seu save depois desta leitura.
 */
import { validLegacyTrainerDraft } from '@kanto/game-core';
import { DRAFT_SAVE_KEY, readDraft } from './draftSave';
import type { StoragePort } from './draftSave';
import { LEGACY_SAVE_KEY, parseLegacySave } from './legacySave';

export type MigrationBlockReason =
  | 'absent' | 'invalid' | 'unsupported' | 'invalid-trainer'
  | 'invalid-draft' | 'stale-draft' | 'changed-during-read' | 'storage-unavailable';

export type MigrationPreflight =
  | {
    readonly status: 'candidate';
    readonly draft: 'absent' | 'aligned';
    readonly sourceBytes: number;
    readonly message: string;
  }
  | {
    readonly status: 'blocked';
    readonly reason: MigrationBlockReason;
    readonly message: string;
  };

function blocked(reason: MigrationBlockReason, message: string): MigrationPreflight {
  return { status: 'blocked', reason, message };
}

/**
 * Relatório estrutural, sem writes, sem migração e sem hash falsamente
 * descrito como segurança. Duplicar leitura ajuda a detectar mudança
 * durante esta consulta, mas NÃO garante snapshot transacional.
 */
export function inspectMigrationReadiness(storage: StoragePort): MigrationPreflight {
  try {
    const sourceBefore = storage.getItem(LEGACY_SAVE_KEY);
    const draftBefore = storage.getItem(DRAFT_SAVE_KEY);
    const sourceAfter = storage.getItem(LEGACY_SAVE_KEY);
    if (sourceBefore !== sourceAfter) {
      return blocked('changed-during-read', 'O jogo atualizou o save durante a verificação. Tente novamente.');
    }
    const parsed = parseLegacySave(sourceAfter);
    if (parsed.status === 'absent') return blocked('absent', 'Não há save v0.1 nesta origem.');
    if (parsed.status === 'unsupported') {
      return blocked('unsupported', 'Versão do save não reconhecida; nada será convertido.');
    }
    if (parsed.status !== 'valid') {
      return blocked('invalid', 'Save ausente, ilegível ou com dados inválidos; exporte e analise antes de migrar.');
    }
    if (!validLegacyTrainerDraft(parsed.raw, parsed.raw)) {
      return blocked('invalid-trainer', 'Estado do treinador incompatível com os limites da v0.1.');
    }

    let draft: 'absent' | 'aligned' = 'absent';
    if (draftBefore !== null) {
      const inspected = readDraft(storage);
      if (inspected.status === 'unavailable') {
        return blocked('storage-unavailable', 'Armazenamento indisponível durante a verificação.');
      }
      if (inspected.status === 'stale') {
        return blocked('stale-draft', 'O save real mudou depois que a simulação começou.');
      }
      if (inspected.status !== 'ready') {
        return blocked('invalid-draft', 'O rascunho é desconhecido ou está inconsistente.');
      }
      if (inspected.raw !== draftBefore
        || storage.getItem(LEGACY_SAVE_KEY) !== parsed.raw) {
        return blocked('changed-during-read', 'Dados mudaram durante a verificação. Não prossiga.');
      }
      draft = 'aligned';
    }
    if (storage.getItem(LEGACY_SAVE_KEY) !== parsed.raw
      || storage.getItem(DRAFT_SAVE_KEY) !== draftBefore) {
      return blocked('changed-during-read', 'Origem ou rascunho mudaram durante a verificação.');
    }
    return {
      status: 'candidate',
      draft,
      sourceBytes: new TextEncoder().encode(parsed.raw).length,
      message: 'Formato reconhecido para estudo. Ainda não há migração nem gravação do progresso real.'
    };
  } catch {
    return blocked('storage-unavailable', 'Armazenamento bloqueado ou inacessível; nada foi alterado.');
  }
}
