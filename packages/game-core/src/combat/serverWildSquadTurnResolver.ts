/** ONLINE-01C-23B1: real 2–3 trainer Pokémon versus ONE wild opponent.
 * Reuses the exact Gym 3-slot state transitions, legal actions and fair AI.
 * The wild's two phantom slots are always KO; only real trainer slots are
 * switchable. All HP/SP/status/recovery quotas follow individual UIDs.
 * This is a pure deterministic server-only engine, no rewards or database.
 */
import {canonicalFrozenWildParty} from './serverWildParty.js';
import {createFrozenWildTurnSession} from './serverWildTurnSession.js';
import {createGymBattleState} from '../gyms/gymBattleState.js';
import {gymLegalTurnActions} from '../gyms/gymTurn.js';
import {resolveGymAiTurn,gymChooseAiAction} from '../gyms/gymAiTurn.js';
import type {GymBattleState,GymFighterState,GymSideState} from '../gyms/gymBattleState.js';
import type {GymTurnAction} from '../gyms/gymTurn.js';
import type {Combatant,KantoBattleVisualFrame} from './kantoBattle.js';
import type {KantoBattleStatus} from './kantoStatusEffects.js';

export type SquadHumanAction=
 | {readonly kind:'basic'|'focus'}
 | {readonly kind:'move';readonly moveName:string}
 | {readonly kind:'switch';readonly toIndex:number};
type Summary={
 uid:number;speciesId:number;hp:number;maxHp:number;sp:number;maxSp:number;
 status:KantoBattleStatus|null;focusUses:number;lastFocusTurn:number;
 equippedMoves:readonly string[];
};
type WildSummary=Omit<Summary,'uid'>;
export type SquadTurnState={
 version:1;mode:'turns';regionId:1;phase:'await-player'|'resolved';
 turn:number;maxTurns:30;player:Summary;wild:WildSummary;
 playerParty:readonly Summary[];log:readonly string[];
 frames:readonly KantoBattleVisualFrame[];
 engine?:GymBattleState;outcome?:'win'|'loss'|'draw';
};
const names=(c:Combatant)=>(c.moves??[c.move]).map(move=>move.name);
const comparable=(a:Combatant,b:Combatant)=>a.speciesId===b.speciesId&&
 a.name===b.name&&a.level===b.level&&a.rank===b.rank&&
 a.types.join(',')===b.types.join(',')&&
 Object.keys(a.stats).every(k=>a.stats[k as keyof typeof a.stats]===
   b.stats[k as keyof typeof b.stats])&&
 names(a).join(',')===names(b).join(',');
const summary=(f:GymFighterState):Summary=>({
 uid:f.uid!,speciesId:f.combatant.speciesId,
 hp:f.hp,maxHp:f.combatant.stats.hp,sp:f.sp,maxSp:f.maxSp,
 status:f.status,focusUses:f.focusUses,lastFocusTurn:f.lastFocusTurn,
 equippedMoves:names(f.combatant)
});
const wildSummary=(f:GymFighterState):WildSummary=>{
 const {uid:unused,...rest}=summary(f);
 return rest;
};
function initialize(snapshot:unknown):GymBattleState|null{
 const squad=canonicalFrozenWildParty(snapshot);
 const s=snapshot as {party:readonly {uid:number}[]};
 if(!squad||squad.party.length<2||squad.party.length>3)return null;
 const player=squad.party.map((combatant,i)=>({
   uid:s.party[i]!.uid,combatant
 }));
 if(player.length===2)player.push({
   uid:Number.MAX_SAFE_INTEGER,combatant:squad.party[0]!
 });
 const first=createGymBattleState(
   [player[0]!,player[1]!,player[2]!],
   [squad.wild,squad.wild,squad.wild]
 );
 const padded=(side:GymSideState):GymSideState=>({
   ...side,fighters:[side.fighters[0],side.fighters[1],
     {...side.fighters[2],hp:0}]
 });
 return {...first,
   player:squad.party.length===2?padded(first.player):first.player,
   leader:padded({...first.leader,fighters:[
     first.leader.fighters[0],
     {...first.leader.fighters[1],hp:0},
     first.leader.fighters[2]
   ]})
 };
}
function matches(actual:Summary,expected:Summary):boolean{
 return !!actual&&actual.uid===expected.uid&&
   actual.speciesId===expected.speciesId&&actual.hp===expected.hp&&
   actual.maxHp===expected.maxHp&&actual.sp===expected.sp&&
   actual.maxSp===expected.maxSp&&actual.status===expected.status&&
   actual.focusUses===expected.focusUses&&
   actual.lastFocusTurn===expected.lastFocusTurn&&
   Array.isArray(actual.equippedMoves)&&
   actual.equippedMoves.join(',')===expected.equippedMoves.join(',');
}
function verify(snapshot:unknown,state:SquadTurnState,engine:GymBattleState):boolean{
 const squad=canonicalFrozenWildParty(snapshot);
 if(!squad||state.playerParty.length!==squad.party.length||
   !engine||engine.outcome!=='ongoing'||engine.turn!==state.turn||
   !engine.player||!engine.leader||engine.player.fighters.length!==3||
   engine.leader.fighters.length!==3||
   engine.leader.activeIndex!==0||engine.leader.needsReplacement||
   engine.leader.voluntarySwitchesUsed!==0||
   engine.leader.fighters[1]?.hp!==0||
   engine.leader.fighters[2]?.hp!==0||
   !comparable(engine.leader.fighters[0]!.combatant,squad.wild))
   return false;
 const side=engine.player;
 if(!Number.isSafeInteger(side.activeIndex)||
   side.activeIndex<0||side.activeIndex>=squad.party.length||
   side.voluntarySwitchesUsed<0||side.voluntarySwitchesUsed>3||
   (squad.party.length===2&&side.fighters[2]?.hp!==0))
   return false;
 for(let i=0;i<squad.party.length;i++){
   const actual=side.fighters[i]!,base=squad.party[i]!;
   if(!comparable(actual.combatant,base)||
      actual.uid!==(snapshot as {party:readonly {uid:number}[]}).party[i]!.uid||
      !Number.isSafeInteger(actual.hp)||actual.hp<0||
      actual.hp>base.stats.hp||
      !Number.isSafeInteger(actual.sp)||actual.sp<0||
      actual.sp>actual.maxSp||
      !matches(state.playerParty[i]!,summary(actual)))
      return false;
 }
 const active=side.fighters[side.activeIndex]!;
 const enemy=engine.leader.fighters[0]!;
 if(!matches(state.player,summary(active))||
    state.wild.speciesId!==enemy.combatant.speciesId||
    state.wild.hp!==enemy.hp||state.wild.sp!==enemy.sp||
    state.wild.maxHp!==enemy.combatant.stats.hp||
    state.wild.maxSp!==enemy.maxSp||
    state.wild.focusUses!==enemy.focusUses||
    state.wild.lastFocusTurn!==enemy.lastFocusTurn||
    state.wild.status!==enemy.status||
    state.wild.equippedMoves.join(',')!==names(enemy.combatant).join(',')||
    (side.needsReplacement?active.hp!==0:
      active.hp===0))
   return false;
 return true;
}
const valid=(action:unknown):action is SquadHumanAction=>{
 if(!action||typeof action!=='object'||Array.isArray(action))return false;
 const a=action as Record<string,unknown>,keys=Object.keys(a);
 return (keys.length===1&&(a.kind==='basic'||a.kind==='focus'))||
   (keys.length===2&&a.kind==='move'&&typeof a.moveName==='string'&&
     /^[a-z][a-z-]{1,63}$/.test(a.moveName))||
   (keys.length===2&&a.kind==='switch'&&
     Number.isSafeInteger(a.toIndex)&&
     (a.toIndex as number)>=0&&(a.toIndex as number)<=2);
};
const sameAction=(a:GymTurnAction,b:SquadHumanAction)=>
 a.kind===b.kind&&(a.kind==='move'?
    b.kind==='move'&&a.moveName===b.moveName:
    a.kind==='switch'?b.kind==='switch'&&a.toIndex===b.toIndex:true);
function actorAndEngine(snapshot:unknown,current:unknown):
 {state:SquadTurnState;engine:GymBattleState}|null{
 if(!current||typeof current!=='object'||Array.isArray(current))return null;
 const state=current as SquadTurnState;
 const initial=createFrozenWildTurnSession(snapshot);
 if(!initial||!('playerParty' in initial)||!initial.playerParty||
    state.mode!=='turns'||state.version!==1||state.regionId!==1||
    state.phase!=='await-player'||!Number.isSafeInteger(state.turn)||
    state.turn<0||state.turn>=30||state.maxTurns!==30||
    !Array.isArray(state.playerParty)||!Array.isArray(state.log)||
    !Array.isArray(state.frames)||state.log.length!==state.frames.length)
    return null;
 const engine=state.turn===0&&!state.engine?
    initialize(snapshot):state.engine;
 if(!engine||!verify(snapshot,state,engine))return null;
 return {state,engine};
}
/** Uses EXACTLY Gym legality, including forced switch, quota and focus. */
export function legalFrozenSquadActions(snapshot:unknown,current:unknown):
 readonly SquadHumanAction[]|null{
 const actors=actorAndEngine(snapshot,current);
 if(!actors)return null;
 return gymLegalTurnActions(actors.engine,'player').map(action=>action);
}
/** One submitted command + fair wild AI. A forced replacement spends no SP,
 * heals no HP and grants the enemy no attack. It counts as a receipt action,
 * while voluntary switches count toward the Gym limit of three.
 */
export function resolveFrozenSquadTurn(
 snapshot:unknown,current:unknown,action:unknown,serverSeed:number
):null|{status:'blocked';reason:string}|{
 status:'applied';turnState:SquadTurnState;playerAction:SquadHumanAction;
 wildAction:GymTurnAction;logDelta:readonly string[];
 framesDelta:readonly KantoBattleVisualFrame[];
 nextActions:readonly SquadHumanAction[];
}{
 if(!Number.isSafeInteger(serverSeed)||serverSeed<0||
    serverSeed>0xffffffff)return null;
 const context=actorAndEngine(snapshot,current);
 if(!context)return null;
 const {state,engine}=context;
 const legal=gymLegalTurnActions(engine,'player');
 if(!valid(action)||!legal.some(a=>sameAction(a,action)))
   return {status:'blocked',reason:'illegal-action'};
 const enemy=gymChooseAiAction(engine,'leader');
 const applied=resolveGymAiTurn(engine,action,serverSeed);
 if(applied.status!=='applied')
   return {status:'blocked',reason:'turn-blocked'};
 const ordinal=state.turn+1;
 // The Gym engine counts combat rounds, not the free forced switch action.
 // Count this account receipt as one of the 30 online actions, too.
 const nextEngine=applied.state.turn===state.turn?
   {...applied.state,turn:ordinal}:applied.state;
 const outcome=nextEngine.outcome==='player-win'?'win':
   nextEngine.outcome==='leader-win'?'loss':
     nextEngine.outcome==='draw'||ordinal>=30?'draw':null;
 const complete=outcome!==null;
 const finalEngine=complete&&nextEngine.outcome==='ongoing'
   ?{...nextEngine,outcome:'draw' as const}:nextEngine;
 const side=finalEngine.player;
 const p=side.fighters[side.activeIndex]!;
 const w=finalEngine.leader.fighters[0]!;
 const playerParty=side.fighters.slice(0,
   (snapshot as {party:readonly unknown[]}).party.length).map(summary);
 const logDelta=applied.log.map((line,i)=>{
   const frameState=applied.snapshots[i]??finalEngine;
   const actor=frameState.player.fighters[frameState.player.activeIndex]!
     .combatant.name;
   return line.replace(/^player\b/,
     line.startsWith('player trocou')||
     line.startsWith('player substituiu')?'Treinador':actor)
     .replace(/^leader\b/,frameState.leader.fighters[0]!.combatant.name);
 });
 const turnState:SquadTurnState={
   ...state,phase:complete?'resolved':'await-player',turn:ordinal,
   player:summary(p),wild:wildSummary(w),playerParty,
   engine:finalEngine,...(outcome?{outcome}:{}),
   log:[...state.log,...logDelta],
   frames:[...state.frames,...applied.frames]
 };
 const nextActions=complete?[]:legalFrozenSquadActions(snapshot,turnState)??[];
 return {status:'applied',turnState,playerAction:action,wildAction:enemy,
   logDelta,framesDelta:applied.frames,nextActions};
}
