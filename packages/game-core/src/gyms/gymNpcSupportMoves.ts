/** NPC-only support definitions, separate from teachable/level-up moves. */
import type {KantoMove} from '../combat/kantoBattle.js';
export const GYM_NPC_SUPPORT_MOVES:Readonly<Record<string,KantoMove>>=Object.freeze({
 toxic:Object.freeze({name:'toxic',type:'poison',category:'status',power:0,accuracy:85,priority:0}),
 'calm-mind':Object.freeze({name:'calm-mind',type:'psychic',category:'status',power:0,accuracy:100,priority:0})
});
