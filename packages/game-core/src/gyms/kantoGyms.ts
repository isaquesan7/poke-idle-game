/**
 * GYM-01: catálogo planejado dos oito Ginásios Kanto.
 *
 * Nenhuma função deste módulo concede insígnia, XP ou moeda. A lista é
 * estática/read-only até que o motor 3x3 e writer de vitória existam.
 * Espécies da PokeAPI #001-#151. Times e níveis são adaptação Poke Idle,
 * não elencos oficiais de FRLG (que têm 2-5 membros).
 */
import type {StatBonus} from '../stats/types.js';
import {kantoSpecies} from '../catalog/kantoSpecies.js';

export type KantoGymId =
  'boulder'|'cascade'|'thunder'|'rainbow'|'soul'|'marsh'|'volcano'|'earth';

export interface KantoGymPokemon {
  readonly speciesId:number;
  readonly level:number;
}
export interface KantoGymDefinition {
  readonly id:KantoGymId;
  readonly order:number;
  readonly leader:string;
  readonly trainerLevel:number;
  readonly city:string;
  readonly name:string;
  readonly type:string;
  readonly recommendedMinLevel:number;
  readonly recommendedMaxLevel:number;
  readonly team:readonly [KantoGymPokemon,KantoGymPokemon,KantoGymPokemon];
  readonly badgeStats:Readonly<StatBonus>;
  readonly trainerXp:number;
  readonly coins:number;
}

export const KANTO_GYMS:readonly KantoGymDefinition[]=[
  {id:'boulder',order:1,leader:'Brock',trainerLevel:12,city:'Pewter',name:'Rocha',type:'rock',
    recommendedMinLevel:12,recommendedMaxLevel:16,
    team:[{speciesId:74,level:12},{speciesId:27,level:13},{speciesId:95,level:15}],
    badgeStats:{defense:4,hp:2},trainerXp:120,coins:1500},
  {id:'cascade',order:2,leader:'Misty',trainerLevel:23,city:'Cerulean',name:'Cascata',type:'water',
    recommendedMinLevel:20,recommendedMaxLevel:25,
    team:[{speciesId:54,level:19},{speciesId:120,level:20},{speciesId:121,level:23}],
    badgeStats:{specialAttack:4,speed:2},trainerXp:240,coins:3000},
  {id:'thunder',order:3,leader:'Lt. Surge',trainerLevel:31,city:'Vermilion',name:'Trovão',type:'electric',
    recommendedMinLevel:28,recommendedMaxLevel:33,
    team:[{speciesId:100,level:27},{speciesId:25,level:28},{speciesId:26,level:31}],
    badgeStats:{speed:5,specialAttack:3},trainerXp:420,coins:5000},
  {id:'rainbow',order:4,leader:'Erika',trainerLevel:39,city:'Celadon',name:'Arco-Íris',type:'grass',
    recommendedMinLevel:36,recommendedMaxLevel:41,
    team:[{speciesId:114,level:35},{speciesId:71,level:37},{speciesId:45,level:39}],
    badgeStats:{specialDefense:5,hp:4},trainerXp:700,coins:8000},
  {id:'soul',order:5,leader:'Koga',trainerLevel:51,city:'Fuchsia',name:'Alma',type:'poison',
    recommendedMinLevel:47,recommendedMaxLevel:53,
    team:[{speciesId:109,level:46},{speciesId:89,level:48},{speciesId:110,level:51}],
    badgeStats:{defense:6,hp:4},trainerXp:1100,coins:13000},
  {id:'marsh',order:6,leader:'Sabrina',trainerLevel:61,city:'Saffron',name:'Pântano',type:'psychic',
    recommendedMinLevel:57,recommendedMaxLevel:63,
    team:[{speciesId:122,level:56},{speciesId:64,level:58},{speciesId:65,level:61}],
    badgeStats:{specialAttack:7,speed:5},trainerXp:1700,coins:22000},
  {id:'volcano',order:7,leader:'Blaine',trainerLevel:72,city:'Cinnabar',name:'Vulcão',type:'fire',
    recommendedMinLevel:68,recommendedMaxLevel:74,
    team:[{speciesId:77,level:67},{speciesId:78,level:69},{speciesId:59,level:72}],
    badgeStats:{attack:8,specialAttack:6},trainerXp:2500,coins:35000},
  {id:'earth',order:8,leader:'Giovanni',trainerLevel:84,city:'Viridian',name:'Terra',type:'ground',
    recommendedMinLevel:80,recommendedMaxLevel:86,
    team:[{speciesId:51,level:78},{speciesId:31,level:81},{speciesId:34,level:84}],
    badgeStats:{hp:10,attack:8,defense:8,specialDefense:8},
    trainerXp:4000,coins:60000}
];

/** Título planejado: bônus cumulativo de insígnias é independente deste título. */
export const KANTO_GYM_MASTER_TITLE_STATS:Readonly<StatBonus>={
  hp:12,attack:12,defense:12,specialAttack:12,specialDefense:12,speed:12
};

/** Próximo ginásio somente quando o anterior tiver sido vencido.
 * Dados desconhecidos, duplicados ou fora de ordem nunca habilitam avanço.
 * Retorna null ao conquistar os oito, ou se o histórico estiver inválido.
 */
export function kantoNextGym(defeated:readonly string[]):KantoGymDefinition|null{
  if(!Array.isArray(defeated)||defeated.length>KANTO_GYMS.length)return null;
  for(let i=0;i<defeated.length;i++){
    if(defeated[i]!==KANTO_GYMS[i]?.id)return null;
  }
  return KANTO_GYMS[defeated.length]??null;
}

/** Validação estrutural para falhar em testes se catálogo for alterado. */
export function kantoGymCatalogInvariant():boolean{
  if(KANTO_GYMS.length!==8)return false;
  const ids=new Set<string>();
  return KANTO_GYMS.every((gym,index)=>{
    if(ids.has(gym.id)||gym.order!==index+1||gym.team.length!==3
      ||!Number.isSafeInteger(gym.trainerLevel)||gym.trainerLevel<1||gym.trainerLevel>100
      ||gym.recommendedMinLevel<1||gym.recommendedMaxLevel>100
      ||gym.recommendedMinLevel>gym.recommendedMaxLevel
      ||!Number.isSafeInteger(gym.coins)||gym.coins<=0
      ||!Number.isSafeInteger(gym.trainerXp)||gym.trainerXp<=0)return false;
    ids.add(gym.id);
    const speciesIds=new Set<number>();
    return gym.team.every(p=>{
      const species=kantoSpecies(p.speciesId);
      if(!species||speciesIds.has(p.speciesId)
        ||p.level<1||p.level>100||!Number.isSafeInteger(p.level))return false;
      speciesIds.add(p.speciesId);
      return true;
    });
  });
}
