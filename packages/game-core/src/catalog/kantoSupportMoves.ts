/**
 * Suportes de nível FireRed/LeafGreen (recorte, não learnset integral).
 * PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a:
 * moves.csv e pokemon_moves.csv, version_group_id=7.
 * Conferidos em pokemondb.net/pokedex/{bulbasaur,charmander,squirtle,pikachu}/moves/3
 * D-045 Recover: https://pokemondb.net/pokedex/staryu/moves/3
 * (Staryu nv15) e https://pokemondb.net/pokedex/starmie/moves/3
 * (Starmie nv1). É cura própria de 50% de HP, NÃO golpe contra Ghost.
 */
import type {KantoMove} from '../combat/kantoBattle.js';
import {KANTO_FRLG_MOVE_META,KANTO_FRLG_LEVELUP_ROWS} from './kantoFrlgLevelupSnapshot.js';
export const KANTO_SUPPORT_SOURCE_COMMIT='ac2f1acb055026e3dff1e0aca743bb46256a810a';
export type KantoSupportEffect =
  | {readonly kind:'status';readonly status:'poison'|'paralysis'}
  | {readonly kind:'lower-attack'|'lower-defense';readonly stages:1}
  | {readonly kind:'heal';readonly healing:50};
/** Somente efeitos já suportados pelo motor, filtrados no snapshot FRLG. */
const D064AQ_STATUS_NAMES=new Set(['leer','stun-spore','glare']);
const D064AQ_STATUS_MOVES:Readonly<Record<string,KantoMove>>=Object.fromEntries(
  Object.values(KANTO_FRLG_MOVE_META).filter(meta=>D064AQ_STATUS_NAMES.has(meta.name)
    &&meta.category==='status'&&meta.power===null&&meta.pp!==null&&meta.pp>0)
    .map(meta=>[meta.name,{name:meta.name,type:meta.type,category:'status' as const,
      power:0,accuracy:meta.accuracy??100,priority:meta.priority}])
);
export const KANTO_SUPPORT_MOVES:Readonly<Record<string,KantoMove>>={
  growl:{name:'growl',type:'normal',category:'status',power:0,accuracy:100,priority:0},
  'tail-whip':{name:'tail-whip',type:'normal',category:'status',power:0,accuracy:100,priority:0},
  'thunder-wave':{name:'thunder-wave',type:'electric',category:'status',power:0,accuracy:90,priority:0},
  'poison-powder':{name:'poison-powder',type:'poison',category:'status',power:0,accuracy:75,priority:0},
  // D-045: power:null/accuracy:null normalizados para 0/100; alvo é o próprio usuário.
  recover:{name:'recover',type:'normal',category:'status',power:0,accuracy:100,priority:0},
  ...D064AQ_STATUS_MOVES
};
export const KANTO_SUPPORT_EFFECTS:Readonly<Record<string,KantoSupportEffect>>={
  growl:{kind:'lower-attack',stages:1},
  'tail-whip':{kind:'lower-defense',stages:1},
  'thunder-wave':{kind:'status',status:'paralysis'},
  'poison-powder':{kind:'status',status:'poison'},
  recover:{kind:'heal',healing:50},
  leer:{kind:'lower-defense',stages:1},
  'stun-spore':{kind:'status',status:'paralysis'},
  glare:{kind:'status',status:'paralysis'}
};
const LEARNS:Readonly<Record<number,readonly (readonly [number,string])[]>>={
  1:[[4,'growl'],[15,'poison-powder']],
  4:[[1,'growl']],
  7:[[4,'tail-whip']],
  25:[[1,'growl'],[6,'tail-whip'],[8,'thunder-wave']],
  // Recover FRLG: Staryu nível 15, Starmie nível 1 (forma por pedra).
  120:[[15,'recover']],121:[[1,'recover']]
};
export interface KantoSupportLearned {readonly move:KantoMove;readonly learnedAt:number}
export function kantoSupportMoves(speciesId:number,level:number):readonly KantoSupportLearned[]{
  if(!Number.isSafeInteger(speciesId)||speciesId<1||speciesId>151
    ||!Number.isSafeInteger(level)||level<1||level>100)return[];
  const known=(LEARNS[speciesId]??[]).filter(([at])=>at<=level)
    .map(([at,name])=>({learnedAt:at,move:KANTO_SUPPORT_MOVES[name]!}));
  const fromSnapshot=(KANTO_FRLG_LEVELUP_ROWS[speciesId]??[])
    .filter(([at,id])=>at<=level&&D064AQ_STATUS_NAMES.has(KANTO_FRLG_MOVE_META[id]?.name??''))
    .map(([at,id])=>({learnedAt:at,move:KANTO_SUPPORT_MOVES[KANTO_FRLG_MOVE_META[id]!.name]!}));
  const earliest=new Map<string,KantoSupportLearned>();
  for(const entry of [...known,...fromSnapshot]){
    const prev=earliest.get(entry.move.name);
    if(!prev||entry.learnedAt<prev.learnedAt)earliest.set(entry.move.name,entry);
  }
  return [...earliest.values()].sort((a,b)=>a.learnedAt-b.learnedAt||
    a.move.name.localeCompare(b.move.name));
}
export function kantoSupportEffect(name:string):KantoSupportEffect|null {
  return KANTO_SUPPORT_EFFECTS[name]??null;
}
