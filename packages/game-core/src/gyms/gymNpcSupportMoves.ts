/** Historical GYM04B support definitions, also used by verified online TM lessons.
 * These are not native/level-up moves and the local writer cannot grant them. */
import type {KantoMove} from '../combat/kantoBattle.js';
export const GYM_NPC_SUPPORT_MOVES:Readonly<Record<string,KantoMove>>=Object.freeze({
 toxic:Object.freeze({name:'toxic',type:'poison',category:'status',power:0,accuracy:85,priority:0}),
 'bulk-up':Object.freeze({name:'bulk-up',type:'fighting',category:'status',power:0,accuracy:100,priority:0}),
 'calm-mind':Object.freeze({name:'calm-mind',type:'psychic',category:'status',power:0,accuracy:100,priority:0})
});
