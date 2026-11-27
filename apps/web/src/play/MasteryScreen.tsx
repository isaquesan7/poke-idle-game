import {useState} from 'react';
import {quoteKantoResearch,KANTO_MASTERY_RANKS,kantoSpecies,kantoPokemonFormProfile} from '@kanto/game-core';
import type {MasteryView} from './onlinePlay';
import {PokemonArt} from './JourneyShell';
import {RegionDialog} from '../regions/RegionDialog';
import styles from './PlayApp.module.css';
const names=['Não iniciada','Iniciante','Experiente','Especialista','Veterano','Mestre'];
const name=(id:number)=>kantoSpecies(id)?.name??'Pokémon';
const specimenName=(p:MasteryView['pokemon'][number])=>kantoPokemonFormProfile(p.speciesId,p.megaForm)?.name??name(p.speciesId);
const specimenArt=(p:MasteryView['pokemon'][number])=>kantoPokemonFormProfile(p.speciesId,p.megaForm)?.artId??p.speciesId;
const reason={mega:'Mega Evolução ou pedra vinculada protegida',team:'Na equipe',favorite:'Favorito protegido','last-specimen':'Último exemplar',mastered:'Maestria máxima'} as const;
export type MasteryCommand={kind:'send';uids:number[]}|{kind:'favorite';uid:number;favorite:boolean};
export function MasteryScreen({view,busy,onCommand}:{view:MasteryView;busy:boolean;onCommand:(command:MasteryCommand,revision:number)=>Promise<boolean>}){
 const [selected,setSelected]=useState<number[]>([]);
 const [filter,setFilter]=useState('all');
 const [search,setSearch]=useState('');
 const [confirm,setConfirm]=useState(false);
 const blocked=busy||view.busy;
 const snapshot={roster:view.pokemon.map(p=>({uid:p.uid,pokemonId:p.speciesId,megaForm:p.megaForm,megaTrialForm:p.megaTrialForm})),team:view.pokemon.filter(p=>p.inTeam).map(p=>p.uid),favorites:view.pokemon.filter(p=>p.favorite).map(p=>p.uid),points:Object.fromEntries(view.families.map(f=>[String(f.id),f.points])),busy:view.busy};
 const quote=quoteKantoResearch(snapshot,selected);
 const matched=view.families.filter(f=>(filter==='all'||(filter==='mastered'?f.current.rank===5:f.current.rank<5))&&f.speciesIds.some(id=>name(id).toLowerCase().includes(search.toLowerCase())));
 const candidates=view.pokemon.filter(p=>filter==='all'||matched.some(f=>f.id===p.familyId)).filter(p=>specimenName(p).toLowerCase().includes(search.toLowerCase())||name(p.speciesId).toLowerCase().includes(search.toLowerCase())||name(p.familyId).toLowerCase().includes(search.toLowerCase()));
 const canSelect=(uid:number)=>selected.includes(uid)||quoteKantoResearch(snapshot,[...selected,uid]).status==='ok';
 return <div className={styles.masteryWorkspace}>
  <section className={styles.panel}><h2><i className="fa-solid fa-flask" aria-hidden="true"/> Laboratório do Professor Carvalho</h2><p>Envie exemplares excedentes para fortalecer permanentemente suas famílias evolutivas.</p>
   <div className={styles.masterySummary}><div><small>Pokémon enviados</small><strong>{view.totalSent}</strong></div><div><small>Famílias pesquisadas</small><strong>{view.families.filter(f=>f.points>0).length}/{view.totalFamilies}</strong></div><div><small>Maestrias máximas</small><strong>{view.mastered}</strong></div></div>
   {view.busy&&<p role="status">Finalize a atividade ou resolva os itens pendentes antes de enviar Pokémon.</p>}
  </section>
  <div className={styles.masteryColumns}>
   <section className={styles.panel}><h2>Famílias evolutivas</h2><div className={styles.masteryFilters}><label>Buscar família ou espécie<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ex.: Pikachu"/></label><label>Filtro<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas</option><option value="progress">Em progresso</option><option value="mastered">Concluídas</option></select></label></div>
    <div className={styles.masteryList}>{matched.map(f=><article className={styles.masteryFamily} key={f.id}><PokemonArt id={f.id} name={name(f.id)}/><div><strong>Família {name(f.id)}</strong><small>Maestria {f.current.rank} — {names[f.current.rank]}</small><progress aria-label={'Maestria '+name(f.id)} value={f.points} max={f.next?.points??100}/><small>{f.points}/{f.next?.points??100} pontos · +{f.current.xpPercent}% XP · +{f.current.statPercent}% atributos</small></div></article>)}{!matched.length&&<p>Nenhuma família encontrada.</p>}</div>
   </section>
   <section className={styles.panel}><h2>Exemplares da coleção</h2><p>Selecione até 100 duplicados. A equipe, os favoritos e o último exemplar são protegidos.</p>
    <div className={styles.masteryList}>{candidates.map(p=><article className={styles.masteryPokemon} key={p.uid} data-testid={'mastery-pokemon-'+p.uid}><PokemonArt id={specimenArt(p)} name={specimenName(p)}/><div><strong>{specimenName(p)} · Nv. {p.level}</strong><small>{p.blocked?reason[p.blocked as keyof typeof reason]:'+'+p.points+' pontos de pesquisa'} · #{p.uid}</small></div><button className={styles.secondary} type="button" disabled={blocked} aria-label={(p.favorite?'Remover favorito ':'Favoritar ')+p.uid} aria-pressed={p.favorite} onClick={()=>void onCommand({kind:'favorite',uid:p.uid,favorite:!p.favorite},view.revision)}><i className={(p.favorite?'fa-solid':'fa-regular')+' fa-star'} aria-hidden="true"/></button><label className={styles.masterySelect}><input type="checkbox" aria-label={'Selecionar Pokémon '+p.uid} checked={selected.includes(p.uid)} disabled={blocked||!!p.blocked||!canSelect(p.uid)} onChange={e=>setSelected(old=>e.target.checked?[...old,p.uid]:old.filter(id=>id!==p.uid))}/><span>Enviar</span></label></article>)}{!candidates.length&&<p>Nenhum exemplar encontrado.</p>}</div>
    <div className={styles.masteryCheckout}><strong>{selected.length} selecionado(s) · +{quote.status==='ok'?quote.totalPoints:0} pontos</strong>{quote.status==='ok'&&quote.families.map(f=><small key={f.id}>{name(f.id)}: {f.before} → {f.after} pontos</small>)}<button type="button" className={styles.primary} disabled={blocked||quote.status!=='ok'} onClick={()=>setConfirm(true)}>Enviar para pesquisa</button></div>
   </section>
  </div>
  <section className={styles.panel}><h2>Recompensas de maestria</h2><div className={styles.masteryRanks}>{KANTO_MASTERY_RANKS.slice(1).map(rank=><div key={rank.rank}><strong>{rank.rank} · {names[rank.rank]}</strong><small>{rank.points} pontos</small><small>+{rank.xpPercent}% XP · +{rank.statPercent}% atributos</small></div>)}</div></section>
  <section className={styles.panel}><h2><i className="fa-solid fa-trophy" aria-hidden="true"/> Conquistas de pesquisa</h2><p>Domine famílias para conquistar títulos exclusivos de pesquisa, sem alterar seu título de combate.</p><div className={styles.masteryAchievements}>{view.achievements.map(a=><article key={a.id} data-unlocked={a.unlocked}><i className={'fa-solid '+(a.unlocked?'fa-award':'fa-lock')} aria-hidden="true"/><div><strong>{a.name}</strong><small>{a.progress}/{a.target} famílias dominadas · {a.unlocked?'Conquistado':'Bloqueado'}</small><progress aria-label={a.name} value={a.progress} max={a.target}/></div></article>)}</div></section>
  <section className={styles.panel}><h2>Histórico de pesquisa</h2>{!view.history.length?<p>Nenhum Pokémon enviado.</p>:<div className={styles.masteryList}>{view.history.map((batch,i)=><article key={i}><strong>{batch.items.length} Pokémon · +{batch.items.reduce((n,p)=>n+p.points,0)} pontos</strong><small>{new Date(batch.at).toLocaleString('pt-BR')}</small><p>{batch.items.map(p=>name(p.speciesId)+' (+'+p.points+')').join(', ')}</p></article>)}</div>}</section>
  {confirm&&quote.status==='ok'&&<RegionDialog title="Confirmar envio para pesquisa" size="compact" onClose={()=>setConfirm(false)}><p>Os {selected.length} Pokémon selecionados serão removidos permanentemente da coleção. Você receberá {quote.totalPoints} pontos de pesquisa.</p><ul>{quote.items.map(p=><li key={p.uid}>{name(p.speciesId)} #{p.uid} · +{p.points} pontos</li>)}</ul><div className={styles.evolutionConfirmActions}><button type="button" className={styles.secondary} onClick={()=>setConfirm(false)}>Cancelar</button><button type="button" className={styles.primary} disabled={blocked} onClick={()=>{setConfirm(false);void onCommand({kind:'send',uids:[...selected]},view.revision).then(ok=>{if(ok)setSelected([])})}}>Confirmar envio</button></div></RegionDialog>}
 </div>;
}
