import {useState} from 'react';
import type {MachineView} from './onlinePlay';
import {kantoSpecies} from '@kanto/game-core';
import {PokemonArt} from './JourneyShell';
import {RegionDialog} from '../regions/RegionDialog';
import styles from './PlayApp.module.css';
import css from './MachineScreen.module.css';
type Machine=MachineView['machines'][number];
const name=(s:string)=>s.split('-').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
const title=(m:Machine)=>m.id.toUpperCase()+' — '+name(m.moveName);
const rarities:Record<string,string>={common:'Comum',uncommon:'Incomum',rare:'Raro',epic:'Épico',legendary:'Lendário'};
const speciesName=(id:number)=>kantoSpecies(id)?.name??'Pokémon';
function Disc({machine}:{machine:Machine}){
 return <span className={css.disc} data-type={machine.move?.type??'unknown'} aria-hidden="true"><i className="fa-solid fa-compact-disc"/></span>;
}
export function MachineEvolution({view,uid,revision,busy,onTeach}:{view:MachineView;uid:number;revision:number;busy:boolean;onTeach:(command:{uid:number;tmId:string},revision:number)=>Promise<boolean>}){
 const [filter,setFilter]=useState('all');
 const [search,setSearch]=useState('');
 const [confirm,setConfirm]=useState<Machine|null>(null);
 const pokemon=view.pokemon.find(p=>p.uid===uid);
 if(!pokemon)return null;
 const blocked=busy||view.busy||revision!==view.revision;
 const items=pokemon.compatible.flatMap(entry=>{const m=view.machines.find(x=>x.id===entry.tmId);return m?[{...entry,m}]:[];});
 const visible=items.filter(({m,origin,canTeach})=>title(m).toLowerCase().includes(search.trim().toLowerCase())&&(filter==='all'||(filter==='available'?canTeach:filter==='learned'?!!origin:!origin)));
 const choice=confirm&&items.find(x=>x.m.id===confirm.id);
 return <section className={styles.panel} aria-label="Máquinas Técnicas" data-testid="tm-evolution">
  <h2><i className="fa-solid fa-compact-disc" aria-hidden="true"/> Máquinas Técnicas (TMs)</h2>
  <p>Ensine novos golpes a {speciesName(pokemon.speciesId)}. Cada ensino consome uma TM; o golpe aprendido fica disponível na aba Golpes.</p>
  <div className={css.filters}><label>Buscar TM<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ex.: TM35 ou Flamethrower"/></label><label>Filtro<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas compatíveis</option><option value="available">Disponíveis para aprender</option><option value="learned">Aprendidas</option><option value="not-learned">Não aprendidas</option></select></label></div>
  <p>{items.length} TMs compatíveis · {items.filter(x=>x.origin).length} aprendidas</p>
  {view.busy&&<p role="status">Finalize a atividade em andamento para ensinar golpes.</p>}
  <div className={css.grid}>{visible.map(({m,origin,canTeach})=><article key={m.id} className={css.item} data-testid={'tm-evolution-'+m.id}>
   <div className={css.identity}><Disc machine={m}/><div><strong>{title(m)}</strong><small>{m.move?name(m.move.type)+' · '+(m.move.category==='physical'?'Físico':m.move.category==='special'?'Especial':'Suporte'):'Técnica em preparação'}</small><small>{m.rarity?rarities[m.rarity]:''} · Região {m.minRegion}+</small><small>Na mochila: {m.quantity}</small></div></div>
   {origin?<span className={css.learned}><i className="fa-solid fa-circle-check" aria-hidden="true"/> {origin==='tm'?'Aprendido via TM':origin==='level'?'Aprendido por nível':'Aprendido na evolução anterior'}</span>:<button type="button" className={styles.primary} disabled={blocked||!canTeach} aria-label={'Aprender '+title(m)} onClick={()=>setConfirm(m)}>{!m.implemented?'Golpe em preparação':m.quantity===0?'TM indisponível':'Aprender golpe'}</button>}
  </article>)}</div>
  {!visible.length&&<p role="status">Nenhuma TM corresponde a este filtro.</p>}
  {confirm&&choice&&<RegionDialog title="Confirmar aprendizado de TM" size="compact" onClose={()=>setConfirm(null)}>
   <div className={css.identity}><PokemonArt id={pokemon.speciesId} name={speciesName(pokemon.speciesId)}/><div><strong>{title(confirm)}</strong><small>{speciesName(pokemon.speciesId)}</small></div></div>
   <p>Será consumida 1 unidade de {confirm.id.toUpperCase()}. O aprendizado é permanente e não altera os golpes equipados.</p>
   <div className={styles.evolutionConfirmActions}><button type="button" className={styles.secondary} onClick={()=>setConfirm(null)}>Cancelar</button><button type="button" className={styles.primary} disabled={blocked||!choice.canTeach} onClick={()=>{setConfirm(null);void onTeach({uid,tmId:confirm.id},view.revision);}}>Confirmar aprendizado</button></div>
  </RegionDialog>}
 </section>;
}
export function MachineBag({view}:{view:MachineView}){
 const [selected,setSelected]=useState<string|null>(null);
 const owned=view.machines.filter(m=>m.quantity>0);
 const machine=owned.find(m=>m.id===selected);
 return <section className={css.bag} aria-label="Bolso de TMs" data-testid="tm-bag">
  <h3><i className="fa-solid fa-compact-disc" aria-hidden="true"/> Máquinas Técnicas</h3>
  <p>Bolso de TMs · {owned.length} tipos · {owned.reduce((n,m)=>n+m.quantity,0)} unidades. Ensine golpes em Pokémon → Evolução.</p>
  <div className={css.grid}>{owned.map(m=><button type="button" className={css.item+' '+css.bagItem} key={m.id} onClick={()=>setSelected(m.id)} aria-label={'Consultar '+title(m)}>
   <div className={css.identity}><Disc machine={m}/><div><strong>{title(m)}</strong><small>{m.rarity?rarities[m.rarity]:''} · Quantidade: {m.quantity}</small></div></div></button>)}</div>
  {!owned.length&&<p>Nenhuma TM na mochila.</p>}
  {machine&&<RegionDialog title={title(machine)} onClose={()=>setSelected(null)}>
   <p>Quantidade: {machine.quantity}. Ensine esta técnica na tela de Evolução de um Pokémon compatível.</p>
   <h3>Pokémon compatíveis ({machine.compatibleSpeciesIds.length})</h3>
   <div className={css.speciesGrid}>{machine.compatibleSpeciesIds.map(id=><div className={css.species} key={id}><PokemonArt id={id} name={speciesName(id)}/><small>{speciesName(id)}</small></div>)}</div>
  </RegionDialog>}
 </section>;
}
