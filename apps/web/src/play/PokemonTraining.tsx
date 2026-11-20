/** D-056 · Distribuição segura de atributos de UM Pokémon.
 * Todas as mudanças ficam em memória até um único commit versionado.
 * Remontar pelo UID limpa rascunho ao trocar de exemplar.
 */
import {useState} from 'react';
import {STATS} from '@kanto/game-core';
import type {Stat,StatValues} from '@kanto/game-core';
import {STAT_LABELS} from '../features/trainer/legacyProjection';
import styles from './PokemonTraining.module.css';

type Draft=Partial<Record<Stat,number>>;
const ICONS:Readonly<Record<Stat,string>>={
  hp:'fa-heart-pulse',attack:'fa-khanda',defense:'fa-shield-halved',
  specialAttack:'fa-wand-magic-sparkles',specialDefense:'fa-shield-heart',speed:'fa-angles-right'
};
interface Props{
  uid:number;revision:number;busy:boolean;
  stats:StatValues|null;manual:StatValues;budget:number;
  previewStats:(increments:Draft)=>StatValues|null;
  onConfirm:(uid:number,increments:Draft,revision:number)=>Promise<boolean>;
  onReset:()=>void;
}
export function PokemonTraining({uid,revision,busy,stats,manual,budget,previewStats,onConfirm,onReset}:Props){
  const [draft,setDraft]=useState<Draft>({});
  const [draftRevision,setDraftRevision]=useState(revision);
  const [submitting,setSubmitting]=useState(false);
  const pending=draftRevision===revision?draft:{};
  const staged=STATS.reduce((sum,stat)=>sum+(pending[stat]??0),0);
  const spent=STATS.reduce((sum,stat)=>sum+manual[stat],0);
  const remaining=Math.max(0,budget-spent-staged);
  // Valores exatos do game-core; HP manual escala em 2, outros atributos em 1.
  const computedPreview=staged>0?previewStats(pending):stats;
  const stale=draftRevision!==revision&&STATS.some(stat=>(draft[stat]??0)>0);
  function clear(){setDraft({});setDraftRevision(revision);}
  function stage(stat:Stat){
    if(busy||submitting||stale||remaining<1)return;
    setDraftRevision(revision);
    setDraft({...pending,[stat]:(pending[stat]??0)+1});
  }
  function undo(stat:Stat){
    if(busy||submitting||stale||!(pending[stat]??0))return;
    const next={...pending};
    if(next[stat]===1)delete next[stat];
    else next[stat]=(next[stat]??0)-1;
    setDraft(next);
  }
  async function confirm(){
    if(busy||submitting||stale||staged<1)return;
    setSubmitting(true);
    try{if(await onConfirm(uid,pending,draftRevision))clear();}
    finally{setSubmitting(false);}
  }
  return <section className={styles.panel} id="pokemon-attributes" aria-label="Treinamento Pokémon">
    <div className={styles.heading}><h2><i className="fa-solid fa-chart-simple" aria-hidden="true"/> Treinamento Pokémon</h2>
      <span>Prévia antes de confirmar</span>
    </div>
    {!stats&&<p>Os atributos de batalha desta espécie não estão disponíveis.</p>}
    <div className={styles.stats}>
      {STATS.map(stat=>{
        const increment=pending[stat]??0;
        const value=stats?.[stat]??0;
        const after=computedPreview?.[stat]??value;
        return <div className={styles.stat} key={stat}>
          <span className={styles.statLabel}><i className={'fa-solid '+ICONS[stat]} aria-hidden="true"/>{STAT_LABELS[stat]}</span>
          <div className={styles.track} aria-hidden="true">
            <span className={styles.trackPreview} style={{width:Math.min(100,after/400*100)+'%'}}/>
            <span className={styles.trackCurrent} style={{width:Math.min(100,value/400*100)+'%'}}/>
          </div>
          <strong>{stats?value:'—'}</strong>
          {increment?<small className={styles.plus}>→ {after}</small>:<small className={styles.noPlus}> </small>}
          <div className={styles.statActions}>
            {increment>0&&<button type="button" className={styles.undoPoint} aria-label={'Retirar um ponto da prévia de '+STAT_LABELS[stat]}
              disabled={busy||submitting||stale} onClick={()=>undo(stat)}>−</button>}
            <button type="button" aria-label={'Pré-visualizar +1 em '+STAT_LABELS[stat]}
              disabled={busy||submitting||stale||remaining<1||!stats} onClick={()=>stage(stat)}>+1</button>
          </div>
        </div>;
      })}
    </div>
    <div className={styles.points}><span>Pontos disponíveis: <strong>{remaining}</strong></span><small>de {budget} totais · {spent} utilizados</small></div>
    {stale&&<p role="alert" className={styles.warning}>O progresso mudou. Cancele a prévia e distribua os pontos novamente.</p>}
    {(staged>0||stale)&&<div className={styles.footer}>
      <p role="status"><strong>{stale?'Prévia desatualizada':staged+' ponto(s) aguardando confirmação'}</strong></p>
      <div><button type="button" className={styles.cancel} onClick={clear} disabled={busy||submitting}>Cancelar</button>
        <button type="button" className={styles.confirm} disabled={busy||submitting||stale}
          onClick={()=>void confirm()}><i className="fa-solid fa-check" aria-hidden="true"/> {submitting?'Confirmando…':'Confirmar distribuição'}</button></div>
    </div>}
    <div className={styles.reset}><span>Deseja recomeçar a distribuição?</span>
      <button type="button" disabled={busy||submitting||spent===0} onClick={onReset}>Redistribuir pontos</button>
    </div>
  </section>;
}
