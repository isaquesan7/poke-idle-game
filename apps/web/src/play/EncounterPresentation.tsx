import {useState} from 'react';
import css from './PokemonPresentation.module.css';
/** Purely decorative. Server still chooses the opponent. */
export function EncounterPresentation({phase='idle'}:{phase?:'idle'|'searching'|'reveal'}){
 const [failed,setFailed]=useState(false);
 return <div className={css.encounter} data-testid="encounter-presentation" data-phase={phase} aria-label={phase==='idle'?'Encontro surpresa':'Procurando Pokémon selvagem'}>
  {!failed?<img className={css.bush} src="/assets/encounter-bush.webp" alt="" onError={()=>setFailed(true)}/>:<span className={css.bushFallback} aria-hidden="true"><i className="fa-solid fa-leaf"/><i className="fa-solid fa-leaf"/><i className="fa-solid fa-leaf"/></span>}
  {phase!=='idle'&&[0,1,2,3,4].map(i=><i key={i} className={'fa-solid fa-leaf '+css.leaf} style={{left:(8+i*20)+'%',top:(20+(i%2)*37)+'%',animationDelay:i*.11+'s'}} aria-hidden="true"/>)}
  <span className={css.searchText}>{phase==='idle'?'Encontro surpresa':phase==='reveal'?'Pokémon encontrado!':'Procurando na região…'}</span>
 </div>;
}
