/** Historical GYM04B support definitions, also used by verified online TM lessons.
 * These are not native/level-up moves and the local writer cannot grant them. */
import type {KantoMove} from '../combat/kantoBattle.js';
export const GYM_NPC_SUPPORT_MOVES:Readonly<Record<string,KantoMove>>=Object.freeze({
 toxic:Object.freeze({name:'toxic',type:'poison',category:'status',power:0,accuracy:85,priority:0}),
 'sunny-day':Object.freeze({name:'sunny-day',type:'fire',category:'status',power:0,accuracy:100,priority:0}),
 'rain-dance':Object.freeze({name:'rain-dance',type:'water',category:'status',power:0,accuracy:100,priority:0}),
 sandstorm:Object.freeze({name:'sandstorm',type:'rock',category:'status',power:0,accuracy:100,priority:0}),
 hail:Object.freeze({name:'hail',type:'ice',category:'status',power:0,accuracy:100,priority:0}),
 taunt:Object.freeze({name:'taunt',type:'dark',category:'status',power:0,accuracy:100,priority:0}),
 'double-team':Object.freeze({name:'double-team',type:'normal',category:'status',power:0,accuracy:100,priority:0}),
 rest:Object.freeze({name:'rest',type:'psychic',category:'status',power:0,accuracy:100,priority:0}),
 reflect:Object.freeze({name:'reflect',type:'psychic',category:'status',power:0,accuracy:100,priority:0}),
 'light-screen':Object.freeze({name:'light-screen',type:'psychic',category:'status',power:0,accuracy:100,priority:0}),
 safeguard:Object.freeze({name:'safeguard',type:'normal',category:'status',power:0,accuracy:100,priority:0}),
 protect:Object.freeze({name:'protect',type:'normal',category:'status',power:0,accuracy:100,priority:3}),
 'bulk-up':Object.freeze({name:'bulk-up',type:'fighting',category:'status',power:0,accuracy:100,priority:0}),
 'calm-mind':Object.freeze({name:'calm-mind',type:'psychic',category:'status',power:0,accuracy:100,priority:0})
});
