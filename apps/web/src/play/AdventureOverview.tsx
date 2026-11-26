import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import type {StatValues} from '@kanto/game-core';
import type {TrainerViewModel} from '../features/trainer/legacyProjection';
import {expeditionElapsedMs,formatExpeditionDuration} from './expeditionDisplay';
import styles from './AdventureOverview.module.css';

const TYPE_LABELS:Record<string,string>={normal:'Normal',fire:'Fogo',water:'Água',electric:'Elétrico',grass:'Planta',ice:'Gelo',fighting:'Lutador',poison:'Veneno',ground:'Terra',flying:'Voador',psychic:'Psíquico',bug:'Inseto',rock:'Pedra',ghost:'Fantasma',dragon:'Dragão',dark:'Sombrio',steel:'Aço',fairy:'Fada'};
const STATS=[['hp','HP','fa-heart-pulse'],['attack','ATK','fa-khanda'],['specialAttack','SP. ATK','fa-wand-magic-sparkles'],['speed','SPD','fa-gauge-high']] as const;
function Fa({name}:{name:string}){return <i className={'fa-solid '+name} aria-hidden="true"/>}
export function AdventureTopbar({online,level,name,coins,now,onLogout,busy}:{online:boolean|null;level:number|string;name:string;coins:number;now:number;onLogout:()=>void;busy:boolean}){
 const [open,setOpen]=useState(false);
 const area=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  function outside(e:PointerEvent){if(e.target instanceof Node&&!area.current?.contains(e.target))setOpen(false)}
  function key(e:KeyboardEvent){if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}}
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)}
 },[open]);
 return <header className={styles.topbar} aria-label="Resumo da conta">
  <span className={styles.status} data-online={online===true} role="status"><Fa name="fa-circle"/> {online===null?'Verificando servidor':online?'Servidor online':'Servidor indisponível'}</span>
  <div ref={area} className={styles.account}>
   <button ref={trigger} type="button" className={styles.chip+' '+styles.accountButton} aria-expanded={open} aria-controls="overview-account-actions" onClick={()=>setOpen(v=>!v)} title={name}><Fa name="fa-user"/> Treinador Nv. {level}<Fa name="fa-chevron-down"/></button>
   <div id="overview-account-actions" className={styles.accountMenu} hidden={!open}>
    <span>{name}</span><button type="button" disabled={busy} onClick={()=>{setOpen(false);onLogout()}}><Fa name="fa-right-from-bracket"/> Sair da conta</button>
   </div>
  </div>
  <span className={styles.chip+' '+styles.coins} aria-label={'Moedas: '+coins}><Fa name="fa-coins"/> {coins.toLocaleString('pt-BR')}</span>
  <time className={styles.chip} title="Horário local do dispositivo, somente informativo" aria-label="Horário local"><Fa name="fa-clock"/> {new Date(now).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time>
 </header>
}
interface Props{
 view:TrainerViewModel;leader:{id:number;name:string;level:number;affinity:number;types:readonly string[];stats:Readonly<StatValues>|null;art:ReactNode};
 speciesCount:number;individualCount:number;
 expedition:{startedAt:number;regionName:string;cycles:number}|null;
 serverNow:number|null;expeditionAvailable:boolean;busy:boolean;pendingLoot:boolean;
 onTrain:()=>void;onExpedition:()=>void;onClaim:()=>void;onStop:()=>void;
}
export function AdventureOverview({view,leader,speciesCount,individualCount,expedition,serverNow,expeditionAvailable,busy,pendingLoot,onTrain,onExpedition,onClaim,onStop}:Props){
 const syncing=serverNow===null||!expeditionAvailable;
 const elapsed=expedition&&serverNow!==null?formatExpeditionDuration(expeditionElapsedMs(expedition.startedAt,serverNow)):'00:00:00';
 const locked=busy||syncing;
 return <div className={styles.overview} data-testid="adventure-overview">
  <section className={styles.hero} aria-labelledby="overview-title">
   <div className={styles.heroText}><span className={styles.eyebrow}>REGIÃO DE KANTO · SEASON 1</span>
   <h1 id="overview-title">Seu <span>centro de comando</span></h1>
   <p>Tudo que você precisa para continuar sua aventura em Kanto.</p></div>
  </section>
  <section className={styles.summary} aria-label="Resumo da jornada">
   <article className={styles.metric} data-tone="trainer"><Fa name="fa-user"/><div><small>Treinador</small><strong>Nv. {view.level}</strong><span>{view.title.name}</span></div><span className={styles.watermark}><Fa name="fa-award"/></span></article>
   <article className={styles.metric} data-tone="collection"><Fa name="fa-circle-dot"/><div><small>Espécies capturadas</small><strong>{speciesCount}<small> /151</small></strong><span>{individualCount} {individualCount===1?'indivíduo':'indivíduos'}</span></div><span className={styles.watermark}><Fa name="fa-circle-dot"/></span></article>
   <article className={styles.metric} data-tone="gold"><Fa name="fa-medal"/><div><small>Vitórias</small><strong>{view.wins}</strong><span>{view.badges.length}/8 insígnias</span></div><span className={styles.watermark}><Fa name="fa-trophy"/></span></article>
  </section>
  <div className={styles.columns}>
   <section className={styles.pokemonPanel} aria-labelledby="overview-leader">
    <header><Fa name="fa-circle-dot"/><h2 id="overview-leader">Pokémon principal</h2></header>
    <div className={styles.leader}>
     <div className={styles.artStage}><span className={styles.artHalo}><Fa name="fa-circle-dot"/></span>{leader.art}<span className={styles.artRing}/></div>
     <div className={styles.identity}><span>#{String(leader.id).padStart(3,'0')}</span><h3>{leader.name}</h3>
      <div className={styles.types}>{leader.types.map(type=><span key={type} data-type={type}>{TYPE_LABELS[type]??type}</span>)}</div>
      <p>Nível <b>{leader.level}</b> <span className={styles.affinity}><Fa name="fa-heart"/> Afinidade {leader.affinity}%</span></p>
     </div>
    </div>
    <div className={styles.stats} aria-label="Atributos do Pokémon líder">{STATS.map(([key,label,icon])=><span key={key} data-stat={key}><Fa name={icon}/> {label} <b>{leader.stats?.[key]??'—'}</b></span>)}</div>
    <div className={styles.bottom}><button className={styles.train} type="button" onClick={onTrain}><Fa name="fa-dumbbell"/> Treinar Pokémon <Fa name="fa-chevron-right"/></button></div>
   </section>
   <section className={styles.expeditionPanel} aria-labelledby="overview-expedition">
    <header><Fa name="fa-mountain"/><h2 id="overview-expedition">Expedição Idle</h2></header>
    <div className={styles.expeditionIntro}>Ganhe recompensas enquanto explora Kanto. Até 8 horas de recompensas acumuladas entre resgates.</div>
    <div className={styles.timer} data-testid="overview-expedition-timer"><span><Fa name="fa-clock"/> {syncing?'SINCRONIZANDO':expedition?'EXPEDIÇÃO EM ANDAMENTO':'EXPEDIÇÃO PARADA'}</span><strong aria-live="off">{syncing?'--:--:--':elapsed}</strong>{expedition&&<small>{expedition.regionName}</small>}</div>
    <p className={styles.expeditionNote}>{pendingLoot?'Resolva os itens pendentes na mochila.':syncing?'Aguardando sincronização com o servidor.':expedition?expedition.cycles+' ciclos disponíveis para resgate.':'Uma expedição rende recursos automaticamente enquanto você está fora.'}</p>
    <div className={styles.actions} role="group" aria-label="Ações rápidas da expedição">
     <button className={styles.go} type="button" disabled={!expeditionAvailable||busy} onClick={onExpedition}><Fa name="fa-play"/> Abrir expedição</button>
     <button className={styles.claim} type="button" disabled={locked||pendingLoot||!expedition?.cycles} onClick={onClaim}><Fa name="fa-rotate"/> Resgatar</button>
     <button className={styles.stop} type="button" disabled={locked||!expedition} onClick={onStop}><Fa name="fa-stop"/> Encerrar</button>
    </div>
   </section>
  </div>
 </div>
}
