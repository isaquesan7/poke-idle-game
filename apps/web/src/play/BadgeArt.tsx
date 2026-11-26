import styles from './BadgeArt.module.css';
const assets:Readonly<Record<string,string>>={boulder:'rocha',cascade:'cascata',thunder:'trovao',rainbow:'arco-iris',soul:'alma',marsh:'pantano',volcano:'vulcao',earth:'terra'};
/** Visual only. Earned state and all stat bonuses remain in the game core. */
export function BadgeArt({id,earned=true,className}:{id:string;earned?:boolean;className?:string|undefined}){
 const asset=assets[id];
 return asset?<img src={'/assets/badge-'+asset+'.webp'} alt="" aria-hidden="true" data-earned={earned} className={styles.art+' '+(className??'')} decoding="async"/>:null;
}
