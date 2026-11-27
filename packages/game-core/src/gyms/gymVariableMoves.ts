/** Online TM-only, transient effective power. Canonical slots and SP stay fixed.
 * Affinity is frozen by the server; 0–100 is this game's existing scale.
 * Facade retains the Gen III burn penalty in the damage engine.
 */
import type {KantoMove} from '../combat/kantoBattle.js';
export function gymEffectiveMove(move:KantoMove,affinity:number|undefined,status:string|null|undefined):KantoMove{
 if(move.name==='return'||move.name==='frustration'){
  if(affinity===undefined||!Number.isSafeInteger(affinity)||affinity<0||affinity>100)
   throw new RangeError('Afinidade congelada obrigatória para Return/Frustration.');
  const bond=move.name==='return'?affinity:100-affinity;
  return {...move,power:Math.max(1,Math.floor(102*bond/100))};
 }
 if(move.name==='facade'&&(status==='burn'||status==='poison'||status==='paralysis'))
  return {...move,power:140};
 return move;
}
