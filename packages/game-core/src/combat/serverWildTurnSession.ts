/** ONLINE-01C-18 — initial server-only, frozen wild battle TURN SESSION.
 *
 * An alternative to the existing whole-battle automatic preview. It stores
 * canonical combatant HP/SP and move slots, but DOES NOT resolve a turn or
 * grant rewards. Later turn actions must use an audited canonical resolver.
 *
 * The v1 snapshot carries one move; v2 freezes 1–4 explicitly equipped,
 * level-legal moves. Never auto-equip a Pokémon's whole learned catalog.
 * Wild AI uses the existing fair max-four-move FRLG loadout from game-core.
 */
import {canonicalFrozenCombatants} from './serverFrozenBattle.js';
import {kantoMaxSp,kantoMoveSpCost,KANTO_BASIC_ATTACK}
  from './kantoSkillEnergy.js';

const MAX_TURNS=30;
const moveSlots=(moves:readonly {name:string}[])=>moves.map(move=>move.name);
export function createFrozenWildTurnSession(snapshot:unknown){
  const actors=canonicalFrozenCombatants(snapshot);
  if(!actors)return null;
  const s=snapshot as {regionId:number;activePokemon:{uid:number}};
  const {player,wild}=actors;
  const playerMoves=player.moves??[player.move];
  const wildMoves=wild.moves??[wild.move];
  if(playerMoves.length<1||playerMoves.length>4||
     new Set(moveSlots(playerMoves)).size!==playerMoves.length||
     wildMoves.length<1||wildMoves.length>4||
     new Set(moveSlots(wildMoves)).size!==wildMoves.length)return null;
  const playerMaxSp=kantoMaxSp(player.level,player.speciesId);
  const wildMaxSp=kantoMaxSp(wild.level,wild.speciesId);
  return {
    version:1,mode:'turns',regionId:s.regionId,
    phase:'await-player',turn:0,maxTurns:MAX_TURNS,
    player:{
      uid:s.activePokemon.uid,speciesId:player.speciesId,
      ...(player.megaForm?{megaForm:player.megaForm}:{}),
      hp:player.stats.hp,maxHp:player.stats.hp,
      sp:playerMaxSp,maxSp:playerMaxSp,
      status:null,focusUses:0,lastFocusTurn:-100,
      // Frozen explicit equipment: legacy v1 one slot, v2 up to four.
      equippedMoves:moveSlots(playerMoves)
    },
    wild:{
      speciesId:wild.speciesId,
      hp:wild.stats.hp,maxHp:wild.stats.hp,
      sp:wildMaxSp,maxSp:wildMaxSp,
      status:null,focusUses:0,lastFocusTurn:-100,
      equippedMoves:moveSlots(wildMoves)
    },
    log:[],frames:[]
  };
}

/** Initial choices only. This is NOT a turn executor.
 * Always recompute move costs from canonical core instead of trusting a
 * client-provided move list or SP budget.
 */
export function initialFrozenWildTurnActions(snapshot:unknown){
  const actors=canonicalFrozenCombatants(snapshot);
  if(!actors)return null;
  const player=actors.player;
  const moves=player.moves??[player.move];
  if(moves.length<1||moves.length>4)return null;
  const sp=kantoMaxSp(player.level,player.speciesId);
  return Object.freeze([
    {kind:'basic',moveName:KANTO_BASIC_ATTACK.name,spCost:0},
    ...moves.filter(move=>kantoMoveSpCost(move)<=sp).map(move=>({
      kind:'move',moveName:move.name,spCost:kantoMoveSpCost(move)
    }))
    // Focus cannot be used at full SP; it is not a starting action.
  ]);
}
