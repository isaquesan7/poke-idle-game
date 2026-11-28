/** ARENA02B: server-only deterministic duel adapter.
 * No persistence, reward, seed issuance or HTTP. The future writer must
 * lock the authoritative save, run and database clock, and certify this result.
 */
import {quoteArenaFloor} from '../progression/weeklyArena.js';
import type {ArenaWeeklyProgress} from '../progression/weeklyArena.js';
import {weeklyArenaRotation,arenaTrainingFraction} from '../progression/weeklyArenaRotation.js';
import {kantoSpecies} from '../catalog/kantoSpecies.js';
import {canonicalOnlineGymTrainerBonuses,canonicalOnlineOwnedCombatant} from './serverGymPreparation.js';
import {gymPokemonTraining} from '../gyms/gymTactics.js';
import {pokemonFinalStats} from '../stats/pokemon.js';
import {STATS,zeroStats} from '../stats/types.js';
import {createGymBattleState} from '../gyms/gymBattleState.js';
import type {GymBattleState,GymSideState} from '../gyms/gymBattleState.js';
import {gymChooseAiAction} from '../gyms/gymAiTurn.js';
import {resolveGymTurn,GYM_MAX_TURNS} from '../gyms/gymTurn.js';
import type {Combatant,KantoBattleVisualFrame} from './kantoBattle.js';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const positiveUid=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
type Opponent=NonNullable<ReturnType<typeof weeklyArenaRotation>>['opponents'][number];
/** Candidate legal NPC build: progressively invest its own training budget.
 * Training grows continuously to the full legal budget for endgame floors.
 * No NPC equipment/title bonuses in this initial proposal.
 */
function opponentCombatant(p:Opponent):Combatant|null{
 const species=kantoSpecies(p.speciesId);
 if(!species||!p.moves[0])return null;
 const training=gymPokemonTraining(p.speciesId,p.level,p.moves);
 const fraction=arenaTrainingFraction(p.floor);
 for(const stat of STATS)training[stat]=Math.floor(training[stat]*fraction);
 return {speciesId:p.speciesId,name:species.name,level:p.level,types:species.types,
  stats:pokemonFinalStats(species.base,p.level,training,zeroStats(),100),
  affinity:100,moves:p.moves,move:p.moves[0],ranks:p.ranks,rank:p.ranks[p.moves[0].name]??0};
}
const inactiveReserves=(party:GymSideState):GymSideState=>({...party,fighters:[
 party.fighters[0],{...party.fighters[1],hp:0},{...party.fighters[2],hp:0}]});
/** The preview and actual opponent originate from the same weekly catalogue.
 * Only one of the frozen three UIDs may enter; the other two cannot switch in.
 */
export function prepareArenaFloorBattle(raw:string,nowMs:number,prior:ArenaWeeklyProgress|null,
 weekStartMs:number,runId:string,floor:number,uid:number){
 const q=quoteArenaFloor(nowMs,prior,weekStartMs,runId,floor,uid);
 if(q.status!=='ok')return q;
 let source:unknown;try{source=JSON.parse(raw);}catch{return {status:'invalid-save'} as const;}
 if(!record(source)||!Array.isArray(source.team)||!Array.isArray(source.roster)||
  !prior?.run||source.team.length!==3||source.team.some((id,i)=>id!==prior.run!.team[i])||
  !source.roster.every(p=>record(p)&&positiveUid(p.uid))||
  new Set(source.roster.map(p=>p.uid)).size!==source.roster.length||
  !prior.run.team.every(id=>source.roster instanceof Array&&source.roster.some(p=>p.uid===id)))
  return {status:'invalid-team'} as const;
 const bonuses=canonicalOnlineGymTrainerBonuses(source);
 const owned=source.roster.find(p=>p.uid===uid);
 const player=bonuses?canonicalOnlineOwnedCombatant(source,owned,bonuses):null;
 const rotation=weeklyArenaRotation(weekStartMs),opponent=rotation?.opponents[floor-1];
 const boss=opponent?opponentCombatant(opponent):null;
 if(!rotation||!opponent||!player||!boss)return {status:'invalid-combatants'} as const;
 // Reuse the exact engine's three-slot representation, with two KO slots.
 const sentinels=[Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER-1,Number.MAX_SAFE_INTEGER-2].filter(x=>x!==uid);
 const start=createGymBattleState([{uid,combatant:player},
  {uid:sentinels[0]!,combatant:player},{uid:sentinels[1]!,combatant:player}],[boss,boss,boss]);
 const battle:GymBattleState={...start,player:inactiveReserves(start.player),leader:inactiveReserves(start.leader)};
 return {...q,weekStartMs,runId,rotationVersion:rotation.version,opponent,battle} as const;
}
/** Private replay of a prepared 1v1; never accept a browser-supplied state. */
export function resolvePreparedArenaDuel(start:GymBattleState,seedForTurn:(turn:number)=>number){
 if(typeof seedForTurn!=='function')return {status:'invalid-seed'} as const;
 let state=start;
 const log:string[]=[],frames:KantoBattleVisualFrame[]=[];
 while(state.outcome==='ongoing'&&state.turn<GYM_MAX_TURNS){
  const seed=seedForTurn(state.turn+1);
  if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)return {status:'invalid-seed'} as const;
  const player=gymChooseAiAction(state,'player'),leader=gymChooseAiAction(state,'leader');
  if(player.kind==='switch'||leader.kind==='switch')return {status:'invalid-turn'} as const;
  const turn=resolveGymTurn(state,player,leader,seed);
  if(turn.status!=='applied'||turn.state.turn<=state.turn)return {status:'invalid-turn'} as const;
  state=turn.state;
  log.push(...turn.log.map(line=>'T'+state.turn+' '+line.replace(/^player\b/,start.player.fighters[0].combatant.name).replace(/^leader\b/,start.leader.fighters[0].combatant.name)));
  frames.push(...turn.frames);
 }
 return {status:'ok',outcome:state.outcome==='player-win'?'win':state.outcome==='leader-win'?'loss':'draw',
  turns:state.turn,log,frames,final:state} as const;
}
export function resolveArenaFloorBattle(raw:string,nowMs:number,prior:ArenaWeeklyProgress|null,
 weekStartMs:number,runId:string,floor:number,uid:number,seedForTurn:(turn:number)=>number){
 const prepared=prepareArenaFloorBattle(raw,nowMs,prior,weekStartMs,runId,floor,uid);
 if(prepared.status!=='ok')return prepared;
 const duel=resolvePreparedArenaDuel(prepared.battle,seedForTurn);
 if(duel.status!=='ok')return duel;
 return {...duel,uid,floor,weekStartMs,runId,rotationVersion:prepared.rotationVersion,
  opponent:prepared.opponent} as const;
}
