import { useMemo, useState } from 'react';
import {
  KANTO_POKEDEX, kantoDexStatus, kantoSpecies
} from '@kanto/game-core';
import type { KantoDexStatus } from '@kanto/game-core';
import styles from './PokedexPanel.module.css';

type DexFilter = 'all' | 'unknown' | 'seen' | 'caught';
const STATUS: Record<KantoDexStatus,string> = {
  unknown:'Não encontrado', seen:'Visto', caught:'Capturado'
};
const TYPES_PT: Readonly<Record<string,string>> = {
  normal:'Normal',fire:'Fogo',water:'Água',electric:'Elétrico',
  grass:'Planta',ice:'Gelo',fighting:'Lutador',poison:'Venenoso',
  ground:'Terra',flying:'Voador',psychic:'Psíquico',bug:'Inseto',
  rock:'Pedra',ghost:'Fantasma',dragon:'Dragão',dark:'Sombrio',
  steel:'Aço',fairy:'Fada'
};

interface Props {
  readonly seenIds: readonly number[];
  readonly capturedSpeciesIds: readonly number[];
  readonly onCollection: () => void;
  readonly onArena: () => void;
}

/**
 * Pokédex = espécies, NÃO UIDs individuais da coleção.
 * Não revela nome/imagem de Pokémon que ainda não foi visto nem capturado.
 * Captura prevalece mesmo que o save antigo tenha omitido o ID em seen.
 * Tudo é projetado do mesmo save local, sem fetch nem nova gravação.
 */
export function PokedexPanel({seenIds,capturedSpeciesIds,onCollection,onArena}:Props) {
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<DexFilter>('all');
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const caught=useMemo(()=>new Set(capturedSpeciesIds.filter(id=>kantoSpecies(id))),[capturedSpeciesIds]);
  const seen=useMemo(()=>new Set([...seenIds,...caught].filter(id=>kantoSpecies(id))),[seenIds,caught]);
  const numbers={
    caught:caught.size,
    seen:seen.size-caught.size,
    unknown:151-seen.size
  };
  const filtered=KANTO_POKEDEX.filter(species=>{
    const status=kantoDexStatus(species.id,seen,caught);
    if(filter!=='all'&&filter!==status)return false;
    const term=query.trim().toLocaleLowerCase('pt-BR');
    if(!term)return true;
    // Busca textual não revela os nomes dos desconhecidos.
    if(/^#?\d+$/.test(term))return String(species.id)===term.replace('#','')
      || String(species.id).padStart(3,'0')===term.replace('#','');
    return status!=='unknown'&&species.name.toLocaleLowerCase('pt-BR').includes(term);
  });
  const selected=selectedId===null?null:kantoSpecies(selectedId);
  const selectionStatus=selected?kantoDexStatus(selected.id,seen,caught):'unknown';

  return (
    <section className={styles.shell} aria-label="Pokédex de Kanto">
      <header className={styles.header}>
        <div>
          <div className={styles.kicker}>REGISTRO DA REGIÃO DE KANTO · 001–151</div>
          <h2>Pokédex de Kanto</h2>
          <p>Explore os 151 registros. Espécies vistas são reveladas, e capturas ficam identificadas. O mesmo Pokémon pode aparecer várias vezes na sua coleção, mas conta apenas uma espécie aqui.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={onArena}>Explorar Arena</button>
            <button type="button" className={styles.secondary} onClick={onCollection}>Minha coleção</button>
          </div>
        </div>
        <div className={styles.progressBox}>
          <strong>{numbers.caught}<span> / 151</span></strong>
          <span>espécies capturadas</span>
          <div className={styles.progressTrack} role="progressbar" aria-label="Progresso de espécies capturadas"
            aria-valuemin={0} aria-valuemax={151} aria-valuenow={numbers.caught}>
            <span style={{width:(numbers.caught/151*100)+'%'}} />
          </div>
        </div>
      </header>
      <div className={styles.totals} aria-label="Resumo da Pokédex">
        <div><span>Capturados</span><strong>{numbers.caught}</strong></div>
        <div><span>Vistos não capturados</span><strong>{numbers.seen}</strong></div>
        <div><span>Não encontrados</span><strong>{numbers.unknown}</strong></div>
        <div><span>Registros</span><strong>151</strong></div>
      </div>
      <section className={styles.listPanel}>
        <div className={styles.toolbar}>
          <div><h3>Registros nacionais</h3><p>{filtered.length} de 151 registros exibidos</p></div>
          <input type="search" className={styles.search} aria-label="Buscar na Pokédex"
            placeholder="Buscar espécie descoberta ou número…" value={query}
            onChange={event=>setQuery(event.target.value)} />
        </div>
        <div className={styles.filters} aria-label="Filtrar Pokédex">
          {([
            ['all','Todos'],['unknown','Não encontrados'],['seen','Vistos'],['caught','Capturados']
          ] as [DexFilter,string][]).map(([value,label])=>(
            <button type="button" key={value} aria-pressed={filter===value}
              className={filter===value?styles.filterActive:styles.filter}
              onClick={()=>{setFilter(value);setSelectedId(null);}}>{label}</button>
          ))}
        </div>
        <div className={styles.grid} data-testid="pokedex-grid">
          {filtered.map(species=>{
            const status=kantoDexStatus(species.id,seen,caught);
            const revealed=status!=='unknown';
            return (
              <button type="button" key={species.id} disabled={!revealed}
                data-testid={'pokedex-'+String(species.id)}
                className={status==='caught'?styles.tileCaught:status==='seen'?styles.tileSeen:styles.tileUnknown}
                onClick={()=>setSelectedId(species.id)}
                aria-label={'Pokémon #'+String(species.id).padStart(3,'0')+
                  ' '+(revealed?species.name:'não encontrado')+' — '+STATUS[status]}>
                <span className={styles.tileNumber}>#{String(species.id).padStart(3,'0')}</span>
                {revealed
                  ? <img className={styles.tileSprite}
                      src={'/assets/pokemon-gifs/poke_'+species.id+'.gif'}
                      alt="" loading="lazy" />
                  : <span className={styles.silhouette} aria-hidden="true">?</span>}
                <strong>{revealed?species.name:'???'}</strong>
                <span className={styles.tileStatus}>{STATUS[status]}</span>
              </button>
            );
          })}
        </div>
        {filtered.length===0&&
          <p role="status" className={styles.empty}>Nenhum registro corresponde a esta busca.</p>}
      </section>
      {selected&&selectionStatus!=='unknown'&&(
        <section className={styles.detail} aria-label={'Detalhes de '+selected.name} data-testid="pokedex-detail">
          <div className={styles.detailImage}>
            <img src={'/assets/pokemon-gifs/poke_'+selected.id+'.gif'}
              alt={selected.name} loading="lazy" />
          </div>
          <div className={styles.detailContent}>
            <div className={styles.kicker}>REGISTRO #{String(selected.id).padStart(3,'0')} · {STATUS[selectionStatus]}</div>
            <h3>{selected.name}</h3>
            <p>{selected.types.map(type=>TYPES_PT[type]??type).join(' · ')}</p>
            {selected.legendary&&<p>Pokémon lendário</p>}
            {selected.mythical&&<p>Pokémon mítico</p>}
            {selected.evolvesFrom!==null&&
              <p>Evolui de {kantoSpecies(selected.evolvesFrom)?.name??'uma espécie de outra geração'}.</p>}
            <div className={styles.statsGrid}>
              {([
                ['HP',selected.base.hp],['Ataque',selected.base.attack],
                ['Defesa',selected.base.defense],['Ataque especial',selected.base.specialAttack],
                ['Defesa especial',selected.base.specialDefense],['Velocidade',selected.base.speed]
              ] as [string,number][]).map(([name,value])=>(
                <div key={name}><small>{name}</small><strong>{value}</strong></div>
              ))}
            </div>
            <p className={styles.notice}>Atributos-base da espécie; bônus individuais e treinamento ficam na coleção. Captura na Arena alfa ainda usa chance fixa de 35% após vitória.</p>
            <button type="button" className={styles.secondary}
              onClick={()=>setSelectedId(null)}>Fechar detalhes</button>
          </div>
        </section>
      )}
    </section>
  );
}
