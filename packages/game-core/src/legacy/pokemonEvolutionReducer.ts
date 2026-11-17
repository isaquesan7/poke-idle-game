/**
 * Evolução de uma instância da coleção sem recriar UID, XP ou treino.
 * Função pura sem localStorage/DOM; o writer v0.2 coordena revisão/gravação.
 * Pedras da alfa são apenas suprimento de teste; nenhuma economia final.
 */
import {
  KANTO_EVOLUTION_STONES, kantoEvolutionOptions
} from '../catalog/kantoEvolution.js';
import { kantoSpecies } from '../catalog/kantoSpecies.js';

type JsonRecord = Record<string,unknown>;
const record=(value:unknown):value is JsonRecord =>
  value!==null&&typeof value==='object'&&!Array.isArray(value);
const natural=(value:unknown):value is number =>
  typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const positive=(value:unknown):value is number=>natural(value)&&value>0;
const validSpecies=(value:unknown):value is number =>
  positive(value)&&value<=151;

export type KantoEvolutionAction =
  | {readonly type:'evolve';readonly uid:number;readonly targetSpeciesId:number}
  | {readonly type:'grant-test-kit'};
export type KantoEvolutionEditResult =
  | {readonly status:'ok';readonly json:string}
  | {readonly status:'invalid';readonly reason:string};

export function reduceKantoEvolutionJson(
  sourceJson:string,action:KantoEvolutionAction
):KantoEvolutionEditResult {
  let source:unknown;
  try{source=JSON.parse(sourceJson);}catch{return{status:'invalid',reason:'Save inválido.'};}
  if(!record(source)||source.version!==1||!Array.isArray(source.roster)
    ||source.roster.length===0||!Array.isArray(source.team)
    ||!Array.isArray(source.seen)||!source.seen.every(validSpecies)
    ||(source.caughtSpecies!==undefined
      &&(!Array.isArray(source.caughtSpecies)||!source.caughtSpecies.every(validSpecies)))
    ||(source.evolutionTestKitClaimed!==undefined
      &&typeof source.evolutionTestKitClaimed!=='boolean')){
    return{status:'invalid',reason:'Perfil Pokémon ou Pokédex inválido.'};
  }
  const uids=new Set<number>();
  for(const member of source.roster){
    if(!record(member)||!positive(member.uid)||uids.has(member.uid)
      ||!validSpecies(member.pokemonId)||!positive(member.level)||member.level>100
      ||!natural(member.affinity)||member.affinity>100){
      return{status:'invalid',reason:'Coleção Pokémon inválida.'};
    }
    uids.add(member.uid);
  }
  if(source.team.length===0||source.team.length>3||
    new Set(source.team).size!==source.team.length
    ||!source.team.every((uid:unknown)=>positive(uid)&&uids.has(uid))){
    return{status:'invalid',reason:'Equipe inválida.'};
  }
  if(source.evolutionStones!==undefined&&!record(source.evolutionStones))
    return{status:'invalid',reason:'Inventário de pedras inválido.'};
  const inventory=record(source.evolutionStones)?source.evolutionStones:{};
  const knownIds=KANTO_EVOLUTION_STONES.map(item=>item.id);
  for(const [id,amount] of Object.entries(inventory)){
    if(!knownIds.includes(id as typeof knownIds[number])||!natural(amount)){
      return{status:'invalid',reason:'Quantidade de pedras inválida.'};
    }
  }
  if(action.type==='grant-test-kit'){
    if(source.evolutionTestKitClaimed===true)
      return{status:'invalid',reason:'Kit de pedras de teste já resgatado.'};
    const next={...inventory};
    for(const stone of KANTO_EVOLUTION_STONES)next[stone.id]=(next[stone.id] as number??0)+1;
    source.evolutionStones=next;
    source.evolutionTestKitClaimed=true;
    return{status:'ok',json:JSON.stringify(source)};
  }
  if(action.type!=='evolve'||!positive(action.uid)||!validSpecies(action.targetSpeciesId))
    return{status:'invalid',reason:'Evolução ou UID inválido.'};
  if(source.expedition!=null)
    return{status:'invalid',reason:'Não é possível evoluir durante uma expedição ativa.'};
  const member=(source.roster as unknown[]).find(p=>record(p)&&p.uid===action.uid);
  if(!record(member))
    return{status:'invalid',reason:'Pokémon não encontrado pelo UID.'};
  const from=member.pokemonId as number;
  const rule=kantoEvolutionOptions(from).find(r=>r.to===action.targetSpeciesId);
  if(!rule||kantoSpecies(action.targetSpeciesId)?.evolvesFrom!==from)
    return{status:'invalid',reason:'Esta espécie não evolui para o destino solicitado.'};
  if(rule.trigger==='trade')
    return{status:'invalid',reason:'Evolução por troca não disponível na alfa.'};
  if(rule.trigger==='level'&&((member.level as number)<rule.minLevel))
    return{status:'invalid',reason:'O Pokémon ainda não atingiu o nível exigido.'};
  if(rule.trigger==='stone'){
    const available=inventory[rule.stone];
    if(!natural(available)||available<1)
      return{status:'invalid',reason:'Você não possui a pedra evolutiva necessária.'};
    source.evolutionStones={...inventory,[rule.stone]:available-1};
  }
  // Não alterar XP, level, manual, afinidade, golpe, upgrades, UID ou equipe.
  member.pokemonId=rule.to;
  source.seen=[...new Set([...source.seen,from,rule.to])];
  source.caughtSpecies=[...new Set([
    ...((source.caughtSpecies as number[]|undefined)??[]),
    ...(source.roster as JsonRecord[]).map(p=>p.pokemonId as number),
    from,rule.to
  ])];
  return{status:'ok',json:JSON.stringify(source)};
}
