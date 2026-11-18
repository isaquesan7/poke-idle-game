/**
 * Suportes de nível FireRed/LeafGreen (recorte, não learnset integral).
 * PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a:
 * moves.csv e pokemon_moves.csv, version_group_id=7.
 * Conferidos em pokemondb.net/pokedex/{bulbasaur,charmander,squirtle,pikachu}/moves/3\n * D-045 Recover: https://pokemondb.net/pokedex/staryu/moves/3\n * (Staryu nv15) e https://pokemondb.net/pokedex/starmie/moves/3\n * (Starmie nv1). É cura própria de 50% de HP, NÃO golpe contra Ghost.
 */
import type {KantoMove} from '../combat/kantoBattle.js';
export const KANTO_SUPPORT_SOURCE_COMMIT='ac2f1acb055026e3dff1e0aca743bb46256a810a';
export type KantoSupportEffect =
  | {readonly kind:'status';readonly status:'poison'|'paralysis'}
  | {readonly kind:'lower-attack'|'lower-defense';readonly stages:1}\n  | {readonly kind:'heal';readonly healing:50};
export const KANTO_SUPPORT_MOVES:Readonly<Record<string,KantoMove>>={
  growl:{name:'growl',type:'normal',category:'status',power:0,accuracy:100,priority:0},
  'tail-whip':{name:'tail-whip',type:'normal',category:'status',power:0,accuracy:100,priority:0},
  'thunder-wave':{name:'thunder-wave',type:'electric',category:'status',power:0,accuracy:90,priority:0},
  'poison-powder':{name:'poison-powder',type:'poison',category:'status',power:0,accuracy:75,priority:0},\n  // D-045: power:null/accuracy:null normalizados para 0/100; alvo é o próprio usuário.\n  recover:{name:'recover',type:'normal',category:'status',power:0,accuracy:100,priority:0}
};
export const KANTO_SUPPORT_EFFECTS:Readonly<Record<string,KantoSupportEffect>>={
  growl:{kind:'lower-attack',stages:1},
  'tail-whip':{kind:'lower-defense',stages:1},
  'thunder-wave':{kind:'status',status:'paralysis'},
  'poison-powder':{kind:'status',status:'poison'},\n  recover:{kind:'heal',healing:50}
};
const LEARNS:Readonly<Record<number,readonly (readonly [number,string])[]>>={
  1:[[4,'growl'],[15,'poison-powder']],
  4:[[1,'growl']],
  7:[[4,'tail-whip']],
  25:[[1,'growl'],[6,'tail-whip'],[8,'thunder-wave']],\n  // Recover FRLG: Staryu nível 15, Starmie nível 1 (forma por pedra).\n  120:[[15,'recover']],121:[[1,'recover']]
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
