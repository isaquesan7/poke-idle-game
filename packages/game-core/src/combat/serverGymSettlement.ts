/** ONLINE-01C-23B2H: PURE Gym reward transition.
 * Uses the same KANTO_GYMS catalog and grantXp policy as GYM-03A local.
 * Combat and terminal result MUST be independently replay-certified by API.
 * No browser data, DB, IO, RNG, coins/XP supplied by callers.
 */
import {KANTO_GYMS,kantoNextGym} from '../gyms/kantoGyms.js';
import {grantXp} from '../progression/xp.js';
const natural=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
type Rec=Record<string,unknown>;
const record=(v:unknown):v is Rec=>!!v&&typeof v==='object'&&!Array.isArray(v);

export function applyCertifiedGymSettlement(raw:string,params:{
  gymId:string;outcome:'player-win'|'leader-win'|'draw';
  battle:unknown;eventId:string
}):{raw:string;paid:{gymId:string;outcome:string;badgeId:string|null;
  coins:number;trainerXp:number}}|null{
  if(typeof raw!=='string'||!params||typeof params!=='object'||
     typeof params.gymId!=='string'||
     !['player-win','leader-win','draw'].includes(params.outcome)||
     typeof params.eventId!=='string'||params.eventId.length<12)
    return null;
  let source:unknown;
  try{source=JSON.parse(raw);}catch{return null;}
  if(!record(source)||source.version!==1||source.mode!=='normal'||
     !record(source.trainer)||!natural(source.trainer.level)||
     source.trainer.level<1||source.trainer.level>100||
     !natural(source.trainer.xp)||!natural(source.coins)||
     !Array.isArray(source.badges)||!Array.isArray(source.roster)||
     !Array.isArray(source.team)||source.team.length!==3||
     new Set(source.team).size!==3||source.expedition!==null)
    return null;
  const gym=kantoNextGym(source.badges as string[]);
  if(!gym||gym.id!==params.gymId)return null;
  const battle=params.battle;
  if(!record(battle)||battle.outcome!==params.outcome||
     !Number.isSafeInteger(battle.turn)||battle.turn<1||battle.turn>120||
     !record(battle.player)||!record(battle.leader)||
     !Array.isArray(battle.player.fighters)||battle.player.fighters.length!==3||
     !Array.isArray(battle.leader.fighters)||battle.leader.fighters.length!==3)
    return null;
  const players=battle.player.fighters as unknown[];
  const enemies=battle.leader.fighters as unknown[];
  if(!players.every(p=>record(p)&&Number.isSafeInteger(p.uid)&&
       (source.team as unknown[]).includes(p.uid)&&record(p.combatant)&&
       natural(p.hp)&&natural(p.sp)&&
       (source.roster as unknown[]).some(r=>record(r)&&r.uid===p.uid&&
         r.pokemonId===p.combatant.speciesId&&r.level===p.combatant.level))||
     players.some((p,i)=>!record(p)||p.uid!==(source.team as unknown[])[i])||
     !enemies.every((p,i)=>record(p)&&record(p.combatant)&&
       p.combatant.speciesId===gym.team[i]?.speciesId&&
       p.combatant.level===gym.team[i]?.level&&natural(p.hp)))
    return null;
  const pAlive=players.some(x=>record(x)&&Number(x.hp)>0);
  const lAlive=enemies.some(x=>record(x)&&Number(x.hp)>0);
  if(params.outcome==='player-win'&&(lAlive||!pAlive)||
     params.outcome==='leader-win'&&(pAlive||!lAlive)||
     params.outcome==='draw'&&pAlive&&lAlive&&battle.turn<120)
    return null;
  if(params.outcome!=='player-win'){
    source.lastGymOutcome={gymId:gym.id,outcome:params.outcome};
    return {raw:JSON.stringify(source),paid:{
      gymId:gym.id,outcome:params.outcome,badgeId:null,coins:0,trainerXp:0}};
  }
  if(!natural(source.coins)||!Number.isSafeInteger(source.coins+gym.coins)||
     !Number.isSafeInteger((source.trainer.xp as number)+gym.trainerXp))
    return null;
  const next=grantXp('trainer',{
    level:source.trainer.level as number,xp:source.trainer.xp as number
  },gym.trainerXp);
  source.coins+=gym.coins;
  source.trainer.level=next.level;
  source.trainer.xp=next.xp;
  source.badges=[...(source.badges as string[]),gym.id];
  source.lastGymVictory={gymId:gym.id,eventId:params.eventId,
    coins:gym.coins,trainerXp:gym.trainerXp,badgeStats:gym.badgeStats,
    turn:battle.turn};
  return {raw:JSON.stringify(source),paid:{
    gymId:gym.id,outcome:params.outcome,badgeId:gym.id,
    coins:gym.coins,trainerXp:gym.trainerXp}};
}
