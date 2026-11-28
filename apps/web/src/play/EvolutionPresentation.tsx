import {useEffect,useState} from 'react';
import {KANTO_BATTLE_SPECIES} from '@kanto/game-core';
import {PokemonArt} from './JourneyShell';
import {RegionDialog} from '../regions/RegionDialog';
import styles from './PlayApp.module.css';
import css from './PokemonPresentation.module.css';
const name=(id:number)=>KANTO_BATTLE_SPECIES[id]?.name??'Pokémon';
export function EvolutionPresentation({from,to,confirmed,onClose}:{from:number;to:number;confirmed:boolean;onClose:()=>void}){
 const [phase,setPhase]=useState<'charging'|'white'|'reveal'|'done'>('charging');
 useEffect(()=>{
  if(!confirmed)return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setPhase('done');return;}
  const timers=[window.setTimeout(()=>setPhase('white'),650),window.setTimeout(()=>setPhase('reveal'),1250),window.setTimeout(()=>setPhase('done'),2350)];
  return()=>timers.forEach(t=>window.clearTimeout(t));
 },[confirmed]);
 const evolved=phase==='reveal'||phase==='done'||phase==='white';
 return <RegionDialog title={phase==='done'?'Evolução concluída!':'Seu Pokémon está evoluindo!'} size="compact" onClose={phase==='done'?onClose:()=>{}}>
  <div className={css.evolution} data-testid="evolution-presentation" data-phase={phase}>
   <div className={css.halo} aria-hidden="true"/><div className={css.ring} aria-hidden="true"/>
   <div className={css.evolutionSprite}><PokemonArt id={evolved?to:from} name={evolved?name(to):name(from)} large/></div>
   <span className={css.sparkle} aria-hidden="true">✦</span><span className={css.sparkle2} aria-hidden="true">✦</span>
  </div>
  <p className={css.message} aria-live="polite">{phase==='done'?name(from)+' evoluiu para '+name(to)+'!':!confirmed?'Confirmando evolução…':'Uma nova forma está surgindo…'}</p>
  {phase==='done'&&<button type="button" className={styles.primary} onClick={onClose}>Continuar</button>}
 </RegionDialog>;
}
