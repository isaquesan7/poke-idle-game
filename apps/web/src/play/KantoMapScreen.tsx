/**
 * D-064B · Protótipo navegável de Kanto. SOMENTE LEITURA.
 * O seletor usa o MESMO catálogo que será usado pelo writer regional.
 * Não habilitar "Batalhar" antes que a seleção seja validada no domínio.
 */
import {useState} from 'react';
import {KANTO_REGIONS,KANTO_POKEDEX} from '@kanto/game-core';
import type {KantoRegionDefinition} from '@kanto/game-core';
import styles from './KantoMapScreen.module.css';

const POSITIONS:readonly [number,number][]=[
  [11,81],[30,70],[47,82],[69,70],[82,52],
  [64,43],[43,53],[22,37],[35,17],[74,16]
];
const REGION_ICONS=[
  'fa-tree','fa-mountain-sun','fa-mountain','fa-water','fa-bolt',
  'fa-ghost','fa-sailboat','fa-paw','fa-dragon','fa-star'
] as const;
const TYPES:Readonly<Record<string,string>>={
  normal:'Normal',fire:'Fogo',water:'Água',electric:'Elétrico',
  grass:'Planta',ice:'Gelo',fighting:'Lutador',poison:'Venenoso',
  ground:'Terra',flying:'Voador',psychic:'Psíquico',bug:'Inseto',
  rock:'Pedra',ghost:'Fantasma',dragon:'Dragão',dark:'Sombrio',
  steel:'Aço',fairy:'Fada'
};
function unlock(region:KantoRegionDefinition,trainerLevel:number){
  return trainerLevel>=region.trainerUnlockLevel;
}

interface Props {
  readonly trainerLevel:number;
  readonly revealedSpeciesIds:readonly number[];
  readonly onClose:()=>void;
}
export function KantoMapScreen({trainerLevel,revealedSpeciesIds,onClose}:Props){
  const [selectedId,setSelectedId]=useState(1);
  const selected=KANTO_REGIONS.find(r=>r.id===selectedId)??KANTO_REGIONS[0]!;
  const allowed=unlock(selected,trainerLevel);
  const revealed=new Set(revealedSpeciesIds);
  const species=selected.speciesIds.map(id=>KANTO_POKEDEX[id-1]).filter(
    (entry):entry is (typeof KANTO_POKEDEX)[number]=>Boolean(entry)
  );
  const common=species.filter(p=>!selected.rareSpeciesIds.includes(p.id));
  const rare=species.filter(p=>selected.rareSpeciesIds.includes(p.id));
  const next=KANTO_REGIONS.find(region=>!unlock(region,trainerLevel));
  const route=POSITIONS.map(([x,y],i)=>(i===0?'M':'L')+x+' '+y).join(' ');

  return <section className={styles.page} aria-label="Regiões do Mapa" data-testid="kanto-map-preview">
    <header className={styles.header}>
      <div>
        <div className={styles.kicker}><i className="fa-solid fa-map-location-dot" aria-hidden="true"/> JORNADA POR KANTO · PRÉVIA</div>
        <h2>Regiões do Mapa</h2>
        <p>Explore as áreas e conheça os Pokémon que poderão aparecer nelas. O mapa está em desenvolvimento; os encontros regionais ainda não foram ativados.</p>
      </div>
      <button type="button" className={styles.secondary} onClick={onClose}>
        <i className="fa-solid fa-arrow-left" aria-hidden="true"/> Voltar à Arena atual
      </button>
    </header>
    <div className={styles.metrics}>
      <div><small>Nível do Treinador</small><strong>{trainerLevel}</strong></div>
      <div><small>Regiões disponíveis pelo nível</small><strong>{KANTO_REGIONS.filter(r=>unlock(r,trainerLevel)).length}/10</strong></div>
      <div><small>Pokémon de Kanto</small><strong>151</strong></div>
      <div><small>Próxima região</small><strong>{next?'Nv. '+next.trainerUnlockLevel:'Todas liberadas'}</strong></div>
    </div>
    <div className={styles.columns}>
      <div className={styles.map} aria-label="Caminho das dez regiões de Kanto">
        <svg className={styles.landscape} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="d064-land" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--map-forest)"/>
              <stop offset="65%" stopColor="var(--map-grass)"/>
              <stop offset="100%" stopColor="var(--map-ridge)"/>
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="var(--map-water)"/>
          <path d="M0 10 Q20 -1 32 9 T62 10 Q91 2 100 23 L91 48 100 67 81 95 45 97 32 83 0 89 Z" fill="url(#d064-land)"/>
          <path d="M0 65 Q20 55 36 66 T65 62 Q82 61 100 77 L100 100 0 100Z" fill="var(--map-land-deep)" opacity=".85"/>
          <path d="M44 10 Q57 23 49 37 T65 61 Q83 66 90 84" fill="none" stroke="var(--map-stream)" strokeWidth="1.6" opacity=".5"/>
          <path d="M10 36 22 8 38 37 49 14 70 45 82 28 97 52" fill="none" stroke="var(--map-hills-soft)" strokeWidth="8" strokeLinejoin="round" opacity=".26"/>
          <path d="M7 53 20 28 36 48 53 31 67 48 86 28" fill="none" stroke="var(--map-hills-light)" strokeWidth="5" strokeLinejoin="round" opacity=".23"/>
          <path d="M19 81 Q25 70 34 73 T54 81 Q64 90 82 76" fill="none" stroke="var(--map-lake)" strokeWidth="1.3" opacity=".5"/>
          <path d={route} fill="none" stroke="var(--map-path-edge)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".55"/>
          <path d={route} fill="none" stroke="var(--map-path)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1.6 1"/>
        </svg>
        <div className={styles.compass} aria-hidden="true"><i className="fa-solid fa-compass"/> KANTO</div>
        {KANTO_REGIONS.map((region,i)=>{
          const accessible=unlock(region,trainerLevel);
          const active=selectedId===region.id;
          const [x,y]=POSITIONS[i]!;
          return <button type="button" key={region.id}
            className={[styles.marker,active?styles.active:'',accessible?styles.unlocked:styles.locked].join(' ')}
            style={{left:x+'%',top:y+'%'}}
            aria-pressed={active}
            aria-label={'Região '+region.id+': '+region.name+'. '+(accessible?'Disponível':'Bloqueada, exige treinador nível '+region.trainerUnlockLevel)}
            onClick={()=>setSelectedId(region.id)}>
            <span className={styles.markerIcon}><i className={'fa-solid '+(accessible?REGION_ICONS[i]:'fa-lock')} aria-hidden="true"/></span>
            <span className={styles.markerName}>{region.id}. {region.name}</span>
          </button>;
        })}
      </div>
      <aside className={styles.detail} aria-label={'Detalhes da região '+selected.name}>
        <div className={styles.kicker}>{'REGIÃO '+String(selected.id).padStart(2,'0')+' / 10'}</div>
        <h3>{selected.name}</h3>
        <div className={styles.badges}>
          <span>Níveis {selected.levelMin}–{selected.levelMax}</span>
          <span>{allowed?'Disponível pelo nível':'Requer Treinador Nv. '+selected.trainerUnlockLevel}</span>
        </div>
        <p className={styles.note}>Pokémon que estarão disponíveis nesta região após a integração dos encontros. A lista é derivada do mesmo catálogo regional, não de exemplos aleatórios.</p>
        <div className={styles.poolHeading}><h4>Pokémon desta região</h4><span>{species.length} espécies</span></div>
        <div className={styles.species} aria-label="Espécies desta região">
          {common.map(p=><div key={p.id} className={styles.speciesCard}>
            {revealed.has(p.id)
              ?<img src={'/assets/pokemon-gifs/poke_'+p.id+'.gif'} alt="" loading="lazy"/>
              :<span className={styles.hiddenArt} aria-hidden="true">?</span>}
            <strong>{revealed.has(p.id)?p.name:'???'}</strong>
            <small>{revealed.has(p.id)?p.types.map(t=>TYPES[t]??t).join(' · '):'Não descoberto'}</small>
          </div>)}
        </div>
        {rare.length>0&&<div className={styles.rareSection}>
          <h4><i className="fa-solid fa-star" aria-hidden="true"/> Encontros extremamente raros</h4>
          <div className={styles.species}>
            {rare.map(p=><div key={p.id} className={styles.speciesCard}>
              {revealed.has(p.id)
                ?<img src={'/assets/pokemon-gifs/poke_'+p.id+'.gif'} alt="" loading="lazy"/>
                :<span className={styles.hiddenArt} aria-hidden="true">?</span>}
              <strong>{revealed.has(p.id)?p.name:'???'}</strong><small>Encontro muito raro</small>
            </div>)}
          </div>
          <p>Capturas futuras exigirão Ultra Ball. A Master Ball permanece reservada para uso manual.</p>
        </div>}
        <button type="button" className={styles.disabledBattle} disabled
          title="A batalha regional será habilitada depois da validação da economia, dos níveis e das Poké Bolas">
          <i className="fa-solid fa-lock" aria-hidden="true"/> Batalha regional em preparação
        </button>
        <p className={styles.note}>O combate publicado continua acessível no painel anterior. Nenhum save ou recompensa é alterado nesta prévia.</p>
      </aside>
    </div>
  </section>;
}
