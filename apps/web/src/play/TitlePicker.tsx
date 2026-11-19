/** D-053 · Lista estilizada de títulos, com atributos visíveis em hover/foco.
 * Sem alterar a regra de desbloqueio nem persistir a escolha localmente.
 */
import {useEffect,useRef,useState} from 'react';
import {LEGACY_TITLES,legacyTitleIsUnlocked} from '@kanto/game-core';
import type {StatValues} from '@kanto/game-core';
import {STATS} from '@kanto/game-core';
import {STAT_LABELS} from '../features/trainer/legacyProjection';
import styles from './TitlePicker.module.css';

function bonus(stats:Partial<StatValues>){
  return STATS.filter(stat=>stats[stat]).map(stat=>STAT_LABELS[stat]+' +'+stats[stat]).join(' · ');
}
interface Props{
 selectedId:string;
 disabled:boolean;
 wins:number;
 seenCount:number;
 badgeCount:number;
 onSelect:(titleId:string)=>void;
}
export function TitlePicker({selectedId,disabled,wins,seenCount,badgeCount,onSelect}:Props){
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const current=LEGACY_TITLES.find(x=>x.id===selectedId)??LEGACY_TITLES[0]!;
  useEffect(()=>{
    if(!open)return;
    function outside(event:PointerEvent){
      if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);
    }
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  return <div className={styles.picker} ref={root}
    onKeyDown={event=>{
      if(event.key==='Escape'&&open){
        event.preventDefault();setOpen(false);
        root.current?.querySelector<HTMLButtonElement>('[aria-expanded]')?.focus();
      }
    }}>
    <span className={styles.label}>Escolha seu título</span>
    <button type="button" className={styles.trigger} disabled={disabled}
      aria-label="Título ativo do treinador" aria-expanded={open}
      aria-controls="trainer-title-options" onClick={()=>setOpen(value=>!value)}>
      <span><i className="fa-solid fa-award" aria-hidden="true"/> {current.name}</span>
      <i className={'fa-solid '+(open?'fa-chevron-up':'fa-chevron-down')} aria-hidden="true"/>
    </button>
    {open&&<div className={styles.options} id="trainer-title-options"
      role="group" aria-label="Escolher título do treinador">
      {LEGACY_TITLES.map(title=>{
        const unlocked=legacyTitleIsUnlocked(title.id,wins,seenCount,badgeCount);
        const requirement=title.id==='veterano'?'4 vitórias':title.id==='explorador'?'10 espécies vistas':
          title.id==='mestre'?'8 insígnias':'Inicial';
        return <button type="button" key={title.id}
          className={title.id===current.id?styles.optionActive:styles.option}
          aria-label={title.name+', bônus '+bonus(title.stats)+(unlocked?'':', bloqueado: '+requirement)}
          aria-disabled={!unlocked}
          aria-pressed={title.id===current.id}
          title={title.name+' · '+bonus(title.stats)}
          onClick={()=>{
            if(!unlocked||disabled)return;
            setOpen(false);
            if(title.id!==current.id)onSelect(title.id);
          }}>
          <span className={styles.optionName}><i className={'fa-solid '+(unlocked?'fa-award':'fa-lock')} aria-hidden="true"/>
            {title.name}</span>
          <small>{unlocked?(title.id===current.id?'Em uso':'Disponível'):'Bloqueado · '+requirement}</small>
          <span className={styles.tooltip} aria-hidden="true">Bônus: {bonus(title.stats)}</span>
        </button>;
      })}
    </div>}
    <p className={styles.hint}>Passe o mouse ou use Tab para conferir os bônus. Apenas títulos desbloqueados podem ser utilizados.</p>
  </div>;
}
