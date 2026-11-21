/**
 * D064AT — golpes multi-hit FRLG de nível.
 * Dados congelados PokéAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a
 * effectId 30: 2–5 golpes, distribuição GenIII 3/8, 3/8, 1/8, 1/8.
 * effectId 45: exatamente dois hits. D064AU: Twineedle (effect78)
 * tem dois impactos fixos e chance de poison por impacto válido.
 * Bullet Seed (TM09) permanece somente como prévia e sem ensino.
 */
import {KANTO_FRLG_MOVE_META} from '../catalog/kantoFrlgLevelupSnapshot.js';

export type KantoMultiHitRange=Readonly<{minHits:number;maxHits:number}>;
const LEVELUP_MULTI_NAMES=new Set([
  'double-slap','comet-punch','fury-attack','pin-missile','spike-cannon',
  'barrage','fury-swipes','bonemerang','bone-rush','icicle-spear','rock-blast',
  'twineedle'
]);
const FRLG_MULTI_HITS:Readonly<Record<string,KantoMultiHitRange>>=Object.fromEntries(
  Object.values(KANTO_FRLG_MOVE_META).filter(meta=>
    LEVELUP_MULTI_NAMES.has(meta.name)
    &&(meta.effectId===30||meta.effectId===45
      ||(meta.name==='twineedle'&&meta.effectId===78&&meta.effectChance===20))
    &&meta.minHits===2&&(meta.maxHits===2||meta.maxHits===5)
    &&meta.power!==null&&meta.power>0&&meta.category!=='status'
    &&meta.pp!==null&&meta.pp>0
  ).map(meta=>[meta.name,Object.freeze({minHits:meta.minHits!,maxHits:meta.maxHits!})])
);

/** Somente golpes validados; um único pagamento de SP/precisão por ação. */
export const KANTO_MULTI_HIT_MOVES:Readonly<Record<string,KantoMultiHitRange>> =
  Object.freeze({
    'double-kick':Object.freeze({minHits:2,maxHits:2}),
    ...FRLG_MULTI_HITS
  });

/** Usado pelo cálculo legado de SP/dano esperado; não define os impactos. */
export function kantoMoveHitCount(name:string):number{
  return KANTO_MULTI_HIT_MOVES[name]?.minHits??1;
}

/** Média 3 impactos (GenIII) para IA e SP; 2 hits fixos usam média 2. */
export function kantoMoveExpectedHits(name:string):number{
  const hits=KANTO_MULTI_HIT_MOVES[name];
  return hits?.maxHits===5?3:hits?.minHits??1;
}

/**
 * Distribuição determinística somente para golpes 2–5.
 * Sorteio é feito uma vez DEPOIS de passar na precisão.
 * Não gasta rolagem nos golpes de 1 ou 2 hits fixos.
 */
export function kantoRollHitCount(name:string,roll:()=>number):number{
  const hits=KANTO_MULTI_HIT_MOVES[name];
  if(!hits)return 1;
  if(hits.minHits===hits.maxHits)return hits.minHits;
  const value=roll();
  if(!Number.isFinite(value)||value<0||value>=1)
    throw new RangeError('Rolagem multi-hit inválida.');
  return value<.375?2:value<.75?3:value<.875?4:5;
}
