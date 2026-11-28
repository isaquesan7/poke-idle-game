/** Shared Arena exclusion guard. Call only after locking the account save.
 * Old weeks expire automatically; an absent Arena does not need a DB query.
 * Fail closed on malformed Arena state. Never trust client time.
 */
import {loadCombatAdapter} from './battlePreview.mjs';
export async function arenaActivityBlocks(client,raw){
 let state;try{state=JSON.parse(raw);}catch{return true;}
 if(!state||typeof state!=='object'||Array.isArray(state))return true;
 if(!Object.hasOwn(state,'weeklyArena'))return false;
 const clock=await client.query('SELECT floor(extract(epoch from clock_timestamp())*1000)::bigint AS ms');
 const core=await loadCombatAdapter();
 const view=core.onlineArenaProgress(raw,Number(clock.rows[0].ms));
 return !view||!!view.run;
}
