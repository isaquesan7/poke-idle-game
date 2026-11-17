/**
 * TESTE DE NAVEGADOR: journal v0.2 em localStorage REAL, porém SOMENTE
 * na URL localhost /__kanto_v02_browser_lab__ e em chaves __kanto_lab__.
 *
 * NÃO importar no App.tsx, server.mjs ou no jogo público. A implementação
 * aborta fora dessa URL, nunca aceita chaves de gravação configuráveis e
 * não usa as chaves oficiais nem a chave v0.1. Mesmo "committed" é um
 * resultado de LABORATÓRIO, não um save jogável ou ativação de migração.
 */
import { prepareRecoveryBundle } from './officialSaveV02';
import {
  COMMIT_MARKER_V02_KEY, OFFICIAL_V02_KEY, ORIGIN_BACKUP_V02_KEY
} from './officialSaveV02';
import { auditRecoveryJournal, extractRecoverableLegacyRaw, planRecoveryJournal } from './recoveryJournal';
import type { JournalAudit, PlannedWrite, RecoverySlots } from './recoveryJournal';

export const SANDBOX_PATH = '/__kanto_v02_browser_lab__';
export const SANDBOX_LOCK = '__kanto_lab__exclusive_writer';
export const SANDBOX_CONSENT = 'CONFIRMO TESTE NO NAVEGADOR LOCAL';
export const SANDBOX_ROLLBACK_CONSENT = 'DESCARTAR APENAS CANDIDATO DE TESTE';

export const SANDBOX_KEYS = Object.freeze({
  legacy: '__kanto_lab__legacy',
  backup: '__kanto_lab__backup',
  candidate: '__kanto_lab__candidate',
  marker: '__kanto_lab__marker'
} as const);

export type BrowserLabOutcome =
  | { readonly status: 'simulated'; readonly stage: 'committed'; readonly message: string }
  | { readonly status: 'interrupted'; readonly stage: string; readonly message: string }
  | { readonly status: 'blocked'; readonly message: string };

/** Defesa em profundidade: exigir origem loopback e caminho de teste exato. */
function storageInSandbox(): Storage {
  if (typeof window === 'undefined'
    || window.location.protocol !== 'http:'
    || !['localhost', '127.0.0.1'].includes(window.location.hostname)
    || window.location.pathname !== SANDBOX_PATH) {
    throw Error('Laboratório indisponível fora da origem local e rota exclusiva.');
  }
  return window.localStorage;
}

/** Extrai apenas chaves fixas com prefixo __kanto_lab__ deste sandbox. */
export function snapshotBrowserLab(): RecoverySlots {
  const store = storageInSandbox();
  return {
    legacyRaw: store.getItem(SANDBOX_KEYS.legacy),
    backupRaw: store.getItem(SANDBOX_KEYS.backup),
    candidateRaw: store.getItem(SANDBOX_KEYS.candidate),
    markerRaw: store.getItem(SANDBOX_KEYS.marker)
  };
}

/**
 * Semeia cópia validada de fixture no namespace laboratório, sob lock.
 * Não lê nem escreve save real. Nunca sobrescreve dados do laboratório.
 */
export async function seedBrowserLab(
  sourceRaw: string, consent: string
): Promise<BrowserLabOutcome> {
  try {
    storageInSandbox();
    if (consent !== SANDBOX_CONSENT) {
      return { status:'blocked', message:'Confirmação do laboratório ausente.' };
    }
    return withSandboxLock(async () => {
      const before = snapshotBrowserLab();
      if (Object.values(before).some(v => v !== null)) {
        return { status:'blocked', message:'Laboratório já contém dados; sem substituição.' };
      }
      const prepared = await prepareRecoveryBundle(sourceRaw, 0);
      if (prepared.status !== 'ok') {
        return { status:'blocked', message:prepared.reason };
      }
      const store = storageInSandbox();
      store.setItem(SANDBOX_KEYS.legacy, sourceRaw);
      if (store.getItem(SANDBOX_KEYS.legacy) !== sourceRaw) {
        return { status:'blocked', message:'Falha ao confirmar escrita de teste.' };
      }
      return { status:'simulated', stage:'committed', message:'Fixture criada somente no laboratório.' };
    });
  } catch {
    return { status:'blocked', message:'Origem indisponível ou armazenamento negado.' };
  }
}

/**
 * Adquire lock distinto do oficial, apenas entre abas cooperativas do lab.
 * Captura exceções de quota; não interpreta falhas após escrita como sucesso.
 */
async function withSandboxLock(
  action: () => Promise<BrowserLabOutcome>
): Promise<BrowserLabOutcome> {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) {
    return { status:'blocked', message:'Web Locks indisponível; nenhuma gravação.' };
  }
  try {
    return await navigator.locks.request(
      SANDBOX_LOCK, { mode:'exclusive', ifAvailable:true },
      async lock => lock
        ? action()
        : { status:'blocked' as const, message:'Outra aba executa o laboratório.' }
    );
  } catch {
    return { status:'blocked', message:'Falha/Quota no armazenamento do laboratório.' };
  }
}

function labKeyForStep(key: PlannedWrite['key']): string {
  if (key === ORIGIN_BACKUP_V02_KEY) return SANDBOX_KEYS.backup;
  if (key === OFFICIAL_V02_KEY) return SANDBOX_KEYS.candidate;
  if (key === COMMIT_MARKER_V02_KEY) return SANDBOX_KEYS.marker;
  throw Error('Chave fora do laboratório.');
}

/**
 * Exercita setItem/getItem REAL do browser apenas com chaves prefixadas.
 * 'stopAfter' imita interrupção abrupta; reiniciar a aba preserva o journal.
 * Uma segunda execução é recusada se já existem dados do journal.
 */
export async function runBrowserLab(options: {
  readonly expectedSourceRaw: string;
  readonly consent: string;
  readonly stopAfter?: 1 | 2 | 3;
}): Promise<BrowserLabOutcome> {
  try {
    storageInSandbox();
    if (options.consent !== SANDBOX_CONSENT) {
      return { status:'blocked', message:'Confirmação do laboratório ausente.' };
    }
    return withSandboxLock(async () => {
      const before = snapshotBrowserLab();
      if (before.legacyRaw !== options.expectedSourceRaw) {
        return { status:'blocked', message:'Fixture alterada por outra aba.' };
      }
      const prepared = await prepareRecoveryBundle(options.expectedSourceRaw, 0);
      if (prepared.status !== 'ok') {
        return { status:'blocked', message:prepared.reason };
      }
      const planned = await planRecoveryJournal(JSON.stringify(prepared.value), before);
      if (planned.status !== 'planned') {
        return { status:'blocked', message:planned.reason };
      }
      const store = storageInSandbox();
      for (let index = 0; index < planned.steps.length; index++) {
        const step = planned.steps[index]!;
        const sandboxKey = labKeyForStep(step.key);
        if (store.getItem(SANDBOX_KEYS.legacy) !== options.expectedSourceRaw) {
          return {
            status:'interrupted', stage:'conflict',
            message:'Fixture divergiu durante o teste; nenhuma mescla.'
          };
        }
        if (store.getItem(sandboxKey) !== null) {
          return { status:'blocked', message:'Journal de teste já contém chave reservada.' };
        }
        try {
          store.setItem(sandboxKey, step.value);
          if (store.getItem(sandboxKey) !== step.value) {
            return { status:'interrupted', stage:'readback', message:'Read-back divergente.' };
          }
        } catch {
          return {
            status:'interrupted', stage:'quota',
            message:'Exceção real de quota/permissão; manter journal parcial.'
          };
        }
        if (options.stopAfter === index + 1) {
          return {
            status:'interrupted', stage:['backup-only','staged','committed'][index]!,
            message:'Interrupção simulada após escrita em localStorage de teste.'
          };
        }
      }
      const audited = await auditRecoveryJournal(snapshotBrowserLab());
      return audited.status === 'committed'
        ? { status:'simulated', stage:'committed', message:'Journal íntegro só no sandbox.' }
        : { status:'interrupted', stage:audited.status, message:'Journal incompleto; sem ativação.' };
    });
  } catch {
    return { status:'blocked', message:'Origem de laboratório inválida ou falha no storage.' };
  }
}

/** Auditoria após refresh; não reexecuta as escritas nem resolve conflito. */
export async function inspectBrowserLab(): Promise<JournalAudit> {
  return auditRecoveryJournal(snapshotBrowserLab());
}

/** Backup somente TEXTO para download, sem restaurar em chave alguma. */
export async function extractBrowserLabBackup(): Promise<
  { readonly status:'ok'; readonly originalRaw:string }
  | { readonly status:'blocked'; readonly reason:string }
> {
  return extractRecoverableLegacyRaw(snapshotBrowserLab());
}

/**
 * Rollback EXPLÍCITO somente de candidato e marcador prefixados. Conserva
 * origem e backup; bloqueia se a origem divergiu ou journal está danificado.
 * Falhas entre removeItem são auditáveis; nunca limpa o namespace inteiro.
 */
export async function rollbackBrowserLab(consent: string): Promise<BrowserLabOutcome> {
  try {
    storageInSandbox();
    if (consent !== SANDBOX_ROLLBACK_CONSENT) {
      return { status:'blocked', message:'Confirmação específica de rollback ausente.' };
    }
    return withSandboxLock(async () => {
      const audited = await auditRecoveryJournal(snapshotBrowserLab());
      if (audited.status !== 'committed' && audited.status !== 'staged') {
        return { status:'blocked', message:'Journal não elegível ou origem divergente; preservar dados.' };
      }
      const store = storageInSandbox();
      const sourceBefore = store.getItem(SANDBOX_KEYS.legacy);
      if (sourceBefore !== audited.recoverableRaw) {
        return { status:'blocked', message:'Origem mudou; não descartar candidato.' };
      }
      store.removeItem(SANDBOX_KEYS.marker);
      store.removeItem(SANDBOX_KEYS.candidate);
      const after = snapshotBrowserLab();
      if (after.legacyRaw !== sourceBefore
        || after.backupRaw === null
        || after.markerRaw !== null || after.candidateRaw !== null) {
        return { status:'interrupted', stage:'rollback-partial', message:'Rollback parcial. Auditar.' };
      }
      const verified = await auditRecoveryJournal(after);
      return verified.status === 'backup-only'
        ? {
          status:'simulated',stage:'committed',
          message:'Rollback do candidato de teste; origem e backup preservados.'
        }
        : {
          status:'interrupted',stage:verified.status,message:'Rollback não verificável.'
        };
    });
  } catch {
    return { status:'blocked', message:'Falha ao executar rollback de laboratório.' };
  }
}
