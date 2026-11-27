/** Gen III field weather for the shared online 1v1/3x3 resolver.
 * Five completed rounds including the casting round, no stacking.
 * Gen IV Rock special-defense boost and Blizzard rain/hail rules are not used.
 */
import type {GymBattleState} from './gymBattleState.js';
import type {KantoMove} from '../combat/kantoBattle.js';
export type GymWeather='sunny-day'|'rain-dance'|'sandstorm'|'hail';
export function gymWeatherMove(name:string):GymWeather|null{
 return name==='sunny-day'||name==='rain-dance'||name==='sandstorm'||name==='hail'?name:null;
}
export function gymActiveWeather(state:GymBattleState):GymWeather|null{
 return state.weather&&state.weather.expiresAt>state.turn?state.weather.kind:null;
}
export function gymSetWeather(state:GymBattleState,kind:GymWeather):GymBattleState{
 return gymActiveWeather(state)===kind?state:{...state,weather:{kind,expiresAt:state.turn+5}};
}
export function gymWeatherAccuracy(weather:GymWeather|null,move:KantoMove):number{
 if(move.name==='thunder')return weather==='rain-dance'?100:weather==='sunny-day'?50:move.accuracy;
 return move.accuracy;
}
export function gymWeatherMultiplier(weather:GymWeather|null,type:string):number{
 if(weather==='sunny-day')return type==='fire'?1.5:type==='water'?.5:1;
 if(weather==='rain-dance')return type==='water'?1.5:type==='fire'?.5:1;
 return 1;
}
export function gymWeatherDamage(weather:GymWeather|null,move:KantoMove,damage:number):number{
 if(damage<=0||move.name==='night-shade')return damage;
 if(move.name==='solar-beam'&&weather&&weather!=='sunny-day')return Math.max(1,Math.floor(damage/2));
 return Math.max(1,Math.floor(damage*gymWeatherMultiplier(weather,move.type)));
}
export function gymWeatherResidual(weather:GymWeather|null,types:readonly string[],maxHp:number):number{
 const exposed=weather==='sandstorm'?!types.some(t=>['rock','ground','steel'].includes(t)):
  weather==='hail'?!types.includes('ice'):false;
 return exposed?Math.max(1,Math.floor(maxHp/16)):0;
}
