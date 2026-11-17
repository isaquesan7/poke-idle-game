import { useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  MAX_RECOVERY_FILE_BYTES, inspectRecoveryFile, prepareVerifiedRecoveryExport
} from '../../storage/recoveryExchange';
import styles from './RecoveryExchangePanel.module.css';

interface Props {
  readonly sourceRaw: string;
}

/**
 * Exportação local e VERIFICAÇÃO de um JSON externo.
 * Este componente não lê/escreve a chave oficial v0.2, NÃO restaura backups
 * e NÃO substitui o progresso v0.1. O arquivo só é analisado na memória.
 */
export function RecoveryExchangePanel({ sourceRaw }: Props) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function downloadPackage(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setFeedback('Conferindo o progresso e calculando o SHA-256...');
    try {
      const outcome = await prepareVerifiedRecoveryExport(
        window.localStorage, sourceRaw, Date.now()
      );
      if (outcome.status !== 'ready') {
        setFeedback('Exportação bloqueada: ' + outcome.reason);
        return;
      }
      const url = URL.createObjectURL(
        new Blob([outcome.json], { type: 'application/json' })
      );
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = outcome.fileName;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setFeedback('Download do pacote verificável solicitado. O save real não foi alterado.');
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setFeedback('Não foi possível gerar o arquivo. Nenhum save foi modificado.');
    } finally {
      setBusy(false);
    }
  }

  async function inspectFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (file.size > MAX_RECOVERY_FILE_BYTES) {
      setFeedback('Arquivo recusado: excede 8 MiB. Nenhum dado foi importado.');
      return;
    }
    setBusy(true);
    setFeedback('Verificando checksum e versão do pacote...');
    try {
      const outcome = await inspectRecoveryFile(
        await file.text(), window.localStorage
      );
      if (outcome.status === 'matching') {
        setFeedback('Pacote íntegro e igual ao save atual. Nenhum dado foi restaurado.');
      } else if (outcome.status === 'different' || outcome.status === 'missing') {
        setFeedback('Pacote íntegro, mas não corresponde ao progresso atual. Não será importado.');
      } else {
        setFeedback('Arquivo não aceito: ' + outcome.reason + ' Nenhum dado foi importado.');
      }
    } catch {
      setFeedback('Não foi possível ler esse arquivo. Nenhum save foi alterado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.recoveryPanel} aria-labelledby="recovery-export-heading">
      <h2 id="recovery-export-heading">Pacote de recuperação verificável</h2>
      <p className={styles.recoveryText}>
        Baixe uma cópia com checksum SHA-256 e todo o progresso v0.1 original.
        Conferir um arquivo aqui NÃO restaura nem importa dados para o jogo.
      </p>
      <div className={styles.recoveryActions}>
        <button
          type="button"
          className={styles.recoveryButton}
          disabled={busy}
          onClick={() => void downloadPackage()}
        >
          Baixar pacote verificável SHA-256
        </button>
        <label className={styles.recoveryInputLabel}>
          Conferir pacote JSON (sem restaurar)
          <input
            className={styles.recoveryInput}
            type="file"
            accept=".json,application/json"
            aria-label="Conferir pacote JSON (sem restaurar)"
            disabled={busy}
            onChange={event => void inspectFile(event)}
          />
        </label>
      </div>
      <p className={styles.recoveryStatus} role="status" aria-live="polite">
        {feedback}
      </p>
      <p className={styles.recoveryText}>
        A v0.1 ainda pode ser atualizada em outra aba. A exportação não desativa
        o jogo antigo e não autoriza migração para a v0.2.
      </p>
    </section>
  );
}
