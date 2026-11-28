import {useState} from 'react';
import styles from './GearArt.module.css';
const IDS=new Set(['cap','visor','coat','battle-jacket','gloves','gloves-tech','pants','shoes','necklace','ring-a','ring-b','ring-c','ring-d','earrings','arena-hat','arena-jacket','arena-gloves','arena-pants','arena-shoes','arena-necklace','arena-ring1','arena-ring2','arena-earrings']);
/** Art is keyed by catalog template, never by unique owned instance or rolled stats. */
export function GearArt({id,rarity,fallback}:{id:string;rarity?:string|undefined;fallback:string}){
 const [failed,setFailed]=useState<string|null>(null);
 return <span className={styles.art} data-rarity={rarity} data-arena={id.startsWith('arena-')?'true':undefined} aria-hidden="true">
  {IDS.has(id)&&failed!==id?<img src={'/assets/gear-'+id+'.webp'} alt="" onError={()=>setFailed(id)}/>:<i className={'fa-solid '+fallback}/>}
 </span>;
}
