/** D-061 · Enciclopédia local de Kanto.
 * Inspirada na interação modal do projeto isaquesan7/pokedex (somente leitura).
 * Informações provenientes dos snapshots de espécie e golpes do game-core.
 * A eficácia é a do motor ATUAL de batalha, não a tabela histórica Gen III.
 */
import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {
  KANTO_POKEDEX,kantoSpecies,kantoTypeMultiplier,kantoLevelMoves,kantoSupportMoves
} from '@kanto/game-core';
import type {KantoCatalogSpecies,KantoDexStatus,KantoMove} from '@kanto/game-core';
import styles from './PokedexDetailModal.module.css';

const TYPES_PT:Readonly<Record<string,string>>={
  normal:'Normal',fire:'Fogo',water:'Água',electric:'Elétrico',
  grass:'Planta',ice:'Gelo',fighting:'Lutador',poison:'Venenoso',
  ground:'Terra',flying:'Voador',psychic:'Psíquico',bug:'Inseto',
  rock:'Pedra',ghost:'Fantasma',dragon:'Dragão',dark:'Sombrio',
  steel:'Aço',fairy:'Fada'
};
const TYPES=Object.keys(TYPES_PT);
const STATS=[
  ['hp','HP'],['attack','Ataque'],['defense','Defesa'],
  ['specialAttack','Ataque especial'],['specialDefense','Defesa especial'],
  ['speed','Velocidade']
] as const;
const CATEGORY:Readonly<Record<KantoMove['category'],string>>={
  physical:'Físico',special:'Especial',status:'Suporte'
};
const name=(type:string)=>TYPES_PT[type]??type;
const displayMove=(move:string)=>move.split('-').map(word=>
  word.charAt(0).toLocaleUpperCase('pt-BR')+word.slice(1)).join(' ');
const formatId=(id:number)=>'#'+String(id).padStart(3,'0');

interface Props {
  readonly species:KantoCatalogSpecies;
  readonly status:Exclude<KantoDexStatus,'unknown'>;
  readonly onClose:()=>void;
}

/** Não usa fetch: todos os valores são derivados de catálogos verificados.
 * Defensivo = golpes recebidos; ofensivo = tipo de movimento do Pokémon.
 */
function matchup(types:readonly string[]) {
  const defensive=TYPES.map(type=>({type,multiplier:kantoTypeMultiplier(type,types)}));
  const offensive=TYPES.filter(defender=>types.some(attack=>
    kantoTypeMultiplier(attack,[defender])>1));
  return {
    strong:offensive,
    weak:defensive.filter(item=>item.multiplier>1),
    resist:defensive.filter(item=>item.multiplier>0&&item.multiplier<1),
    immune:defensive.filter(item=>item.multiplier===0)
  };
}

export function PokedexDetailModal({species,status,onClose}:Props) {
  const dialogRef=useRef<HTMLElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  const meta=matchup(species.types);
  const moves=[
    ...kantoLevelMoves(species.id,100),
    ...kantoSupportMoves(species.id,100)
  ].sort((a,b)=>a.learnedAt-b.learnedAt||a.move.name.localeCompare(b.move.name));
  const featured=moves.filter(entry=>entry.move.category==='special');
  const rest=moves.filter(entry=>entry.move.category!=='special');
  const from=species.evolvesFrom===null?null:kantoSpecies(species.evolvesFrom);
  const evolutions=KANTO_POKEDEX.filter(candidate=>candidate.evolvesFrom===species.id);
  const total=STATS.reduce((sum,[key])=>sum+species.base[key],0);

  useEffect(()=>{
    const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    closeRef.current?.focus();
    const listener=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();onClose();return;}
      if(event.key!=='Tab'||!dialogRef.current)return;
      const focusables=Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'
      ));
      if(focusables.length===0){event.preventDefault();dialogRef.current.focus();return;}
      const first=focusables[0]!,last=focusables[focusables.length-1]!;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',listener);
    return ()=>{
      document.removeEventListener('keydown',listener);
      document.body.style.overflow=previousOverflow;
      previouslyFocused?.focus();
    };
  },[species.id,onClose]);

  return createPortal(
    <div className={styles.backdrop} onMouseDown={event=>{
      if(event.target===event.currentTarget)onClose();
    }}>
      <section className={styles.dialog} ref={dialogRef} role="dialog" aria-modal="true"
        aria-label={'Enciclopédia de '+species.name} tabIndex={-1}
        data-testid="pokedex-detail">
        <header className={styles.topbar}>
          <span className={styles.kicker}><i className="fa-solid fa-book-open" aria-hidden="true"/> REGISTRO DE KANTO · {formatId(species.id)}</span>
          <button type="button" ref={closeRef} className={styles.close}
            aria-label="Fechar detalhes" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden="true"/></button>
        </header>
        <div className={styles.content}>
          <div className={styles.intro}>
            <div className={styles.visual}>
              <span className={styles.artHalo} aria-hidden="true"/>
              <img src={'/assets/pokemon-gifs/poke_'+species.id+'.gif'} alt={species.name}
                className={styles.art} loading="eager"/>
            </div>
            <div className={styles.identity}>
              <span className={styles.status}>{status==='caught'?'● Capturado':'◉ Visto'}</span>
              <h2>{species.name}</h2>
              <div className={styles.types} aria-label="Tipos">
                {species.types.map(type=><span key={type} className={styles.type}>{name(type)}</span>)}
              </div>
              {(species.legendary||species.mythical)&&
                <p className={styles.rare}>{species.mythical?'Pokémon mítico':'Pokémon lendário'}</p>}
              <p>Espécie #{String(species.id).padStart(3,'0')} da região de Kanto.</p>
              <div className={styles.evolution}>
                <strong>Linha evolutiva</strong>
                <span>{from?'Evolui de '+from.name:'Forma inicial ou sem pré-evolução em Kanto'}</span>
                <span>{evolutions.length?'Pode evoluir para '+evolutions.map(p=>p.name).join(' ou '):
                  'Nenhuma evolução seguinte entre os 151 de Kanto'}</span>
              </div>
            </div>
          </div>
          <section className={styles.block} aria-label="Atributos base">
            <div className={styles.blockTitle}><h3><i className="fa-solid fa-chart-simple" aria-hidden="true"/> Atributos-base</h3>
              <span>Total {total}</span></div>
            <div className={styles.stats}>
              {STATS.map(([key,label])=><div key={key} className={styles.stat}>
                <span>{label}</span><strong>{species.base[key]}</strong>
                <div className={styles.statTrack} aria-hidden="true">
                  <span style={{width:Math.min(100,species.base[key]/255*100)+'%'}}/></div>
              </div>)}
            </div>
          </section>
          <div className={styles.twoColumns}>
            <section className={styles.block} aria-label="Vantagens de tipo">
              <h3><i className="fa-solid fa-shield-halved" aria-hidden="true"/> Vantagens e fraquezas</h3>
              <p className={styles.hint}>Efetividade segundo as regras atuais da Arena. Fraqueza e resistência indicam golpes <strong>recebidos</strong>; vantagem ofensiva considera ataques dos tipos desta espécie.</p>
              <h4>Forte contra · ataque</h4>
              <div className={styles.chips}>{meta.strong.length?meta.strong.map(type=>
                <span key={type} className={styles.chip}>{name(type)} · 2× ou mais</span>):
                <small>Sem vantagem ofensiva de tipo</small>}</div>
              <h4>Fraco contra · defesa</h4>
              <div className={styles.chips}>{meta.weak.length?meta.weak.map(({type,multiplier})=>
                <span key={type} className={styles.weak}>{name(type)} · {multiplier}×</span>):
                <small>Sem fraqueza de tipo</small>}</div>
              <h4>Resiste a · defesa</h4>
              <div className={styles.chips}>{meta.resist.length?meta.resist.map(({type,multiplier})=>
                <span key={type} className={styles.chip}>{name(type)} · {multiplier}×</span>):
                <small>Sem resistência de tipo</small>}</div>
              {meta.immune.length>0&&<><h4>Imune a · defesa</h4>
                <div className={styles.chips}>{meta.immune.map(({type})=>
                  <span key={type} className={styles.chip}>{name(type)} · 0×</span>)}</div></>}
            </section>
            <section className={styles.block} aria-label="Golpes e técnicas">
              <h3><i className="fa-solid fa-bolt" aria-hidden="true"/> Golpes e técnicas</h3>
              <p className={styles.hint}>Recorte local de golpes por nível de FireRed/LeafGreen. Não representa o aprendizado completo da espécie nem os golpes equipados no seu Pokémon.</p>
              <h4>Ataques especiais</h4>
              {featured.length?<div className={styles.moves}>
                {featured.map(({move,learnedAt})=><div key={move.name} className={styles.move}>
                  <strong>{displayMove(move.name)}</strong><small>{name(move.type)} · Nv. {learnedAt}</small>
                  <span>Poder {move.power} · {CATEGORY[move.category]}</span>
                </div>)}</div>:<p className={styles.hint}>Nenhum ataque especial registrado neste recorte.</p>}
              <h4>Outros golpes e suportes</h4>
              {rest.length?<div className={styles.moves}>
                {rest.slice(0,8).map(({move,learnedAt})=><div key={move.name} className={styles.move}>
                  <strong>{displayMove(move.name)}</strong><small>{name(move.type)} · Nv. {learnedAt}</small>
                  <span>{CATEGORY[move.category]}{move.power>0?' · Poder '+move.power:''}</span>
                </div>)}</div>:<p className={styles.hint}>Nenhum outro golpe registrado neste recorte.</p>}
            </section>
          </div>
          <p className={styles.footnote}>Dados-base por espécie; atributos treinados e golpes equipados pertencem à sua Coleção. O registro não realiza ações nem modifica o save.</p>
        </div>
      </section>
    </div>,
    document.body
  );
}
