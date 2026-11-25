/** Read-only D061 online encyclopedia from the authoritative account journal.
 * Species identities and detail records are disclosed only after discovery.
 * No request can write discovery state or supply a claimed captured species.
 */
import {KANTO_POKEDEX,kantoDexStatus,kantoSpecies} from '../catalog/kantoSpecies.js';
import {kantoLevelMoves} from '../catalog/kantoLevelMoves.js';
import {kantoSupportMoves} from '../catalog/kantoSupportMoves.js';
import {kantoTypeMultiplier} from './kantoBattle.js';
import {KANTO_EVOLUTION_RULES} from '../catalog/kantoEvolution.js';
import {prepareRewardJournal} from '../legacy/rewardEvents.js';
const TYPES=['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'] as const;
const isId=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=1&&v<=151;
export function onlinePokedexProjection(raw:string){
 if(typeof raw!=='string'||!prepareRewardJournal(raw))return null;
 const state=JSON.parse(raw);
 if(state.mode!=='normal'||!Array.isArray(state.seen)||!state.seen.every(isId)||
    !Array.isArray(state.caughtSpecies)||!state.caughtSpecies.every(isId)||
    !state.roster.every((p:{pokemonId:unknown})=>isId(p.pokemonId)))return null;
 const caught=new Set<number>([...state.caughtSpecies,...state.roster.map((p:{pokemonId:number})=>p.pokemonId)]);
 const seen=new Set<number>([...state.seen,...caught]);
 const entries=KANTO_POKEDEX.map(species=>{
  const status=kantoDexStatus(species.id,seen,caught);
  return status==='unknown'?{id:species.id,status}:{id:species.id,status,name:species.name,types:species.types};
 });
 return {total:151,caught:caught.size,seen:seen.size-caught.size,unknown:151-seen.size,entries};
}
export function onlinePokedexDetail(raw:string,id:number){
 if(!isId(id))return null;
 const dex=onlinePokedexProjection(raw),species=kantoSpecies(id);
 if(!dex||!species)return null;
 const record=dex.entries[id-1];
 if(!record||record.status==='unknown')return null;
 const reveal=(other:number)=>dex.entries[other-1]?.status!=='unknown'&&kantoSpecies(other)?{id:other,name:kantoSpecies(other)!.name}:null;
 const defensive=TYPES.map(type=>({type,multiplier:kantoTypeMultiplier(type,species.types)}));
 const moves=[...kantoLevelMoves(id,100),...kantoSupportMoves(id,100)]
  .sort((a,b)=>a.learnedAt-b.learnedAt||a.move.name.localeCompare(b.move.name));
 const evolution=KANTO_EVOLUTION_RULES.filter(rule=>rule.from===id).map(rule=>({
  target:reveal(rule.to),trigger:rule.trigger,
  ...(rule.trigger==='level'?{minLevel:rule.minLevel}:rule.trigger==='stone'?{stone:rule.stone}:{})
 }));
 return {id,name:species.name,status:record.status,types:species.types,base:species.base,
  legendary:species.legendary,mythical:species.mythical,
  from:species.evolvesFrom===null?null:reveal(species.evolvesFrom),
  hasPreEvolution:species.evolvesFrom!==null&&isId(species.evolvesFrom),
  evolution,matchups:{
   strong:TYPES.filter(type=>species.types.some(attack=>kantoTypeMultiplier(attack,[type])>1)),
   weak:defensive.filter(x=>x.multiplier>1),resist:defensive.filter(x=>x.multiplier>0&&x.multiplier<1),
   immune:defensive.filter(x=>x.multiplier===0)
  },moves:moves.map(({learnedAt,move})=>({learnedAt,name:move.name,type:move.type,category:move.category,power:move.power,accuracy:move.accuracy}))};
}
