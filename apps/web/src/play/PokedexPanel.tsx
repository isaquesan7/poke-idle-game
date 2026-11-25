import { useMemo, useState } from 'react';
import {
  KANTO_POKEDEX, kantoDexStatus, kantoSpecies
} from '@kanto/game-core';
import type { KantoDexStatus } from '@kanto/game-core';
import styles from './PokedexPanel.module.css';
import { PokedexDetailModal } from './PokedexDetailModal';

type DexFilter = 'all' | 'unknown' | 'seen' | 'caught';
const STATUS: Record<KantoDexStatus,string> = {
  unknown:'Não encontrado', seen:'Visto', caught:'Capturado'
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
          <p>Explore os 151 registros de Kanto. Toque em um Pokémon descoberto para abrir sua ficha com tipos, atributos-base, vantagens e golpes. Cada espécie capturada conta uma única vez.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={onArena}>Explorar Regiões</button>
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
        <div className={styles.grid} data-testid="pokedex-grid" tabIndex={0} aria-label="Lista de registros nacionais">
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
                {revealed&&<span className={styles.tileTypes}>{species.types.map(type=>
                  <span key={type}>{({
                    normal:'Normal',fire:'Fogo',water:'Água',electric:'Elétrico',grass:'Planta',
                    ice:'Gelo',fighting:'Lutador',poison:'Venenoso',ground:'Terra',
                    flying:'Voador',psychic:'Psíquico',bug:'Inseto',rock:'Pedra',
                    ghost:'Fantasma',dragon:'Dragão',dark:'Sombrio',steel:'Aço',fairy:'Fada'
                  } as Record<string,string>)[type]??type}</span>)}</span>}
                <span className={styles.tileStatus}>{STATUS[status]}</span>
                {revealed&&<span className={styles.tileHint}>Ver ficha <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"/></span>}
              </button>
            );
          })}
        </div>
        {filtered.length===0&&
          <p role="status" className={styles.empty}>Nenhum registro corresponde a esta busca.</p>}
      </section>
      {selected&&selectionStatus!=='unknown'&&(
        <PokedexDetailModal key={selected.id} species={selected}
          status={selectionStatus} revealedSpeciesIds={seen} onClose={()=>setSelectedId(null)}/>
      )}
    </section>
  );
}
