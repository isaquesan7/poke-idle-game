/** ONLINE-01C-15: PURE candidate payout, no DB access and no capture.
 * Revalidate the persisted quote against every possible canonical affinity
 * roll; the caller must obtain snapshot/preview/quote from locked DB rows.
 */
import {masteryBonusFromPoints,masteryBonusFromSave} from '../progression/kantoMastery.js';
import {grantXp} from '../progression/xp.js';
import {quoteFrozenBattleRewards} from './serverBattleRewards.js';
import {KANTO_REGION_WINS_CAP,d064BattleBallDropRates} from '../capture/draftBallSupply.js';
import {inspectKantoBallPocket} from '../capture/kantoBallPocket.js';

const natural=(n:unknown):n is number=>
  typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const stats=['hp','attack','defense','specialAttack','specialDefense','speed'];
const count=(x:Record<string,unknown>,name:string)=>natural(x[name])?x[name] as number:null;

export function applyFrozenBattleRewardQuote(raw:string,snapshot:unknown,preview:unknown,quote:unknown):
  {readonly raw:string;readonly paid:unknown}|null{
  if(typeof raw!=='string'||!quote||typeof quote!=='object'||Array.isArray(quote)
    ||!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return null;
  const input=quote as Record<string,unknown>;
  const regionId=(snapshot as {regionId?:number}).regionId;
  const rates=regionId===undefined?null:d064BattleBallDropRates(regionId);
  if(!rates)return null;
  // Verify the persisted HMAC quote against every LEGAL outcome of the public
  // regional drop policy, not against arbitrary client inventory claims.
  // A deterministic representative roll per nonempty bucket suffices.
  const pokeEnd=rates['poke-ball']*100;
  const greatEnd=pokeEnd+rates['great-ball']*100;
  const dropRolls=[
    9999,
    ...(rates['poke-ball']>0?[0]:[]),
    ...(rates['great-ball']>0?[pokeEnd]:[]),
    ...(rates['ultra-ball']>0?[greatEnd]:[])
  ];
  // Migration-free compatibility for quotes sealed before this release:
  // older quotes had no ballDropId and can be paid with ZERO ball drops.
  const legacy=!Object.hasOwn(input,'ballDropId');
  const legal=[0,1,2,3].flatMap(affinityRoll=>dropRolls.map(ballRoll=>{
    const q=quoteFrozenBattleRewards(snapshot,preview,affinityRoll,ballRoll);
    if(!q)return null;
    if(legacy){
      if(q.ballDropId!==null)return null;
      const {ballDropId:ignored,...prior}=q;
      return prior;
    }
    return q;
  })).filter(q=>q!==null);
  if(!legal.length)return null;
  // JSONB key ordering is not stable: compare complete sets and values.
  const keys=Object.keys(legal[0]!);
  if(Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k))
    ||!legal.some(candidate=>keys.every(k=>
      Object.is(input[k],(candidate as Record<string,unknown>)[k]))))
    return null;
  const s=snapshot as {masteryPoints?:unknown;trainer:{level:number};activePokemon:{
    uid:number;speciesId:number;level:number;affinity:number}};
  let state:Record<string,unknown>;
  try{state=JSON.parse(raw);}catch{return null;}
  if(!state||typeof state!=='object'||Array.isArray(state)||state.version!==1
    ||state.mode!=='normal'||!state.trainer||
    typeof state.trainer!=='object'||Array.isArray(state.trainer)||
    !Array.isArray(state.roster)||!Array.isArray(state.team)||
    state.team[0]!==s.activePokemon.uid||
    !natural(state.coins)||!natural(state.wins)||!natural(state.losses)||
    !Array.isArray(state.regionWins)||state.regionWins.length!==10||
    !state.regionWins.every(n=>natural(n)&&n<=KANTO_REGION_WINS_CAP))
    return null;
  const trainer=state.trainer as Record<string,unknown>;
  const roster=state.roster as Record<string,unknown>[];
  const pokemon=roster.find(p=>p?.uid===s.activePokemon.uid);
  if(!pokemon||pokemon.pokemonId!==s.activePokemon.speciesId||
    pokemon.level!==s.activePokemon.level||pokemon.affinity!==s.activePokemon.affinity||
    trainer.level!==s.trainer.level||
    !natural(trainer.level)||!natural(trainer.xp)||!natural(pokemon.xp)||
    !natural(pokemon.affinity)||!natural(pokemon.level)||
    pokemon.affinity>100||
    !pokemon.manual||typeof pokemon.manual!=='object'||
    !stats.every(k=>natural((pokemon.manual as Record<string,unknown>)[k])))
    return null;
  const frozenMastery=masteryBonusFromPoints(s.masteryPoints,s.activePokemon.speciesId);
  const currentMastery=masteryBonusFromSave(state.research,s.activePokemon.speciesId);
  if(!frozenMastery||!currentMastery||frozenMastery.rank!==currentMastery.rank)return null;
  const history=pokemon.battleRecord;
  if(!history||typeof history!=='object'||Array.isArray(history))return null;
  const record=history as Record<string,unknown>;
  if(!['wins','draws','losses'].every(k=>natural(record[k])))return null;
  const counts=['wins','losses','draws'] as const;
  for(const name of counts){
    const base=count(state,name)??(name==='draws'&&state.draws===undefined?0:null);
    const delta=input[name];
    if(base===null||!natural(delta)||delta>1||
       !Number.isSafeInteger(base+delta))return null;
    state[name]=base+delta;
  }
  const coins=input.coins,trainerXp=input.trainerXp,pokemonXp=input.pokemonXp;
  const affinityDelta=input.affinityDelta;
  if(!natural(coins)||!natural(trainerXp)||!natural(pokemonXp)||
     !Number.isSafeInteger(affinityDelta)||
     !Number.isSafeInteger((state.coins as number)+coins)||
     !Number.isSafeInteger((trainer.xp as number)+trainerXp)||
     !Number.isSafeInteger((pokemon.xp as number)+pokemonXp))
    return null;
  const affinityNext=(pokemon.affinity as number)+(affinityDelta as number);
  if(!Number.isSafeInteger(affinityNext)||affinityNext<0||affinityNext>100)
    return null;
  const regionIndex=(input.regionId as number)-1;
  if(!Number.isInteger(regionIndex)||regionIndex<0||regionIndex>=10)return null;
  const regionWins=state.regionWins as number[];
  const oldWins=regionWins[regionIndex]??0;
  regionWins[regionIndex]=Math.min(KANTO_REGION_WINS_CAP,
    oldWins+(input.wins as number));

  // One optional ball is credited in the SAME transaction as XP/coins.
  // The regional counter saturates, but neither the counter nor overlevel blocks item farming.
  const bag=inspectKantoBallPocket(state.ballPocket);
  if(bag.status!=='valid')return null;
  const rolledId=legacy?null:input.ballDropId;
  if(rolledId!==null&&rolledId!=='poke-ball'&&rolledId!=='great-ball'&&
    rolledId!=='ultra-ball')return null;
  if(rolledId!==null&&input.outcome!=='win')return null;
  let ballDrop:null|{ballId:'poke-ball'|'great-ball'|'ultra-ball';quantity:number}=null;
  if(rolledId!==null){
    const old=bag.pocket.quantities[rolledId]??0;
    const quantity=Math.min(100000,old+1)-old; // Pocket max from validator.
    state.ballPocket={version:1,quantities:{
      ...bag.pocket.quantities,[rolledId]:old+quantity
    }};
    ballDrop={ballId:rolledId,quantity};
  }
  state.coins=(state.coins as number)+coins;
  const t=grantXp('trainer',{level:trainer.level as number,xp:trainer.xp as number},trainerXp);
  const p=grantXp('pokemon',{level:pokemon.level as number,xp:pokemon.xp as number},pokemonXp);
  trainer.level=t.level;trainer.xp=t.xp;
  pokemon.level=p.level;pokemon.xp=p.xp;pokemon.affinity=affinityNext;
  const increment=input.battleRecordIncrement;
  if(increment!==null){
    const name=increment==='win'?'wins':increment==='draw'?'draws':
      increment==='loss'?'losses':null;
    if(name===null||!natural(record[name])||
       !Number.isSafeInteger((record[name] as number)+1))return null;
    record[name]=(record[name] as number)+1;
  }
  // No captured Pokémon, badges, or release of encounter here.
  return {raw:JSON.stringify(state),paid:Object.freeze({
    coins,trainerXp,pokemonXp,affinityDelta,outcome:input.outcome,
    activeUid:input.activeUid,trainerLevel:t.level,pokemonLevel:p.level,
    ballDrop
  })};
}
