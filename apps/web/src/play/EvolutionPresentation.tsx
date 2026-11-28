import {useEffect,useState} from 'react';
import {KANTO_BATTLE_SPECIES} from '@kanto/game-core';
import {PokemonArt} from './JourneyShell';
import {RegionDialog} from '../regions/RegionDialog';
import styles from './PlayApp.module.css';
import css from './PokemonPresentation.module.css';
const name=(id:number)=>KANTO_BATTLE_SPECIES[id]?.name??'Pokémon';
export function EvolutionPresentation({from,to,confirmed,onClose}:{from:number;to:number;confirmed:boolean;onClose:()=>void}){
 const [phase,setPhase]=useState<'waiting'|'charging'|'white'|'reveal'|'done'>('waiting');
 const [ready,setReady]=useState(false);
 // Preload the next GIF so replacing the fully white silhouette never
 // requires an empty stage while the asset downloads.
 useEffect(()=>{
  let active=true;
  const image=new Image();
  const finish=()=>{if(active)setReady(true);};
  image.onload=finish;image.onerror=finish;
  image.src='/assets/pokemon-gifs/poke_'+to+'.gif';
  if(image.complete)finish();
  const timeout=window.setTimeout(finish,5000);
  return()=>{active=false;image.onload=null;image.onerror=null;window.clearTimeout(timeout);};
 },[to]);
 useEffect(()=>{
  if(!confirmed||!ready)return;
  setPhase('charging');
  // Both sides of the swap use the identical white filter.
  const timers=[window.setTimeout(()=>setPhase('white'),1000),window.setTimeout(()=>setPhase('reveal'),1450),window.setTimeout(()=>setPhase('done'),2700)];
  return()=>timers.forEach(t=>window.clearTimeout(t));
 },[confirmed,ready]);
 const evolved=phase==='reveal'||phase==='done'||phase==='white';
 return <RegionDialog title={phase==='done'?'Evolução concluída!':'Seu Pokémon está evoluindo!'} size="compact" onClose={phase==='done'?onClose:()=>{}}>
  <div className={css.evolution} data-testid="evolution-presentation" data-phase={phase}>
   <div className={css.evolutionSprite}><PokemonArt id={evolved?to:from} name={evolved?name(to):name(from)} large/></div>
  </div>
  <p className={css.message} aria-live="polite">{phase==='done'?name(from)+' evoluiu para '+name(to)+'!':!confirmed?'Confirmando evolução…':'Uma nova forma está surgindo…'}</p>
  {phase==='done'&&<button type="button" className={styles.primary} onClick={onClose}>Continuar</button>}
 </RegionDialog>;
}
