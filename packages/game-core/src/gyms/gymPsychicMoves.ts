/**
 * GYM-02C2b2 — golpes psíquicos de nível FireRed/LeafGreen.
 * Snapshot PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a.
 * Apenas os effects 77 (10% confusão) e 73 (10% queda Sp.Def)
 * são executáveis no Ginásio; não muda o combate regional.
 */
import type {KantoMove} from '../combat/kantoBattle.js';
import {KANTO_FRLG_MOVE_META,kantoFrlgLevelMoveCatalog}
  from '../catalog/kantoFrlgLevelupSnapshot.js';

export type GymPsychicSecondary=
  | {readonly kind:'confusion';readonly chance:number}
  | {readonly kind:'special-defense-drop';readonly chance:number};
const EXPECTED_EFFECTS:Readonly<Record<string,number>>={
  confusion:77,psybeam:77,psychic:73
};

/** Rejeitar mudanças acidentais no CSV de fonte que alterem o golpe. */
export function gymPsychicSecondary(name:string):GymPsychicSecondary|null{
  const expected=EXPECTED_EFFECTS[name];
  if(expected===undefined)return null;
  const meta=Object.values(KANTO_FRLG_MOVE_META).find(m=>m.name===name);
  if(!meta||meta.effectId!==expected||meta.effectChance!==10
    ||meta.type!=='psychic'||meta.category!=='special'||meta.power===null)
    throw new RangeError('Snapshot psíquico incompatível com o motor.');
  return {kind:expected===77?'confusion':'special-defense-drop',chance:10};
}
export interface GymPsychicMove {
  readonly learnedAt:number;
  readonly move:KantoMove;
}
export function gymPsychicLevelMoves(
  speciesId:number,level:number
):readonly GymPsychicMove[]{
  return kantoFrlgLevelMoveCatalog(speciesId,level).flatMap(entry=>{
    const {meta}=entry;
    if(EXPECTED_EFFECTS[meta.name]!==meta.effectId
      ||meta.category!=='special'||meta.power===null
      ||meta.power<=0||meta.pp===null||meta.pp<=0
      ||meta.effectChance!==10)return [];
    return [{learnedAt:entry.learnedAt,
      move:{name:meta.name,type:meta.type,category:'special' as const,
        power:meta.power,accuracy:meta.accuracy??100,
        priority:meta.priority}}];
  });
}
