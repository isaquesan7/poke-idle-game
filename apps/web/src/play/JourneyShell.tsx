import {PokeballSymbol} from './PokeballArt';
import type {ReactNode} from 'react';
import styles from './PlayApp.module.css';

export type Tab = 'overview' | 'trainer' | 'pokemon' | 'collection' | 'pokedex' | 'regions' | 'battle' | 'gyms' | 'expedition' | 'shop';
/** D-051: navegação consistente com o Font Awesome da tela do treinador. */
const NAV_ICONS:Readonly<Record<Tab,string>>={
  overview:'fa-house',trainer:'fa-user',pokemon:'fa-dragon',collection:'fa-layer-group',
  pokedex:'fa-book-open',regions:'fa-map-location-dot',battle:'fa-khanda',gyms:'fa-medal',expedition:'fa-compass',shop:'fa-store'
};


export function PokemonArt({ id, name, large = false }: {
  id: number; name: string; large?: boolean
}) {
  return (
    <img
      className={large ? styles.pokemonLarge : styles.pokemonArt}
      src={`/assets/pokemon-gifs/poke_${id}.gif`}
      onError={event => {
        const image = event.currentTarget;
        image.onerror = null;
        image.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
      }}
      alt={name}
      loading={large?'eager':'lazy'}
    />
  );
}


export function sectionName(tab: Tab): string {
  return { overview: 'Visão geral', trainer: 'Treinador', pokemon: 'Pokémon', collection: 'Coleção', pokedex: 'Pokédex', regions: 'Regiões', battle: 'Batalha regional', gyms:'Ginásios', expedition: 'Expedição', shop:'Loja' }[tab];
}


interface ShellProps {
 tab:Tab;
 title:string;
 name:string;
 level:number|string;
 coins:number;
 revision:number;
 serverOnline:boolean|null;
 online?:boolean;
 tabs?:readonly Tab[];
 onNavigate:(tab:Tab)=>void;
 onExit:()=>void;
 feedback?:string;
 children:ReactNode;
}
export function JourneyShell({tab,title,name,level,coins,revision,serverOnline,online=false,tabs,onNavigate,onExit,feedback,children}:ShellProps){
 return <div className={styles.appShell} data-testid="play-root" data-motion="full">
 <aside className={styles.sidebar}>
  <div className={styles.brand}><PokeballSymbol className={styles.brandBall}/>KANTO <strong>IDLE</strong><span className={styles.alpha}>ALPHA</span></div>
  <div className={styles.sidebarCaption}>SUA JORNADA</div>
  <nav className={styles.menu} aria-label="Navegação do jogo">
   {(['overview','trainer','pokemon','collection','pokedex','regions','gyms','expedition','shop'] as Tab[]).map(item=>
    <button type="button" key={item} aria-current={tab===item?'page':undefined}
      disabled={tabs!==undefined&&!tabs.includes(item)}
      className={tab===item?styles.menuActive:styles.menuItem} onClick={()=>onNavigate(item)}>
      <i className={'fa-solid '+NAV_ICONS[item]} aria-hidden="true"/>{sectionName(item)}
    </button>)}
  </nav>
  <div className={styles.sidebarFooter}>
    <p>Pré-lançamento v0.2</p>
    <p>{online?'Progresso online':'Progresso local'} · {revision} alterações</p>
    <button type="button" className={styles.resetButton} onClick={onExit}>{online?'Sair da conta':'Reiniciar teste'}</button>
  </div>
 </aside>
 <div className={styles.content}>
  <header className={styles.topbar}>
    <div><div className={styles.kicker}>REGIÃO DE KANTO · SEASON 1</div><h1>{title}</h1></div>
    <div className={styles.trainerChip}><span className={serverOnline===true?styles.serverOnline:styles.serverOffline} role="status">{serverOnline===null?'Verificando servidor':serverOnline?'● Servidor Online':'● Servidor indisponível'}</span><span className={styles.avatar}>★</span>
      <span><strong>{name}</strong><small>Nível {level}</small></span><span className={styles.coins}>◈ {coins}</span>
    </div>
  </header>
  {feedback&&<div role="status" aria-live="polite" className={styles.message}>{feedback}</div>}
  {children}
  <footer className={styles.footer}>Poke Idle Game · Alfa pré-lançamento · Pokémon e marcas pertencem aos seus titulares. {online?'Progresso salvo no servidor.':'Sem conta ou progresso em nuvem.'}</footer>
 </div>
 </div>;
}
