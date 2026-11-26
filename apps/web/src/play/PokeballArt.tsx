import styles from './PokeballArt.module.css';

const images={
 'poke-ball':'/assets/poke-ball.webp',
 'great-ball':'/assets/great-ball.webp',
 'ultra-ball':'/assets/ultra-ball.webp',
 'master-ball':'/assets/master-ball.webp'
} as const;
type BallArtId=keyof typeof images;
export function isBallArtId(id:string):id is BallArtId{return Object.prototype.hasOwnProperty.call(images,id)}
/** Decorative; surrounding labels identify the item. Master Ball is art only, not a game item unlock. */
export function PokeballArt({id,className}:{id:string;className?:string}){
 if(!isBallArtId(id))return <PokeballSymbol className={className}/>;
 return <img className={styles.ball+' '+(className??'')} src={images[id]} alt="" aria-hidden="true" decoding="async"/>;
}
/** Uses the original silhouette's alpha channel; color independent of source RGB. */
export function PokeballSymbol({className}:{className?:string}){
 return <span aria-hidden="true" className={styles.symbol+' '+(className??'')}/>;
}
