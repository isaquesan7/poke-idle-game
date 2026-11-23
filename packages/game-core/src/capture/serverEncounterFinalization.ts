/** ONLINE-01C-16: pure end-of-encounter transition for the private API.
 *
 * One CHOICE for a paid and sealed encounter: 'skip' or one legal ball.
 * A failed throw still spends exactly one ball and ends this encounter.
 * The caller supplies only a SERVER-DERIVED uint32; browser cannot choose
 * species, stats, result, seed, move or newly-created UID.
 */
import {canonicalFrozenCombatants} from '../combat/serverFrozenBattle.js';
import {resolveKantoCaptureAttempt} from './regionalCaptureAttempt.js';
import {inspectKantoBallPocket} from './kantoBallPocket.js';
import {kantoCaptureStartingLevel} from '../catalog/kantoEvolution.js';
import {KANTO_BATTLE_SPECIES} from '../combat/kantoBattle.js';
import {kantoWildMoveLoadout} from '../catalog/kantoWildMoves.js';

export type ServerFinalChoice='skip'|'poke-ball'|'great-ball'|'ultra-ball';
export type ServerCaptureFinish={
  readonly raw:string;
  readonly result:{
    readonly outcome:'skipped'|'failed'|'captured';
    readonly ballId:null|'poke-ball'|'great-ball'|'ultra-ball';
    readonly speciesId:number;
    readonly caughtUid:number|null;
  };
};

const validInt=(n:unknown,min=0,max=Number.MAX_SAFE_INTEGER):n is number=>
  typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
const zeroStats=()=>({
  hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0
});
export function finalizeFrozenWildEncounter(
  raw:string,snapshot:unknown,preview:unknown,choice:ServerFinalChoice,
  captureSeed:number,serverNowMs:number
):ServerCaptureFinish|null{
  if(typeof raw!=='string'||!['skip','poke-ball','great-ball','ultra-ball'].includes(choice)||
    !validInt(captureSeed,0,0xffffffff)||!validInt(serverNowMs))
    return null;
  const pair=canonicalFrozenCombatants(snapshot);
  if(!pair||!preview||typeof preview!=='object'||Array.isArray(preview))
    return null;
  const result=preview as Record<string,unknown>;
  if(typeof result.outcome!=='string'||
    !['win','loss','draw'].includes(result.outcome)||
    !validInt(result.wildRemainingHp,0,pair.wild.stats.hp)||
    (result.outcome==='win'&&result.wildRemainingHp!==0)||
    !Array.isArray(result.log)||!Array.isArray(result.frames)||
    result.log.length!==result.frames.length)
    return null;
  let state:Record<string,unknown>;
  try{state=JSON.parse(raw);}catch{return null;}
  if(!state||typeof state!=='object'||Array.isArray(state)||
    state.version!==1||state.mode!=='normal'||
    !Array.isArray(state.roster)||!Array.isArray(state.team)||
    !Array.isArray(state.seen)||!Array.isArray(state.caughtSpecies)||
    !validInt(state.nextUid,1)||!state.ballPocket||
    !state.roster.every((p:unknown)=>p&&typeof p==='object'&&!Array.isArray(p)&&
      validInt((p as Record<string,unknown>).uid,1))||
    state.team[0]!==(snapshot as {activePokemon:{uid:number}}).activePokemon.uid)
    return null;
  const roster=state.roster as Record<string,unknown>[];
  const active=(snapshot as {activePokemon:{uid:number;speciesId:number}}).activePokemon;
  if(new Set(roster.map(p=>p.uid)).size!==roster.length||
    !roster.some(p=>p.uid===active.uid&&p.pokemonId===active.speciesId)||
    roster.some(p=>Number(p.uid)>=Number(state.nextUid)))
    return null;
  const bag=inspectKantoBallPocket(state.ballPocket);
  if(bag.status!=='valid')return null;
  const speciesId=pair.wild.speciesId;
  // Explicit skip is allowed after any outcome, and never spends a ball.
  if(choice==='skip')return {
    raw:JSON.stringify(state),
    result:{outcome:'skipped',ballId:null,speciesId,caughtUid:null}
  };
  // Capture only after a legitimate Kanto regional victory with a KO.
  if(result.outcome!=='win')return null;
  const capture=resolveKantoCaptureAttempt({
    regionId:1,speciesId,ballId:choice,
    pocket:bag.pocket,
    maxHp:pair.wild.stats.hp,currentHp:0,seed:captureSeed
  });
  if(capture.status!=='resolved')return null;
  state.ballPocket=capture.pocket;
  let caughtUid:number|null=null;
  if(capture.captured){
    if(!validInt(state.nextUid,1,Number.MAX_SAFE_INTEGER-1))return null;
    const level=kantoCaptureStartingLevel(speciesId);
    const species=KANTO_BATTLE_SPECIES[speciesId];
    if(!species)return null;
    const moves=kantoWildMoveLoadout(speciesId,level,species.move);
    caughtUid=state.nextUid as number;
    const owned={
      uid:caughtUid,pokemonId:speciesId,level,xp:0,manual:zeroStats(),
      affinity:0,moveName:moves[0]!.name,upgrades:{},
      battleRecord:{wins:0,draws:0,losses:0},
      affinityLastUsedAt:serverNowMs,affinityIdleDaysApplied:0
    };
    state.roster=[...roster,owned];
    state.nextUid=caughtUid+1;
    if(!state.caughtSpecies.includes(speciesId))
      state.caughtSpecies=[...state.caughtSpecies,speciesId];
    if(!state.seen.includes(speciesId))
      state.seen=[...state.seen,speciesId];
  }
  return {raw:JSON.stringify(state),result:{
    outcome:capture.captured?'captured':'failed',
    ballId:choice,speciesId,caughtUid
  }};
}
