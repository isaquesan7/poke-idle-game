/** ONLINE-01C-19: adapt the existing Kanto Gym per-turn resolver to a
 * server-only SINGLE wild opponent. No parallel battle math or free drops.
 *
 * A 1v1 uses the Gym engine's identical status/priority/damage/SP/Focus/AI
 * rules with TWO KNOCKED-OUT SENTINEL BENCH SLOTS per side. This disables
 * party switching until 4-slot/squad snapshots are fully implemented.
 * No outcome can be rewarded or captured through this adapter yet.
 */
import {canonicalFrozenCombatants} from './serverFrozenBattle.js';
import {createFrozenWildTurnSession} from './serverWildTurnSession.js';
import {createGymBattleState} from '../gyms/gymBattleState.js';
import {gymLegalTurnActions} from '../gyms/gymTurn.js';
import {resolveGymAiTurn,gymChooseAiAction} from '../gyms/gymAiTurn.js';
import type {GymBattleState,GymFighterState,GymSideState} from '../gyms/gymBattleState.js';
import type {GymTurnAction} from '../gyms/gymTurn.js';
import type {Combatant,KantoBattleVisualFrame} from './kantoBattle.js';
import type {KantoBattleStatus} from './kantoStatusEffects.js';

type FrozenState=NonNullable<ReturnType<typeof createFrozenWildTurnSession>>;
export type WildTurnPlayerAction=
  | {readonly kind:'basic'}
  | {readonly kind:'focus'}
  | {readonly kind:'move';readonly moveName:string};

type Persisted=Omit<FrozenState,'player'|'wild'|'log'|'frames'>&{
  readonly player:Omit<FrozenState['player'],'status'>&{
    readonly status:KantoBattleStatus|null};
  readonly wild:Omit<FrozenState['wild'],'status'>&{
    readonly status:KantoBattleStatus|null};
  readonly log:readonly string[];
  readonly frames:readonly KantoBattleVisualFrame[];
  readonly engine?:GymBattleState;
  readonly outcome?:'win'|'loss'|'draw';
};
const uint32=(n:unknown):n is number=>Number.isSafeInteger(n)&&
  typeof n==='number'&&n>=0&&n<=0xffffffff;
const movesEqual=(a:Combatant,b:Combatant)=>a.speciesId===b.speciesId&&
  a.level===b.level&&a.name===b.name&&a.rank===b.rank&&
  a.types.join(',')===b.types.join(',')&&
  (Object.keys(a.stats) as (keyof typeof a.stats)[])
    .every(k=>a.stats[k]===b.stats[k])&&
  (a.moves??[a.move]).length===(b.moves??[b.move]).length&&
  (a.moves??[a.move]).every((m,i)=>{
    const n=(b.moves??[b.move])[i];
    return !!n&&m.name===n.name&&m.type===n.type&&
      m.category===n.category&&m.power===n.power&&
      m.accuracy===n.accuracy&&m.priority===n.priority;
  });
const sentinel=(side:GymSideState):GymSideState=>({
  ...side,
  fighters:[
    side.fighters[0],
    {...side.fighters[1],hp:0},
    {...side.fighters[2],hp:0}
  ]
});
function initializeEngine(snapshot:unknown):GymBattleState|null{
  const pair=canonicalFrozenCombatants(snapshot);
  if(!pair)return null;
  const uid=(snapshot as {activePokemon:{uid:number}}).activePokemon.uid;
  const initial=createGymBattleState([
    {uid,combatant:pair.player},
    {uid:Number.MAX_SAFE_INTEGER-1,combatant:pair.player},
    {uid:Number.MAX_SAFE_INTEGER,combatant:pair.player}
  ],[pair.wild,pair.wild,pair.wild]);
  return {...initial,player:sentinel(initial.player),
    leader:sentinel(initial.leader)};
}
function verifyEngine(engine:GymBattleState,turn:number,snapshot:unknown):boolean{
  const actors=canonicalFrozenCombatants(snapshot);
  if(!actors||!engine||engine.outcome!=='ongoing'||engine.turn!==turn||
    !engine.player||!engine.leader)return false;
  for(const side of ['player','leader'] as const){
    const party=engine[side],base=side==='player'?actors.player:actors.wild;
    if(party.activeIndex!==0||party.voluntarySwitchesUsed!==0||
      party.needsReplacement||party.fighters.length!==3)return false;
    const actor=party.fighters[0];
    if(!actor||!movesEqual(actor.combatant,base)||actor.hp<1||
       actor.hp>base.stats.hp||!Number.isSafeInteger(actor.hp)||
       !Number.isSafeInteger(actor.sp)||actor.sp<0||actor.sp>actor.maxSp)
      return false;
    if(party.fighters[1]?.hp!==0||party.fighters[2]?.hp!==0)return false;
  }
  return engine.player.fighters[0]?.uid===
    (snapshot as {activePokemon:{uid:number}}).activePokemon.uid;
}
function validAction(action:unknown):action is WildTurnPlayerAction{
  if(!action||typeof action!=='object'||Array.isArray(action))return false;
  const a=action as Record<string,unknown>,keys=Object.keys(a);
  return (a.kind==='basic'||a.kind==='focus')&&keys.length===1||
    a.kind==='move'&&keys.length===2&&
      typeof a.moveName==='string'&&/^[a-z][a-z-]{1,63}$/.test(a.moveName);
}
const equalActions=(a:GymTurnAction,b:WildTurnPlayerAction)=>
  a.kind===b.kind&&(a.kind!=='move'||
    (b.kind==='move'&&a.moveName===b.moveName));
/** The same legal-action function used by the Gym AI and human UI. */
export function legalFrozenWildTurnActions(
  snapshot:unknown,current:unknown
):readonly WildTurnPlayerAction[]|null{
  if(!current||typeof current!=='object'||Array.isArray(current))
    return null;
  const state=current as Persisted;
  const initial=createFrozenWildTurnSession(snapshot);
  if(!initial||state.mode!=='turns'||state.version!==1||
     state.regionId!==initial.regionId||state.phase!=='await-player'||
     !Number.isSafeInteger(state.turn)||state.turn<0||
     state.turn>=state.maxTurns||state.maxTurns!==30||
     !Array.isArray(state.log)||!Array.isArray(state.frames)||
     state.log.length!==state.frames.length||
     state.player?.uid!==initial.player.uid||
     state.player?.speciesId!==initial.player.speciesId||
     state.wild?.speciesId!==initial.wild.speciesId||
     state.player?.maxHp!==initial.player.maxHp||
     state.wild?.maxHp!==initial.wild.maxHp||
     state.player?.maxSp!==initial.player.maxSp||
     state.wild?.maxSp!==initial.wild.maxSp||
     state.player?.equippedMoves?.join(',')!==
       initial.player.equippedMoves.join(',')||
     state.wild?.equippedMoves?.join(',')!==
       initial.wild.equippedMoves.join(','))
    return null;
  const engine=state.turn===0&&!state.engine?
    initializeEngine(snapshot):state.engine;
  if(!engine||!verifyEngine(engine,state.turn,snapshot)|| 
     engine.player.fighters[0]!.hp!==state.player.hp||
     engine.leader.fighters[0]!.hp!==state.wild.hp||
     engine.player.fighters[0]!.sp!==state.player.sp||
     engine.leader.fighters[0]!.sp!==state.wild.sp)
    return null;
  return gymLegalTurnActions(engine,'player').flatMap<WildTurnPlayerAction>(a=>
    a.kind==='move'?[{kind:'move',moveName:a.moveName}]
      :a.kind==='basic'?[{kind:'basic'}]
      :a.kind==='focus'?[{kind:'focus'}]:[]);
}

/** Exactly one human action and one fair wild AI decision per round.
 * The server supplies a private per-encounter, per-turn HMAC uint32 seed;
 * it is NEVER stored/exposed. DB writer persists the complete returned
 * turn-state and audit receipt in the same transaction.
 */
export function resolveFrozenWildTurn(
  snapshot:unknown,current:unknown,action:unknown,serverSeed:number
):null|{readonly status:'blocked';readonly reason:string}|
 {readonly status:'applied';readonly turnState:Persisted;
  readonly playerAction:WildTurnPlayerAction;
  readonly wildAction:GymTurnAction;readonly logDelta:readonly string[];
  readonly framesDelta:readonly KantoBattleVisualFrame[];
  readonly nextActions:readonly WildTurnPlayerAction[]}{
  if(!uint32(serverSeed))return null;
  const legal=legalFrozenWildTurnActions(snapshot,current);
  if(!legal)return null;
  if(!validAction(action)||!legal.some(a=>equalActions(a,action)))
    return {status:'blocked',reason:'illegal-action'};
  const state=current as Persisted;
  const engine=state.engine??initializeEngine(snapshot);
  if(!engine)return null;
  const enemy=gymChooseAiAction(engine,'leader');
  const applied=resolveGymAiTurn(engine,action,serverSeed);
  if(applied.status!=='applied')
    return {status:'blocked',reason:'turn-blocked'};
  const next=applied.state;
  const outcome=next.outcome==='player-win'?'win':
    next.outcome==='leader-win'?'loss':
      next.outcome==='draw'||next.turn>=30?'draw':null;
  const phase=outcome===null?'await-player':'resolved';
  const p=next.player.fighters[0]!,w=next.leader.fighters[0]!;
  const player=Object.freeze({...state.player,hp:p.hp,sp:p.sp,
    status:p.status,focusUses:p.focusUses,lastFocusTurn:p.lastFocusTurn});
  const wild=Object.freeze({...state.wild,hp:w.hp,sp:w.sp,
    status:w.status,focusUses:w.focusUses,lastFocusTurn:w.lastFocusTurn});
  const pair=canonicalFrozenCombatants(snapshot)!;
  // Human-readable Pokémon actors, not generic 'leader' / 'player'.
  const logDelta=applied.log.map(line=>
    line.replace(/^player\b/,pair.player.name)
      .replace(/^leader\b/,pair.wild.name));
  const turnState:Persisted={
    ...state,phase,turn:next.turn,player,wild,
    engine:{...next,...(outcome==='draw'&&next.outcome==='ongoing'
      ?{outcome:'draw' as const}:{})},
    ...(outcome?{outcome}:{}),
    log:[...state.log,...logDelta],
    frames:[...state.frames,...applied.frames]
  };
  const nextActions=phase==='await-player'?
    legalFrozenWildTurnActions(snapshot,turnState)??[]:[];
  return {status:'applied',turnState,playerAction:action,wildAction:enemy,
    logDelta,framesDelta:applied.frames,nextActions};
}
