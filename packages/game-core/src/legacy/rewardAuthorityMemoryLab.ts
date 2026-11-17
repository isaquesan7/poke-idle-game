/**
 * SIMULAÇÃO de autoridade ÚNICA de recompensas, estritamente em RAM.
 *
 * Este laboratório nunca recebe Storage/DB, não lê DOM, relógio, rede,
 * localStorage ou chaves configuráveis. O Map privado simula UM registro
 * canônico gravado atomicamente (save + revisão + recibos). Ao destruir
 * a instância, perde-se o registro: NÃO é ledger durável nem writer real.
 *
 * Múltiplos clientes do MESMO laboratório compartilham esta autoridade.
 * Instâncias distintas continuam independentes: NÃO há coordenação entre
 * processos, máquinas, versões legadas ou dispositivos.
 * O resultado de batalha/captura chega pré-resolvido e NÃO é autenticado.
 */
import { applyRewardEvent, prepareRewardJournal } from './rewardEvents.js';
import type { RewardCommand, RewardJournal } from './rewardEvents.js';

/** Chave fixa, exclusiva do Map privado; nunca uma chave de storage real. */
const PRIVATE_SLOT = '__kanto_lab__reward_authority_in_memory';
const SCHEMA = 1;

type Stored = {
  readonly schema: 1;
  readonly journal: RewardJournal;
  /** Detecção de dano acidental, NÃO assinatura/autenticação/antifraude. */
  readonly checksum: string;
};

export type AuthorityFault = 'none' | 'before-commit' | 'after-commit';
export type AuthorityResult =
  | { readonly status: 'applied' | 'duplicate'; readonly revision: number }
  | { readonly status: 'rejected' | 'interrupted' | 'damaged'; readonly reason: string };

export interface RewardAuthorityLabClient {
  /** Snapshot é cópia; editar a cópia não modifica o registro canônico. */
  readonly read: () => RewardJournal | null;
  /** Duas chamadas simultâneas são serializadas pelo único Map/turno JS. */
  readonly submit: (command: RewardCommand, fault?: AuthorityFault) => Promise<AuthorityResult>;
}

/** Checksum FNV-1a para detectar dano no laboratório, sem segurança criptográfica. */
function checksum(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function validJournal(value: unknown): value is RewardJournal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const journal = value as Record<string, unknown>;
  if (typeof journal.raw !== 'string'
    || !Number.isSafeInteger(journal.revision)
    || (journal.revision as number) < 0
    || !Array.isArray(journal.receipts)
    || journal.receipts.length !== journal.revision) return false;
  if (prepareRewardJournal(journal.raw) === null) return false;
  const seen = new Set<string>();
  for (const receipt of journal.receipts as unknown[]) {
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false;
    const entry = receipt as Record<string, unknown>;
    if (typeof entry.id !== 'string'
      || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/.test(entry.id)
      || seen.has(entry.id)
      || typeof entry.fingerprint !== 'string') return false;
    seen.add(entry.id);
  }
  return true;
}

/** Único ledger in-memory; não há injeção de Map, Storage ou chave. */
export class RewardAuthorityMemoryLab {
  private readonly memory = new Map<string, string>();

  constructor(sourceRaw: string) {
    const journal = prepareRewardJournal(sourceRaw);
    if (!journal) throw new RangeError('Origem v0.1 inválida para o laboratório.');
    this.write(journal);
  }

  /** Um write de UMA entrada substitui estado e recibos juntos (só em RAM). */
  private write(journal: RewardJournal): void {
    const serialized = JSON.stringify(journal);
    const slot: Stored = { schema: SCHEMA, journal, checksum: checksum(serialized) };
    this.memory.set(PRIVATE_SLOT, JSON.stringify(slot));
  }

  /** Fail-closed se registro, revisão, JSON ou checksum estiverem danificados. */
  private load(): RewardJournal | null {
    const value = this.memory.get(PRIVATE_SLOT);
    if (!value) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      const slot = parsed as Record<string, unknown>;
      if (slot.schema !== SCHEMA || !validJournal(slot.journal)
        || typeof slot.checksum !== 'string'
        || checksum(JSON.stringify(slot.journal)) !== slot.checksum) return null;
      return slot.journal;
    } catch {
      return null;
    }
  }

  /** Devolve somente uma cópia do registro, sem referência ao Map interno. */
  snapshot(): RewardJournal | null {
    const journal = this.load();
    return journal ? JSON.parse(JSON.stringify(journal)) as RewardJournal : null;
  }

  /** Cria dois ou mais clientes concorrentes da MESMA autoridade simulada. */
  openClient(): RewardAuthorityLabClient {
    return {
      read: () => this.snapshot(),
      submit: (command, fault = 'none') => this.submit(command, fault)
    };
  }

  /**
   * Simula uma transação serializada: ler registro canônico, validar ID/revisão,
   * aplicar reducer puro, escrever ledger+save juntos, verificar read-back.
   * NÃO há await entre a leitura e a escrita; JS executa tudo num turno.
   */
  private async submit(command: RewardCommand, fault: AuthorityFault): Promise<AuthorityResult> {
    // Expõe concorrência real de Promise.all; após este await não há
    // interrupção entre leitura, validação e commit no mesmo objeto.
    await Promise.resolve();
    const current = this.load();
    if (!current) {
      return { status: 'damaged', reason: 'Registro do laboratório danificado; não aplicar.' };
    }
    const result = applyRewardEvent(current, command);
    if (result.status === 'rejected') {
      return { status: 'rejected', reason: result.reason };
    }
    if (result.status === 'duplicate') {
      return { status: 'duplicate', revision: current.revision };
    }
    if (fault === 'before-commit') {
      return { status: 'interrupted', reason: 'Falha simulada ANTES do commit em RAM.' };
    }
    // Não há múltiplas chaves ou duas gravações a serem conciliadas.
    this.write(result.journal);
    const persisted = this.load();
    if (!persisted || persisted.revision !== result.journal.revision
      || JSON.stringify(persisted) !== JSON.stringify(result.journal)) {
      return { status: 'damaged', reason: 'Falha no read-back do ledger do laboratório.' };
    }
    if (fault === 'after-commit') {
      return {
        status: 'interrupted',
        reason: 'Commit feito em RAM, mas a resposta foi perdida; reenvie MESMO ID/payload.'
      };
    }
    return { status: 'applied', revision: persisted.revision };
  }

  /** Somente para ensaio: corrompe checksum do Map, nunca dado do jogador. */
  simulateCorruptionForTest(): void {
    const value = this.memory.get(PRIVATE_SLOT);
    if (!value) return;
    const slot = JSON.parse(value) as Stored;
    this.memory.set(PRIVATE_SLOT, JSON.stringify({ ...slot, checksum: 'invalid' }));
  }
}
