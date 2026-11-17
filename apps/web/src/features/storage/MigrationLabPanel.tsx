import { useEffect, useState } from 'react';
import {
  LAB_CONFIRMATION_PHRASE, MigrationMemoryLab
} from '../../storage/migrationMemoryLab';
import type { LabFailureMode } from '../../storage/migrationMemoryLab';
import styles from './MigrationLabPanel.module.css';

interface Props { readonly sourceRaw: string; }

/** Não importa Storage/IndexedDB: o ensaio só possui Map privado e descartável. */
export function MigrationLabPanel({ sourceRaw }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [mode, setMode] = useState<LabFailureMode>('none');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState('');

  // Se o progresso v0.1 mudar entre renders, cancelar o consentimento anterior.
  useEffect(() => {
    setConfirmed(false);
    setReport('');
  }, [sourceRaw]);

  async function runLab(): Promise<void> {
    if (busy || !confirmed) return;
    setBusy(true);
    setReport('Executando somente no Map temporário...');
    try {
      // Cada clique cria um ambiente de TESTE novo, sem acesso à origem real.
      const lab = new MigrationMemoryLab(sourceRaw);
      const outcome = await lab.simulateCutover({
        phrase: LAB_CONFIRMATION_PHRASE,
        expectedSourceRaw: sourceRaw,
        createdAt: Date.now(),
        failure: mode
      });
      const audit = await lab.inspect();
      const backup = await lab.extractBackup();
      setReport(
        'Resultado: ' + outcome.status +
        ' · Estágio do ensaio: ' + audit.status +
        ' · Backup: ' + (backup.status === 'ok' ? 'verificado' : 'indisponível') +
        ' · Save real: não modificado.'
      );
    } catch {
      setReport('O ensaio foi interrompido. Nenhum dado real foi escrito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.labPanel} aria-labelledby="memory-lab-heading">
      <h2 id="memory-lab-heading">Laboratório de migração — somente memória</h2>
      <p className={styles.labNote}>
        Simula backup, candidato v0.2, commit e interrupções num Map temporário.
        Nenhum dado é importado, restaurado ou escrito no localStorage.
      </p>
      <label className={styles.labModeLabel} htmlFor="memory-lab-mode">
        Cenário do ensaio
      </label>
      <select
        className={styles.labSelect}
        id="memory-lab-mode"
        value={mode}
        disabled={busy}
        onChange={event => setMode(event.currentTarget.value as LabFailureMode)}
      >
        <option value="none">Sequência completa (simulada)</option>
        <option value="quota">Quota indisponível após backup</option>
        <option value="crash-after-backup">Interrupção após backup</option>
        <option value="crash-after-candidate">Interrupção após candidato</option>
        <option value="crash-after-marker">Interrupção após marcador final</option>
        <option value="legacy-change-after-backup">Outra aba v0.1 altera o save</option>
      </select>
      <label className={styles.labConfirm}>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={event => setConfirmed(event.currentTarget.checked)}
        />
        Confirmo que quero executar somente uma simulação descartável em memória.
      </label>
      <button
        className={styles.labButton}
        type="button"
        onClick={() => void runLab()}
        disabled={!confirmed || busy}
      >
        Executar ensaio em memória
      </button>
      <p className={styles.labReport} role="status" aria-live="polite">{report}</p>
      <p className={styles.labNote}>
        Mesmo um ensaio concluído não migra o jogo: a v0.1 pode salvar em outra
        aba e a v0.2 ainda não tem writer oficial autorizado.
      </p>
    </section>
  );
}
