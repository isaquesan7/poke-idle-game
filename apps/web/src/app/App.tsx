import { useEffect, useState } from 'react';
import type { EquipmentSlot, Stat, TrainerDraftAction } from '@kanto/game-core';
import { LEGACY_CACHE_KEY, LEGACY_SAVE_KEY, parseLegacySave, readLegacySave } from '../storage/legacySave';
import type { LegacySaveResult } from '../storage/legacySave';
import {
  DRAFT_LOCK_NAME, DRAFT_SAVE_KEY, createDraft, discardDraft, editDraft, readDraft
} from '../storage/draftSave';
import type { DraftRead, DraftWrite } from '../storage/draftSave';
import { projectLegacyTrainer } from '../features/trainer/legacyProjection';
import { inspectMigrationReadiness } from '../storage/migrationPreflight';
import { inspectCutoverGate } from '../storage/cutoverGate';
import { OverviewPreview } from '../features/trainer/OverviewPreview';
import { TrainerPreview } from '../features/trainer/TrainerPreview';
import { TrainerDraftControls } from '../features/trainer/TrainerDraftControls';
import { RecoveryExchangePanel } from '../features/storage/RecoveryExchangePanel';
import { MigrationLabPanel } from '../features/storage/MigrationLabPanel';
import styles from './App.module.css';

function statusText(result: LegacySaveResult): string {
  switch (result.status) {
    case 'valid': return 'Progresso v0.1 encontrado neste navegador';
    case 'absent': return 'Nenhum save v0.1 encontrado nesta origem';
    case 'invalid': return 'Save local incompatível ou danificado; não foi alterado';
    case 'unsupported': return 'Save de outra versão preservado sem modificações';
    case 'unavailable': return 'Armazenamento local indisponível nesta sessão';
  }
}

/** UI experimental: NUNCA escreve na chave de save v0.1 do jogo publicado. */
export function App() {
  const [result, setResult] = useState<LegacySaveResult>(() =>
    readLegacySave(key => window.localStorage.getItem(key))
  );
  const [draft, setDraft] = useState<DraftRead>(() => readDraft(window.localStorage));
  const [feedback, setFeedback] = useState('');
  const [draftFeedback, setDraftFeedback] = useState('');
  const [screen, setScreen] = useState<'overview' | 'trainer'>('overview');
  const [cacheRaw, setCacheRaw] = useState<string | null>(() => {
    try { return window.localStorage.getItem(LEGACY_CACHE_KEY); }
    catch { return null; }
  });

  // Outras abas podem continuar jogando v0.1. Invalidar projeções desatualizadas.
  useEffect(() => {
    function changed(event: StorageEvent) {
      if (event.key === DRAFT_SAVE_KEY || event.key === LEGACY_SAVE_KEY || event.key === null) {
        setDraft(readDraft(window.localStorage));
        setResult(readLegacySave(key => window.localStorage.getItem(key)));
      }
      if (event.key === LEGACY_CACHE_KEY || event.key === null) {
        try { setCacheRaw(window.localStorage.getItem(LEGACY_CACHE_KEY)); }
        catch { setCacheRaw(null); }
      }
    }
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);

  // O save original é sempre a fonte de backup; rascunho nunca o substitui.
  const simulated = draft.status === 'ready' ? parseLegacySave(draft.draft.workingRaw) : null;
  const displayed = simulated?.status === 'valid' ? simulated : result;
  // Leitura pura: diagnóstico de estrutura, NÃO uma autorização de migração.
  const migrationCheck = inspectMigrationReadiness(window.localStorage);
  // Gate de release é somente leitura e SEMPRE bloqueia a migração real.
  const cutoverGate = inspectCutoverGate(window.localStorage, Boolean(navigator.locks?.request));
  const projected = displayed.status === 'valid'
    ? projectLegacyTrainer(displayed.save, cacheRaw, Date.now()) : null;

  function exportSave(): void {
    if (result.status !== 'valid') return;
    const url = URL.createObjectURL(new Blob([result.raw], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kanto-idle-save-v01-backup.json';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setFeedback('Backup do JSON original solicitado; nenhum progresso foi modificado.');
  }

  /**
   * Web Locks serializam aba/guia no mesmo domínio. Sem suporte a Web Locks
   * NÃO tentamos editar, pois localStorage sozinho não oferece CAS atômico.
   */
  async function locked(action: () => DraftWrite): Promise<void> {
    if (!navigator.locks?.request) {
      setDraftFeedback('Simulação indisponível: este navegador não oferece bloqueio seguro entre abas.');
      return;
    }
    try {
      const outcome = await navigator.locks.request(
        DRAFT_LOCK_NAME, { mode: 'exclusive' }, action
      );
      setDraft(readDraft(window.localStorage));
      setResult(readLegacySave(key => window.localStorage.getItem(key)));
      setDraftFeedback(outcome.status === 'ok'
        ? 'Simulação atualizada. O save v0.1 permanece intocado.'
        : outcome.reason);
    } catch {
      setDraftFeedback('Não foi possível bloquear a edição. Nenhum comando foi aplicado ao save real.');
      setDraft(readDraft(window.localStorage));
    }
  }

  function startSimulation(): void {
    if (result.status !== 'valid') return;
    void locked(() => createDraft(window.localStorage, result.raw));
  }

  function editSimulation(action: TrainerDraftAction): void {
    if (draft.status !== 'ready') return;
    void locked(() => editDraft(window.localStorage, draft.draft.revision, action));
  }

  function dropSimulation(): void {
    if (draft.status !== 'ready' && draft.status !== 'stale' && draft.status !== 'invalid') return;
    if (!window.confirm('Descartar SOMENTE a simulação v0.2? Seu progresso real v0.1 será preservado.')) return;
    void locked(() => discardDraft(window.localStorage, draft.raw));
  }

  function draftDescription(): string {
    switch (draft.status) {
      case 'absent': return 'Nenhuma simulação criada; progresso real v0.1 intocado.';
      case 'ready': return 'Simulação separada ativa · revisão ' + draft.draft.revision + '.';
      case 'stale': return 'Save real mudou desde o início da simulação. Edições bloqueadas.';
      case 'invalid': return 'Rascunho inválido/desconhecido. Edições bloqueadas e conteúdo preservado.';
      case 'unavailable': return 'Armazenamento de simulação indisponível.';
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>Kanto Idle LAB / Foundation v0.2</div>
        <h1>Nova base de interface</h1>
        <p>Prévia técnica React + TypeScript + Vite. O jogo completo continua na versão v0.1 publicada.</p>
      </header>
      <section className={styles.panel} aria-labelledby="save-heading">
        <h2 id="save-heading">Compatibilidade de progresso</h2>
        <p className={styles.status}>{statusText(result)}</p>
        {result.status === 'valid' && (
          <>
            <div className={styles.stats}>
              <div><strong>{result.save.trainer.level}</strong><span>Nível treinador</span></div>
              <div><strong>{result.save.roster.length}</strong><span>Pokémon capturados</span></div>
              <div><strong>{result.save.coins}</strong><span>Moedas</span></div>
            </div>
            <button className={styles.button} type="button" onClick={exportSave}>
              Exportar backup v0.1
            </button>
            <p className={styles.feedback} role="status" aria-live="polite">{feedback}</p>
          </>
        )}
        <p className={styles.note}>A prévia não migra nem modifica saves v0.1. Armazenamentos de domínios diferentes não são compartilhados automaticamente.</p>
      </section>
      <section className={styles.migrationCheck} aria-labelledby="migration-heading">
        <h2 id="migration-heading">Verificação de compatibilidade para migração futura</h2>
        <p className={styles.migrationStatus} role="status">
          {migrationCheck.status === 'candidate'
            ? 'Formato reconhecido · ' + (migrationCheck.draft === 'aligned'
              ? 'simulação compatível' : 'sem simulação')
            : 'Migração indisponível · ' + migrationCheck.message}
        </p>
        <p className={styles.note}>
          Esta análise não modifica, converte ou sincroniza saves. O jogo v0.1 ainda
          grava sem participar de bloqueios entre abas. Não existe migração real habilitada.
        </p>
        <h3 className={styles.cutoverHeading}>Migração v0.2 bloqueada</h3>
        <p className={styles.note}>
          {cutoverGate.sourceCompatible
            ? 'O formato é reconhecido, mas isso não autoriza ativação.'
            : 'O save ainda precisa superar a verificação estrutural.'}
          {' '}O jogo v0.1 continua como versão oficial.
        </p>
        <ul className={styles.cutoverReasons} aria-label="Motivos que impedem a migração v0.2">
          {cutoverGate.blockers.map(blocker => (
            <li key={blocker.code}>{blocker.message}</li>
          ))}
        </ul>
      </section>
      {result.status === 'valid' && (
        <>
          <RecoveryExchangePanel sourceRaw={result.raw} />
          <MigrationLabPanel sourceRaw={result.raw} />
          <section className={styles.simulation} aria-labelledby="draft-heading">
            <h2 id="draft-heading">Simulação isolada v0.2</h2>
            <p className={styles.note}>O jogo real continua salvo em sua chave v0.1. Esta simulação usa outra chave e nunca aplica mudanças automaticamente ao jogo.</p>
            <p className={styles.draftStatus} role="status">{draftDescription()}</p>
            {draft.status === 'absent' && (
              <button className={styles.button} type="button" onClick={startSimulation}>
                Criar simulação v0.2
              </button>
            )}
            {(draft.status === 'ready' || draft.status === 'stale' || draft.status === 'invalid') && (
              <button className={styles.draftDiscard} type="button" onClick={dropSimulation}>
                Descartar simulação
              </button>
            )}
            <p className={styles.feedback} role="status" aria-live="polite">{draftFeedback}</p>
          </section>
          <nav className={styles.navigation} aria-label="Telas da prévia">
            <button
              type="button"
              aria-pressed={screen === 'overview'}
              className={screen === 'overview' ? styles.navActive : styles.navButton}
              onClick={() => setScreen('overview')}
            >Visão geral</button>
            <button
              type="button"
              aria-pressed={screen === 'trainer'}
              className={screen === 'trainer' ? styles.navActive : styles.navButton}
              onClick={() => setScreen('trainer')}
            >Treinador</button>
          </nav>
          {projected?.status === 'ready'
            ? screen === 'overview'
              ? <OverviewPreview value={projected.value} />
              : <>
                  <TrainerPreview value={projected.value} />
                  {draft.status === 'ready' && simulated?.status === 'valid' && (
                    <TrainerDraftControls
                      value={projected.value}
                      save={simulated.save}
                      revision={draft.draft.revision}
                      onInvest={(stat: Stat) => editSimulation({ type: 'invest', stat })}
                      onEquip={(slot: EquipmentSlot, itemId: string) =>
                        editSimulation({ type: 'equip', slot, itemId })}
                    />
                  )}
                </>
            : <p className={styles.projectionWarning} role="status">
                {projected?.status === 'unavailable'
                  ? projected.reason
                  : 'Não foi possível exibir os atributos desta versão do save.'}
                {' '}O backup original continua disponível acima.
              </p>}
        </>
      )}
      <footer className={styles.footer}>
        Ambiente experimental não oficial. As marcas e imagens Pokémon pertencem aos respectivos titulares.
      </footer>
    </main>
  );
}
