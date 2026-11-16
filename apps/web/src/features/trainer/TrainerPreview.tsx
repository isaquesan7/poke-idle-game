import { STATS } from '@kanto/game-core';
import type { TrainerViewModel } from './legacyProjection';
import { STAT_LABELS } from './legacyProjection';
import styles from './TrainerPreview.module.css';

interface Props {
  readonly value: TrainerViewModel;
}

/** Tela de treinador de leitura: totais vêm do core, save permanece intocado. */
export function TrainerPreview({ value }: Props) {
  return (
    <section className={styles.panel} aria-labelledby="trainer-heading">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Perfil do treinador · Kanto</span>
          <h2 id="trainer-heading">{value.name}</h2>
          <p>Nível {value.level} · {value.xpNext === null
            ? 'Nível máximo'
            : value.xp + ' / ' + value.xpNext + ' XP'}</p>
        </div>
        <span className={styles.pill}>{value.unspent} pontos disponíveis</span>
      </div>
      <p className={styles.note}>Pontos manuais limitados a 40 por atributo. Itens, título e todas as insígnias somam ao total sem esse limite.</p>
      <div className={styles.statGrid}>
        {STATS.map(stat => (
          <div className={styles.statCard} key={stat}>
            <span className={styles.statLabel}>{STAT_LABELS[stat]}</span>
            <strong>{value.totals[stat]}</strong>
            <span className={styles.breakdown}>{value.manual[stat]} manual + {value.totals[stat] - value.manual[stat]} extra</span>
          </div>
        ))}
      </div>
      <div className={styles.sources}>
        <div>
          <h3>Equipamentos</h3>
          <p>{value.equipped.length
            ? value.equipped.map(item => item.name).join(' · ')
            : 'Nenhum equipamento reconhecido'}</p>
        </div>
        <div>
          <h3>Título ativo</h3>
          <p>{value.title.name}</p>
        </div>
        <div>
          <h3>Insígnias</h3>
          <p>{value.badges.length}/8 · {value.badges.length
            ? value.badges.map(badge => badge.name).join(', ')
            : 'Nenhuma adquirida'}</p>
        </div>
      </div>
      <p className={styles.note}>Visualização de compatibilidade: esta tela ainda não distribui pontos nem altera equipamentos.</p>
    </section>
  );
}
