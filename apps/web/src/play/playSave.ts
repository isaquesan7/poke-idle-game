/**
 * Save LOCAL do primeiro loop jogável v0.2.
 *
 * Não há contas ou backend. Este formato versionado é independente de v0.1
 * e pode ser reiniciado durante o desenvolvimento pré-lançamento, conforme
 * decisão D-027. Mantém JSON de domínio compatível com os reducers puros.
 * Web Locks são solicitados pelo controlador React, não pelo game-core.
 */
import {
  applyRewardEvent, editLegacyTrainerJson, prepareRewardJournal,
  reduceLegacyPokemonTeamJson, zeroStats, LEGACY_STARTERS
} from '@kanto/game-core';
import type {
  LegacyPokemonTeamAction, RewardJournal, RewardCommand, TrainerDraftAction
} from '@kanto/game-core';

export const PLAY_SAVE_KEY = 'kanto-idle-play-v02';
export const PLAY_LOCK_NAME = 'kanto-idle-play-v02-writer';

export interface PlaySnapshot {
  readonly schemaVersion: 2;
  readonly revision: number;
  readonly journal: RewardJournal;
}
export type PlayRead =
  | { readonly status: 'ready'; readonly snapshot: PlaySnapshot }
  | { readonly status: 'absent' | 'invalid' | 'unavailable' };

export type PlayAction =
  | { readonly type: 'trainer'; readonly value: TrainerDraftAction }
  | { readonly type: 'pokemon'; readonly value: LegacyPokemonTeamAction }
  | { readonly type: 'start-expedition' | 'claim-expedition' | 'stop-expedition'; readonly nowMs: number };

export type PlayWrite =
  | { readonly status: 'ok'; readonly snapshot: PlaySnapshot }
  | { readonly status: 'blocked'; readonly reason: string };

export interface PlayStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const goodNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export function readPlaySave(storage: Pick<PlayStorage, 'getItem'>): PlayRead {
  let raw: string | null;
  try { raw = storage.getItem(PLAY_SAVE_KEY); }
  catch { return { status: 'unavailable' }; }
  if (raw === null) return { status: 'absent' };
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.schemaVersion !== 2 || !goodNumber(value.revision)
      || !record(value.journal)) return { status: 'invalid' };
    const j = value.journal;
    if (typeof j.raw !== 'string' || !goodNumber(j.revision)
      || !Array.isArray(j.receipts) || j.receipts.length !== j.revision
      || prepareRewardJournal(j.raw) === null) return { status: 'invalid' };
    const ids = new Set<string>();
    for (const receipt of j.receipts as unknown[]) {
      if (!record(receipt) || typeof receipt.id !== 'string'
        || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/.test(receipt.id)
        || typeof receipt.fingerprint !== 'string' || ids.has(receipt.id)) {
        return { status: 'invalid' };
      }
      ids.add(receipt.id);
    }
    return { status: 'ready', snapshot: value as unknown as PlaySnapshot };
  } catch { return { status: 'invalid' }; }
}

function commit(storage: PlayStorage, expectedStored: string | null, next: PlaySnapshot): PlayWrite {
  try {
    // Rechecagem defensiva: CAS não é atômico sem Web Lock cooperativo.
    if (storage.getItem(PLAY_SAVE_KEY) !== expectedStored) {
      return { status: 'blocked', reason: 'Outra aba modificou o progresso. Atualize a página.' };
    }
    const encoded = JSON.stringify(next);
    storage.setItem(PLAY_SAVE_KEY, encoded);
    if (storage.getItem(PLAY_SAVE_KEY) !== encoded) {
      return { status: 'blocked', reason: 'Falha de verificação após salvar.' };
    }
    return { status: 'ok', snapshot: next };
  } catch {
    return { status: 'blocked', reason: 'Não foi possível salvar no navegador. Verifique o armazenamento.' };
  }
}

export function createPlaySave(
  storage: PlayStorage, name: string, starterId: number, nowMs: number, demo = false
): PlayWrite {
  if (readPlaySave(storage).status !== 'absent') {
    return { status: 'blocked', reason: 'Já existe progresso v0.2 ou armazenamento indisponível.' };
  }
  const nickname = name.trim();
  if (nickname.length < 2 || nickname.length > 24 || !LEGACY_STARTERS[starterId]
    || !goodNumber(nowMs)) {
    return { status: 'blocked', reason: 'Informe nome de 2–24 caracteres e escolha um inicial válido.' };
  }
  const game = {
    version: 1, mode: demo ? 'demo' : 'normal', createdAt: nowMs, name: nickname,
    trainer: {
      level: demo ? 21 : 1, xp: 0, manual: zeroStats(), equipped: {}, title: 'aprendiz'
    },
    coins: demo ? 200 : 0, wins: 0, losses: 0, seen: [starterId], badges: [],
    roster: [{
      uid: 1, pokemonId: starterId, level: demo ? 20 : 5,
      xp: 0, manual: zeroStats(), affinity: demo ? 70 : 0,
      moveName: starterId === 4 ? 'scratch' : 'tackle', upgrades: {}
    }],
    team: [1], nextUid: 2, expedition: null, lastClaim: null
  };
  const journal = prepareRewardJournal(JSON.stringify(game));
  if (!journal) return { status: 'blocked', reason: 'Falha ao preparar o perfil inicial.' };
  return commit(storage, null, { schemaVersion: 2, revision: 0, journal });
}

/**
 * Uma única transição imutável + uma gravação da chave v0.2.
 * O caller DEVE usar navigator.locks para coordenação entre abas.
 * Enquanto não existir backend, o relógio do dispositivo não é confiável.
 */
export function updatePlaySave(
  storage: PlayStorage, expectedRevision: number, action: PlayAction
): PlayWrite {
  const previous = readPlaySave(storage);
  if (previous.status !== 'ready') {
    return { status: 'blocked', reason: 'Progresso ausente, corrompido ou indisponível.' };
  }
  if (!goodNumber(expectedRevision) || expectedRevision !== previous.snapshot.revision) {
    return { status: 'blocked', reason: 'Revisão desatualizada. Atualize antes de jogar.' };
  }
  const journal = previous.snapshot.journal;
  let next: RewardJournal;
  if (action.type === 'trainer' || action.type === 'pokemon') {
    const result = action.type === 'trainer'
      ? editLegacyTrainerJson(journal.raw, action.value)
      : reduceLegacyPokemonTeamJson(journal.raw, action.value);
    if (result.status !== 'ok') return { status: 'blocked', reason: result.reason };
    next = { ...journal, raw: result.json };
  } else {
    const command: RewardCommand = {
      id: 'idle-v02-' + (previous.snapshot.revision + 1),
      expectedRevision: journal.revision,
      type: action.type,
      nowMs: action.nowMs
    };
    const result = applyRewardEvent(journal, command);
    if (result.status !== 'applied') {
      return { status: 'blocked', reason: result.status === 'rejected'
        ? result.reason : 'Comando já processado.' };
    }
    next = result.journal;
  }
  if (previous.snapshot.revision >= Number.MAX_SAFE_INTEGER) {
    return { status: 'blocked', reason: 'Limite de revisões atingido.' };
  }
  return commit(storage, JSON.stringify(previous.snapshot), {
    schemaVersion: 2, revision: previous.snapshot.revision + 1, journal: next
  });
}

/** Reinício do teste: apaga APENAS a chave v0.2, nunca os dados da v0.1. */
export function resetPlaySave(storage: PlayStorage): boolean {
  try {
    storage.removeItem(PLAY_SAVE_KEY);
    return storage.getItem(PLAY_SAVE_KEY) === null;
  } catch { return false; }
}
