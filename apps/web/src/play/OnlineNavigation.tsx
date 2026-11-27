import {useEffect,useRef,useState} from 'react';
import styles from './PlayApp.module.css';
import type {Tab} from './JourneyShell';

export type TrainerSection='profile'|'equipment'|'bag'|'mastery';
export type PokemonSection='profile'|'evolution'|'moves';
type Destination={tab:Tab;trainerSection?:TrainerSection;pokemonSection?:PokemonSection;label:string;icon:string};
type Group='trainer'|'pokemon'|'map';
const groups:readonly {id:Group;label:string;icon:string;links:readonly Destination[]}[]=[
 {id:'trainer',label:'Treinador',icon:'fa-user',links:[
  {tab:'trainer',trainerSection:'profile',label:'Meu perfil',icon:'fa-id-card'},
  {tab:'trainer',trainerSection:'equipment',label:'Equipamentos',icon:'fa-shield-halved'},
  {tab:'trainer',trainerSection:'bag',label:'Mochila',icon:'fa-bag-shopping'},
  {tab:'trainer',trainerSection:'mastery',label:'Centro de Pesquisa',icon:'fa-flask'},
  {tab:'collection',label:'Coleção',icon:'fa-layer-group'},
  {tab:'pokedex',label:'Pokédex',icon:'fa-book-open'}]},
 {id:'pokemon',label:'Pokémon',icon:'fa-dragon',links:[
  {tab:'pokemon',pokemonSection:'profile',label:'Perfil',icon:'fa-chart-simple'},
  {tab:'pokemon',pokemonSection:'evolution',label:'Evolução',icon:'fa-dna'},
  {tab:'pokemon',pokemonSection:'moves',label:'Golpes',icon:'fa-bolt'}]},
 {id:'map',label:'Abrir mapa',icon:'fa-map-location-dot',links:[
  {tab:'regions',label:'Regiões',icon:'fa-map'},
  {tab:'gyms',label:'Ginásios',icon:'fa-medal'},
  {tab:'expedition',label:'Expedição',icon:'fa-compass'},
  {tab:'mega',label:'Santuário Mega',icon:'fa-gem'}]}
];
function activeGroup(tab:Tab):Group|null{
 return tab==='battle'?'map':groups.find(g=>g.links.some(x=>x.tab===tab))?.id??null;
}
interface Props{megaAvailable?:boolean;masteryAvailable?:boolean;tab:Tab;trainerSection:TrainerSection;pokemonSection:PokemonSection;disabled:(tab:Tab)=>boolean;onNavigate:(destination:Destination)=>void}
export function OnlineNavigation({tab,trainerSection,pokemonSection,disabled,onNavigate,masteryAvailable=false,megaAvailable=false}:Props){
 const current=activeGroup(tab);
 const [open,setOpen]=useState<Group|null>(current);
 const [mobileOpen,setMobileOpen]=useState(false);
 const shell=useRef<HTMLDivElement>(null);
 const toggle=useRef<HTMLButtonElement>(null);
 function closeMobile(restoreFocus=false){setMobileOpen(false);if(restoreFocus&&window.matchMedia('(max-width:690px)').matches)toggle.current?.focus();}
 useEffect(()=>{
  if(!mobileOpen)return;
  const media=window.matchMedia('(max-width:690px)');
  function resize(){if(!media.matches)setMobileOpen(false)}
  function outside(event:PointerEvent){if(event.target instanceof Node&&!shell.current?.contains(event.target))setMobileOpen(false)}
  function key(event:KeyboardEvent){if(event.key==='Escape'){setMobileOpen(false);toggle.current?.focus()}}
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);media.addEventListener('change',resize);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);media.removeEventListener('change',resize)};
 },[mobileOpen]);
 useEffect(()=>{setMobileOpen(false)},[tab,trainerSection,pokemonSection]);
 // Collection shortcuts and resumed battles also reveal their active group.
 useEffect(()=>{setOpen(current)},[current]);
 function link(item:Destination,child=false){
  const active=(tab===item.tab||tab==='battle'&&item.tab==='regions')&&
   (item.trainerSection===undefined||item.trainerSection===trainerSection)&&
   (item.pokemonSection===undefined||item.pokemonSection===pokemonSection);
  return <button type="button" key={item.label} className={(active?styles.menuActive:styles.menuItem)+(child?' '+styles.menuChild:'')}
    aria-current={active?'page':undefined} disabled={disabled(item.tab)} onClick={()=>{closeMobile(mobileOpen);onNavigate(item)}}>
    <i className={'fa-solid '+item.icon} aria-hidden="true"/><span>{item.label}</span></button>;
 }
 const activeLabel=tab==='battle'?'Batalha regional':tab==='overview'?'Visão geral':tab==='shop'?'Loja':groups.flatMap(g=>g.links).find(item=>item.tab===tab&&(item.trainerSection===undefined||item.trainerSection===trainerSection)&&(item.pokemonSection===undefined||item.pokemonSection===pokemonSection))?.label??'Menu';
 return <div ref={shell} className={styles.navigationShell} data-mobile-open={mobileOpen}>
  <button type="button" ref={toggle} className={styles.mobileMenuToggle} aria-label={mobileOpen?'Fechar menu':'Abrir menu'} aria-expanded={mobileOpen} aria-controls="online-game-navigation" onClick={()=>{if(!mobileOpen)setOpen(current);setMobileOpen(v=>!v)}}>
   <i className={'fa-solid '+(mobileOpen?'fa-xmark':'fa-bars')} aria-hidden="true"/><span>Menu</span><small>{activeLabel}</small><i className={'fa-solid '+(mobileOpen?'fa-chevron-up':'fa-chevron-down')} aria-hidden="true"/>
  </button>
  <nav id="online-game-navigation" className={styles.menu+' '+styles.groupedMenu} aria-label="Navegação do jogo">
  {link({tab:'overview',label:'Visão geral',icon:'fa-house'})}
  {groups.map(group=><div className={styles.menuGroup} key={group.id} data-expanded={open===group.id}>
    <button type="button" className={(current===group.id?styles.menuActive:styles.menuItem)+' '+styles.menuGroupToggle}
      aria-expanded={open===group.id} aria-controls={'nav-'+group.id} onClick={()=>setOpen(old=>old===group.id?null:group.id)}>
      <i className={'fa-solid '+group.icon} aria-hidden="true"/><span>{group.label}</span><i className={'fa-solid '+(open===group.id?'fa-chevron-up':'fa-chevron-down')} aria-hidden="true"/>
    </button>
    <div id={'nav-'+group.id} hidden={open!==group.id} className={styles.menuChildren}>{group.links.filter(item=>(item.trainerSection!=='mastery'||masteryAvailable)&&(item.tab!=='mega'||megaAvailable)).map(item=>link(item,true))}</div>
  </div>)}
  {link({tab:'shop',label:'Loja',icon:'fa-store'})}
 </nav>
 </div>;
}
