import {KANTO_REGIONS,KANTO_BATTLE_SPECIES} from '@kanto/game-core';
import {PokemonArt} from './JourneyShell';
import css from './PokemonPresentation.module.css';
/** Presentation only. Never rolls or changes the server's encounter.
 * Ordinary species silhouettes avoid leaking the exact opponent or rare odds.
 */
export function EncounterPresentation({regionId}:{regionId:number}){
 const ids=(KANTO_REGIONS.find(r=>r.id===regionId)?.speciesIds??[]).filter(id=>id<144).slice(0,3);
 return <div className={css.encounter} data-testid="encounter-presentation" role="status" aria-label="Procurando Pokémon selvagem">
  {ids.map((id,i)=><span key={id} className={css.candidate} style={{animationDelay:i*.45+'s'}} aria-hidden="true"><PokemonArt id={id} name={KANTO_BATTLE_SPECIES[id]?.name??'Pokémon'}/></span>)}
  {[0,1,2,3,4].map(i=><i key={i} className={'fa-solid fa-leaf '+css.leaf} style={{left:(8+i*20)+'%',top:(20+(i%2)*37)+'%',animationDelay:i*.17+'s'}} aria-hidden="true"/>)}
  <span className={css.searchText}>Procurando na região…</span>
 </div>;
}
