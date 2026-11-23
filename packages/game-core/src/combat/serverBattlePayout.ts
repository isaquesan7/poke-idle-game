/** ONLINE-01C-15: PURE candidate payout, no DB access and no capture.
 * Revalidate the persisted quote against every possible canonical affinity
 * roll; the caller must obtain snapshot/preview/quote from locked DB rows.
 */
import {grantXp} from '../progression/xp.js';
import {quoteFrozenBattleRewards} from './serverBattleRewards.js';
import {KANTO_REGION_WINS_CAP} from '../capture/draftBallSupply.js';

const natural=(n:unknown):n is number=>
  typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const stats=['hp','attack','defense','specialAttack','specialDefense','speed'];
const count=(x:Record<string,unknown>,name:string)=>natural(x[name])?x[name] as number:null;

export function applyFrozenBattleRewardQuote(raw:string,snapshot:unknown,preview:unknown,quote:unknown):
  {readonly raw:string;readonly paid:unknown}|null{
  if(typeof raw!=='string'||!quote||typeof quote!=='object'||Array.isArray(quote)
    ||!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return null;
  const input=quote as Record<string,unknown>;
  const legal=[0,1,2,3].map(roll=>quoteFrozenBattleRewards(snapshot,preview,roll))
    .filter(x=>x!==null);
  if(!legal.length)return null;
  // JSONB key ordering is not stable. Compare exact known keys, values and
  // count rather than JSON.stringify(object).
  const keys=Object.keys(legal[0]!);
  if(Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k))
    ||!legal.some(candidate=>keys.every(k=>
      Object.is(input[k],(candidate as unknown as Record<string,unknown>)[k]))))
    return null;
  const s=snapshot as {trainer:{level:number};activePokemon:{
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
  const affinityNext=(pokemon.affinity as number)+affinityDelta;
  if(!Number.isSafeInteger(affinityNext)||affinityNext<0||affinityNext>100)
    return null;
  const regionIndex=(input.regionId as number)-1;
  if(regionIndex!==0)return null; // only Bosque Inicial online presently
  const regionWins=state.regionWins as number[];
  regionWins[regionIndex]=Math.min(KANTO_REGION_WINS_CAP,
    regionWins[regionIndex]+(input.wins as number));
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
  // No ball drops, new Pokémon, badges or release of encounter.
  return {raw:JSON.stringify(state),paid:Object.freeze({
    coins,trainerXp,pokemonXp,affinityDelta,outcome:input.outcome,
    activeUid:input.activeUid,trainerLevel:t.level,pokemonLevel:p.level
  })};
}
