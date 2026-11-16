/**
 * Rascunho v0.2 SEM MIGRAÇÃO: nunca altera a chave v0.1 do jogo.
 * Web Locks devem envolver TODO start/edit/discard no browser para
 * serializar abas cooperativas. A comparação de revisão isolada não é CAS
 * atômico; fora de Web Locks, estas operações servem apenas a testes.
 */
import { editLegacyTrainerJson, validLegacyTrainerDraft } from '@kanto/game-core';
import type { TrainerDraftAction } from '@kanto/game-core';
import { LEGACY_SAVE_KEY, parseLegacySave } from './legacySave';

export const DRAFT_SAVE_KEY = 'kanto-idle-lab-save-v02-draft';
export const DRAFT_LOCK_NAME = 'kanto-idle-v02-draft-writer';

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DraftEnvelope {
  readonly schemaVersion: 2;
  readonly revision: number;
  /** Exatamente o JSON v0.1 no momento da criação (âncora para detectar alterações). */
  readonly sourceRaw: string;
  /** Cópia de trabalho no MESMO formato v0.1; só manual/equipped podem diferir. */
  readonly workingRaw: string;
}

export type DraftRead =
  | { readonly status: 'ready'; readonly raw: string; readonly draft: DraftEnvelope }
  | { readonly status: 'absent' | 'unavailable' }
  | { readonly status: 'invalid' | 'stale'; readonly raw: string };

export type DraftWrite =
  | { readonly status: 'ok' }
  | { readonly status: 'conflict' | 'invalid' | 'unavailable'; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEnvelope(value: unknown): value is DraftEnvelope {
  return isRecord(value)
    && value.schemaVersion === 2
    && typeof value.revision === 'number'
    && Number.isSafeInteger(value.revision) && value.revision >= 0
    && typeof value.sourceRaw === 'string'
    && typeof value.workingRaw === 'string';
}

/** Dados estranhos/corrompidos permanecem preservados para descarte explícito. */
export function readDraft(storage: StoragePort): DraftRead {
  try {
    const raw = storage.getItem(DRAFT_SAVE_KEY);
    if (raw === null) return { status: 'absent' };
    let envelope: unknown;
    try { envelope = JSON.parse(raw); }
    catch { return { status: 'invalid', raw }; }
    if (!isEnvelope(envelope)
      || parseLegacySave(envelope.sourceRaw).status !== 'valid'
      || parseLegacySave(envelope.workingRaw).status !== 'valid'
      || !validLegacyTrainerDraft(envelope.sourceRaw, envelope.workingRaw)) {
      return { status: 'invalid', raw };
    }
    if (storage.getItem(LEGACY_SAVE_KEY) !== envelope.sourceRaw) {
      return { status: 'stale', raw };
    }
    return { status: 'ready', raw, draft: envelope };
  } catch {
    return { status: 'unavailable' };
  }
}

/**
 * Só inicia após ação explícita e quando o save legível é idêntico ao exibido.
 * Retornos são sempre tratados, sem fallback que sobrescreva algum save.
 */
export function createDraft(storage: StoragePort, expectedSourceRaw: string): DraftWrite {
  try {
    if (storage.getItem(DRAFT_SAVE_KEY) !== null) {
      return { status: 'conflict', reason: 'Já existe um rascunho. Não sobrescrevemos rascunhos anteriores.' };
    }
    if (storage.getItem(LEGACY_SAVE_KEY) !== expectedSourceRaw) {
      return { status: 'conflict', reason: 'O save v0.1 mudou; recarregue antes de criar uma simulação.' };
    }
    if (parseLegacySave(expectedSourceRaw).status !== 'valid'
      || !validLegacyTrainerDraft(expectedSourceRaw, expectedSourceRaw)) {
      return { status: 'invalid', reason: 'O formato do treinador não permite edição segura.' };
    }
    const envelope: DraftEnvelope = {
      schemaVersion: 2, revision: 0,
      sourceRaw: expectedSourceRaw, workingRaw: expectedSourceRaw
    };
    const raw = JSON.stringify(envelope);
    storage.setItem(DRAFT_SAVE_KEY, raw);
    if (storage.getItem(DRAFT_SAVE_KEY) !== raw) {
      return { status: 'conflict', reason: 'Outro rascunho mudou durante a gravação.' };
    }
    return { status: 'ok' };
  } catch {
    return { status: 'unavailable', reason: 'Armazenamento local indisponível ou sem espaço.' };
  }
}

/** Exige versão esperada e origem idêntica; edits são estritamente isolados. */
export function editDraft(
  storage: StoragePort, expectedRevision: number, action: TrainerDraftAction
): DraftWrite {
  try {
    const current = readDraft(storage);
    if (current.status !== 'ready') {
      return { status: 'conflict', reason: 'Rascunho ausente, antigo ou inválido. Nenhum progresso foi alterado.' };
    }
    if (current.draft.revision !== expectedRevision) {
      return { status: 'conflict', reason: 'Outra aba mudou o rascunho. Atualize a prévia antes de continuar.' };
    }
    const result = editLegacyTrainerJson(current.draft.workingRaw, action);
    if (result.status !== 'ok'
      || !validLegacyTrainerDraft(current.draft.sourceRaw, result.json)
      || parseLegacySave(result.json).status !== 'valid') {
      return { status: 'invalid', reason: result.status === 'invalid'
        ? result.reason : 'Mudança recusada por violar o isolamento do save.' };
    }
    // Nova leitura antes do único setItem (serializada pelo Web Lock no browser).
    if (storage.getItem(LEGACY_SAVE_KEY) !== current.draft.sourceRaw
      || storage.getItem(DRAFT_SAVE_KEY) !== current.raw) {
      return { status: 'conflict', reason: 'Dados foram modificados por outra aba. Rascunho preservado.' };
    }
    const next: DraftEnvelope = {
      ...current.draft, revision: current.draft.revision + 1, workingRaw: result.json
    };
    const nextRaw = JSON.stringify(next);
    storage.setItem(DRAFT_SAVE_KEY, nextRaw);
    if (storage.getItem(DRAFT_SAVE_KEY) !== nextRaw
      || storage.getItem(LEGACY_SAVE_KEY) !== current.draft.sourceRaw) {
      return { status: 'conflict', reason: 'Origem ou rascunho foi alterado durante a escrita.' };
    }
    return { status: 'ok' };
  } catch {
    return { status: 'unavailable', reason: 'Falha ao salvar a simulação. Save original não foi escrito.' };
  }
}

/** Apaga APENAS a simulação e somente após confirmação explícita da UI. */
export function discardDraft(storage: StoragePort, expectedRaw: string): DraftWrite {
  try {
    if (storage.getItem(DRAFT_SAVE_KEY) !== expectedRaw) {
      return { status: 'conflict', reason: 'Rascunho modificado em outra aba. Atualize antes de descartar.' };
    }
    storage.removeItem(DRAFT_SAVE_KEY);
    if (storage.getItem(DRAFT_SAVE_KEY) !== null) {
      return { status: 'conflict', reason: 'A simulação mudou durante o descarte.' };
    }
    return { status: 'ok' };
  } catch {
    return { status: 'unavailable', reason: 'Não foi possível descartar o rascunho.' };
  }
}
