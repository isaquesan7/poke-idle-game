/** GYM04: fixed NPC-only FRLG signature techniques. Actual original parties
 * cross-checked at https://pokemondungeon.com/gym-leaders-strategy-guide-2/
 * and https://www.serebii.net/fireredleafgreen/gyms.shtml .
 * Only species present in both the original party and our adapted trio.
 * No player teaching, regional encounters, learnset mutation or TM rewards.
 */
import type {KantoMove} from '../combat/kantoBattle.js';
import {KANTO_BATTLE_MOVES} from '../combat/kantoBattle.js';
const move=(name:string,type:string,category:'physical'|'special',power:number,accuracy:number):KantoMove=>({name,type,category,power,accuracy,priority:0});
const SIGNATURES:Readonly<Record<string,Readonly<{tm:number;species:readonly number[];move:KantoMove}>>>={
 boulder:{tm:39,species:[95],move:move('rock-tomb','rock','physical',50,80)},
 cascade:{tm:3,species:[120,121],move:move('water-pulse','water','special',60,100)},
 thunder:{tm:34,species:[100,25,26],move:move('shock-wave','electric','special',60,100)},
 rainbow:{tm:19,species:[114,71,45],move:KANTO_BATTLE_MOVES['giga-drain']!},
 volcano:{tm:38,species:[77,78,59],move:KANTO_BATTLE_MOVES['fire-blast']!},
 earth:{tm:26,species:[51,31,34],move:move('earthquake','ground','physical',100,100)}
};
export function gymSignatureTm(gymId:string,speciesId:number){
 const tm=SIGNATURES[gymId];
 return tm?.species.includes(speciesId)?tm:null;
}
export const GYM_SIGNATURE_TM_PENDING=Object.freeze([
 {gymId:'soul',tm:6,moveName:'toxic',species:[109,89,110],reason:'escalating poison'},
 {gymId:'marsh',tm:4,moveName:'calm-mind',species:[122,64,65],reason:'self special attack and defense boosts'}
]);
