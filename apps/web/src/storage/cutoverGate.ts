/**
 * Gate SOMENTE DE LEITURA para um cutover futuro v0.1 → v0.2.
 *
 * Importante: este gate é intencionalmente FAIL-CLOSED e NÃO tem estado
 * 'allowed'. Preflight válido, Web Locks ou backup local não autorizam
 * migração. Futuros requisitos só poderão ser liberados em uma revisão
 * de arquitetura, com writer único, paridade de ações e nova decisão.
 *
 * Não chama setItem/removeItem, não cria backup nem importa save.
 */
import { DRAFT_SAVE_KEY } from './draftSave';
import type { StoragePort } from './draftSave';
import { LEGACY_SAVE_KEY } from './legacySave';
import { inspectMigrationReadiness } from './migrationPreflight';
import { COMMIT_MARKER_V02_KEY, OFFICIAL_V02_KEY, ORIGIN_BACKUP_V02_KEY } from './officialSaveV02';

export type CutoverBlockCode =
  | 'preflight-ineligible'
  | 'storage-unavailable'
  | 'snapshot-changed'
  | 'reserved-save-exists'
  | 'web-locks-unavailable'
  | 'legacy-writer-uncooperative'
  | 'gameplay-parity-incomplete'
  | 'official-writer-not-implemented'
  | 'external-backup-not-verified'
  | 'release-not-authorized';

export type CutoverBlock = {
  readonly code: CutoverBlockCode;
  readonly message: string;
};

export interface CutoverGateResult {
  readonly status: 'blocked';
  readonly canMigrate: false;
  readonly sourceCompatible: boolean;
  readonly blockers: readonly CutoverBlock[];
}

const REQUIRED_REMAINING_BLOCKS: readonly CutoverBlock[] = Object.freeze([
  {
    code: 'legacy-writer-uncooperative',
    message: 'Abas antigas da v0.1 ainda gravam sem participar de Web Locks.'
  },
  {
    code: 'gameplay-parity-incomplete',
    message: 'Batalha, captura, economia, expedição e demais ações ainda não foram portadas com paridade.'
  },
  {
    code: 'official-writer-not-implemented',
    message: 'O writer oficial v0.2, com revisão, cutover e rollback, não existe em produção.'
  },
  {
    code: 'external-backup-not-verified',
    message: 'Ainda não há confirmação verificável de backup recuperável fora desta origem.'
  },
  {
    code: 'release-not-authorized',
    message: 'Não houve aprovação de release para substituir o jogo v0.1.'
  }
]);

const READ_KEYS = [
  LEGACY_SAVE_KEY, DRAFT_SAVE_KEY,
  OFFICIAL_V02_KEY, ORIGIN_BACKUP_V02_KEY, COMMIT_MARKER_V02_KEY
] as const;

function additional(code: CutoverBlockCode, message: string): CutoverBlock {
  return { code, message };
}

/** O próprio tipo do resultado impede que esta implementação libere writes reais. */
export function inspectCutoverGate(
  storage: StoragePort,
  webLocksAvailable: boolean
): CutoverGateResult {
  const blockers: CutoverBlock[] = [];
  let sourceCompatible = false;
  try {
    // Repetir o snapshot antes/depois do preflight detecta ALGUMAS corridas,
    // nunca cria uma transação ou protege contra o writer legado posterior.
    const before = READ_KEYS.map(key => storage.getItem(key));
    const preflight = inspectMigrationReadiness(storage);
    const after = READ_KEYS.map(key => storage.getItem(key));
    sourceCompatible = preflight.status === 'candidate';
    if (!sourceCompatible) {
      blockers.push(additional(
        'preflight-ineligible',
        preflight.status === 'blocked' ? preflight.message : 'Preflight incompatível.'
      ));
    }
    if (before.some((value, i) => value !== after[i])) {
      blockers.push(additional(
        'snapshot-changed',
        'Os dados mudaram durante a leitura. Nenhuma migração é permitida.'
      ));
    }
    if (after.slice(2).some(value => value !== null)) {
      blockers.push(additional(
        'reserved-save-exists',
        'Já existem dados nas chaves reservadas da v0.2. Preservar e auditar.'
      ));
    }
  } catch {
    blockers.push(additional(
      'storage-unavailable',
      'Não foi possível ler o armazenamento. Nenhuma ação foi executada.'
    ));
  }

  if (!webLocksAvailable) {
    blockers.push(additional(
      'web-locks-unavailable',
      'Este navegador não oferece Web Locks para writers cooperativos.'
    ));
  }

  // Não aceitar flags vindas da UI ou de um suposto pacote "completo".
  // Este bloqueio é de RELEASE, não um checklist controlável por usuário.
  blockers.push(...REQUIRED_REMAINING_BLOCKS);
  return { status: 'blocked', canMigrate: false, sourceCompatible, blockers };
}
