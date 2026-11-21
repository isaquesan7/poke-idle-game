import {useState} from 'react';
import {KANTO_BATTLE_SPECIES} from '@kanto/game-core';
import {PREVIEW_REGIONS} from './previewCatalog';
import styles from './RegionsPreview.module.css';

/** D-064AE: nenhum save é lido ou escrito nesta página pública de consulta. */
export function RegionsPreview(){
  const [selected,setSelected]=useState(1);
  const active=PREVIEW_REGIONS.find(region=>region.id===selected)??PREVIEW_REGIONS[0]!;
  return <main className={styles.page}>
    <header className={styles.header}>
      <a href="/play" className={styles.back}>← Voltar ao jogo</a>
      <span className={styles.eyebrow}>Season 1 · Kanto · Prévia de regiões</span>
      <h1>Explore as regiões de Kanto</h1>
      <p>Conheça as áreas planejadas para a aventura. Este é um catálogo informativo: encontros, recompensas e capturas regionais ainda não estão disponíveis.</p>
    </header>
    <section aria-label="Catálogo de regiões" className={styles.grid}>
      {PREVIEW_REGIONS.map(region=><button
        key={region.id} type="button"
        className={selected===region.id?styles.selected:styles.region}
        aria-pressed={selected===region.id}
        aria-controls="region-preview-details"
        onClick={()=>setSelected(region.id)}
      >
        <span className={styles.number}>Área {String(region.id).padStart(2,'0')}</span>
        <strong>{region.name}</strong>
        <span className={styles.small}>Pokémon previstos: níveis {region.minLevel}–{region.maxLevel}</span>
      </button>)}
    </section>
    <section id="region-preview-details" aria-label="Detalhes da região selecionada" className={styles.details}>
      <div className={styles.summary}>
        <span className={styles.eyebrow}>Área {String(active.id).padStart(2,'0')}</span>
        <h2>{active.name}</h2>
        <dl className={styles.facts}>
          <div><dt>Nível planejado dos encontros</dt><dd>{active.minLevel}–{active.maxLevel}</dd></div>
          <div><dt>Nível sugerido do treinador para acesso</dt><dd>{active.unlockTrainerLevel}</dd></div>
        </dl>
        <p>Estes requisitos são preliminares e poderão mudar após os testes de balanceamento.</p>
      </div>
      <div className={styles.species}>
        <h3>Algumas espécies previstas</h3>
        <ul className={styles.speciesGrid}>
          {active.examples.map(id=>{
            const species=KANTO_BATTLE_SPECIES[id];
            return <li key={id} className={styles.pokemon}>
              <img src={`/assets/pokemon-gifs/poke_${id}.gif`}
                alt="" loading="lazy" width="72" height="72"/>
              <span>#{String(id).padStart(3,'0')}</span>
              <strong>{species?.name??'Pokémon'}</strong>
            </li>;
          })}
        </ul>
        <p className={styles.note}>Amostra ilustrativa, não é a lista completa nem uma promessa de disponibilidade ou chance de captura.</p>
      </div>
    </section>
    <footer className={styles.footer}>
      Prévia informativa · Nenhum progresso do jogador é alterado nesta página.
    </footer>
  </main>;
}
