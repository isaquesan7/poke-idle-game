/**
 * Suportes de nível FireRed/LeafGreen (recorte, não learnset integral).
 * PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a:
 * moves.csv e pokemon_moves.csv, version_group_id=7.
 * Conferidos em pokemondb.net/pokedex/{bulbasaur,charmander,squirtle,pikachu}/moves/3
 */
import type {KantoMove} from '../combat/kantoBattle.js';
export const KANTO_SUPPORT_SOURCE_COMMIT='ac2f1acb055026e3dff1e0aca743bb46256a810a';
export type KantoSupportEffect =
  | {readonly kind:'status';readonly status:'poison'|'paralysis'}
  | {readonly kind:'lower-attack'|'lower-defense';readonly stages:1};
export const KANTO_SUPPORT_MOVES:Readonly<Record<string,KantoMove>>={
  growl:{name:'growl',type:'normal',category:'status',power:0,accuracy:100,priority:0},
  'tail-whip':{name:'tail-whip',type:'normal',category:'status',power:0,accuracy:100,priority:0},
  'thunder-wave':{name:'thunder-wave',type:'electric',category:'status',power:0,accuracy:90,priority:0},
  'poison-powder':{name:'poison-powder',type:'poison',category:'status',power:0,accuracy:75,priority:0}
};
export const KANTO_SUPPORT_EFFECTS:Readonly<Record<string,KantoSupportEffect>>={
  growl:{kind:'lower-attack',stages:1},
  'tail-whip':{kind:'lower-defense',stages:1},
  'thunder-wave':{kind:'status',status:'paralysis'},
  'poison-powder':{kind:'status',status:'poison'}
};
const LEARNS:Readonly<Record<number,readonly (readonly [number,string])[]>>={
  1:[[4,'growl'],[15,'poison-powder']],
  4:[[1,'growl']],
  7:[[4,'tail-whip']],
  25:[[1,'growl'],[6,'tail-whip'],[8,'thunder-wave']]
};
export interface KantoSupportLearned {readonly move:KantoMove;readonly learnedAt:number}
export function kantoSupportMoves(speciesId:number,level:number):readonly KantoSupportLearned[]{
  if(!Number.isSafeInteger(speciesId)||speciesId<1||speciesId>151
    ||!Number.isSafeInteger(level)||level<1||level>100)return[];
  return (LEARNS[speciesId]??[]).filter(([at])=>at<=level)
    .map(([at,name])=>({learnedAt:at,move:KANTO_SUPPORT_MOVES[name]!}));
}
export function kantoSupportEffect(name:string):KantoSupportEffect|null {
  return KANTO_SUPPORT_EFFECTS[name]??null;
}
