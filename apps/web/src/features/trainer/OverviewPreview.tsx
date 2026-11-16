import { STATS } from '@kanto/game-core';
import type { TrainerViewModel } from './legacyProjection';
import { STAT_LABELS } from './legacyProjection';
import styles from './TrainerPreview.module.css';

interface Props {
  readonly value: TrainerViewModel;
}

/** Dashboard v0.2: exibe save legado e status efetivos pelo game-core. */
export function OverviewPreview({ value }: Props) {
  return (
    <section className={styles.panel} aria-labelledby="overview-heading">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Visão geral · Kanto</span>
          <h2 id="overview-heading">Centro de comando de {value.name}</h2>
          <p>Dados derivados de seu save v0.1, sem gravar alterações.</p>
        </div>
        <span className={styles.pill}>Leitura apenas</span>
      </div>
      <div className={styles.metrics}>
        <div><strong>{value.level}</strong><span>Nível treinador</span></div>
        <div><strong>{value.coins}</strong><span>Moedas</span></div>
        <div><strong>{value.capturedSpecies}/151</strong><span>Espécies capturadas</span></div>
        <div><strong>{value.capturedInstances}</strong><span>Pokémon individuais</span></div>
      </div>
      <div className={styles.pokemon}>
        <div>
          <h3>Pokémon ativo: {value.active.name}</h3>
          <p>#{String(value.active.id).padStart(3, '0')} · Nível {value.active.level} · Afinidade {value.active.affinity}%</p>
          <p>Transferência do treinador: {value.active.ratePercent.toFixed(2).replace('.', ',')}% por atributo, em pontos adicionais.</p>
        </div>
        {value.active.stats ? (
          <div className={styles.statGrid}>
            {STATS.map(stat => (
              <div className={styles.statCard} key={stat}>
                <span className={styles.statLabel}>{STAT_LABELS[stat]}</span>
                <strong>{value.active.stats![stat]}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.note} role="status">
            Status do Pokémon não calculado: os dados-base oficiais desta espécie
            ainda não estão armazenados nesta origem. Nenhum valor foi inventado.
          </p>
        )}
      </div>
      {value.expedition && (
        <div className={styles.expedition}>
          <h3>Expedição em andamento</h3>
          <p>Estimativa local de {value.expedition.cycles} ciclos: {value.expedition.coinsEstimate} moedas e {value.expedition.trainerXpEstimate} XP de treinador.</p>
          <p className={styles.note}>Simulação pelo game-core; esta prévia não resgata ou concede recompensas.</p>
        </div>
      )}
    </section>
  );
}
