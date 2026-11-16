import { useState } from 'react';
import { LEGACY_CACHE_KEY, readLegacySave } from '../storage/legacySave';
import { projectLegacyTrainer } from '../features/trainer/legacyProjection';
import { OverviewPreview } from '../features/trainer/OverviewPreview';
import { TrainerPreview } from '../features/trainer/TrainerPreview';
import type { LegacySaveResult } from '../storage/legacySave';
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

/** Primeira casca React da v0.2: observação e backup SEM regravar o save. */
export function App() {
  const [result] = useState<LegacySaveResult>(() =>
    readLegacySave(key => window.localStorage.getItem(key))
  );
  const [feedback, setFeedback] = useState('');
  const [screen, setScreen] = useState<'overview' | 'trainer'>('overview');
  // Lemos cache SOMENTE nesta origem. Sem novo fetch e sem gravação automática.
  const [cacheRaw] = useState<string | null>(() => {
    try { return window.localStorage.getItem(LEGACY_CACHE_KEY); }
    catch { return null; }
  });
  const projected = result.status === 'valid'
    ? projectLegacyTrainer(result.save, cacheRaw, Date.now())
    : null;

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
        <p className={styles.note}>Esta prévia apenas lê o armazenamento deste domínio. Ela não modifica, migra nem exclui saves. Armazenamentos de domínios diferentes não são compartilhados automaticamente.</p>
      </section>
      {result.status === 'valid' && (
        <>
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
              : <TrainerPreview value={projected.value} />
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
