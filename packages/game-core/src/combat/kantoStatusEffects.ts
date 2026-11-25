/**
 * Efeitos secundários de golpes OFENSIVOS da fase de status v0.2.
 * Fonte fixa: PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a
 * data/v2/csv/moves.csv e move_meta.csv.
 *
 * É um recorte intencional, NÃO uma emulação de todos os efeitos FireRed/LeafGreen.
 * Condições temporárias de batalha não alteram o progresso individual.
 */
import {KANTO_FRLG_MOVE_META} from '../catalog/kantoFrlgLevelupSnapshot.js';

export const KANTO_STATUS_SOURCE_COMMIT =
  'ac2f1acb055026e3dff1e0aca743bb46256a810a';

export type KantoBattleStatus = 'burn' | 'paralysis' | 'poison' | 'sleep';
export type KantoSecondaryEffect =
  | {readonly kind:'status';readonly status:KantoBattleStatus;readonly chance:number}
  | {readonly kind:'drain';readonly percent:number}
  | {readonly kind:'speed-drop';readonly chance:number;readonly stages:1};

/** Efeitos do CSV PokéAPI que já possuem resolução fiel no motor atual. */
const FRLG_SECONDARY_EFFECTS:Readonly<Record<string,KantoSecondaryEffect>>=
  Object.fromEntries(Object.values(KANTO_FRLG_MOVE_META).flatMap(meta=>{
    const chance=meta.effectChance??0;
    if(meta.power===null||meta.power<=0)return [];
    let effect:KantoSecondaryEffect|undefined;
    if(meta.effectId===3&&chance>0)effect={kind:'status',status:'poison',chance};
    else if(meta.effectId===5&&chance>0)effect={kind:'status',status:'burn',chance};
    else if(meta.effectId===7&&chance>0)effect={kind:'status',status:'paralysis',chance};
    else if(meta.effectId===4)effect={kind:'drain',percent:50};
    else if(meta.effectId===71&&chance>0)effect={kind:'speed-drop',chance,stages:1};
    return effect?[[meta.name,effect]]:[];
  }));
/** D064AU: só Twineedle possui rolagem de poison por impacto. */
export const KANTO_PER_HIT_SECONDARY_EFFECTS:Readonly<Record<string,KantoSecondaryEffect>>={
  twineedle:Object.freeze({kind:'status',status:'poison',chance:20})
};
export function kantoPerHitSecondaryEffect(moveName:string):KantoSecondaryEffect|null{
  return KANTO_PER_HIT_SECONDARY_EFFECTS[moveName]??null;
}
export const KANTO_SECONDARY_EFFECTS: Readonly<Record<string,KantoSecondaryEffect>> = {
  ...FRLG_SECONDARY_EFFECTS,
  'rock-tomb':{kind:'speed-drop',chance:100,stages:1},
  ember:{kind:'status',status:'burn',chance:10},
  'thunder-shock':{kind:'status',status:'paralysis',chance:10},
  'poison-sting':{kind:'status',status:'poison',chance:30},
  absorb:{kind:'drain',percent:50},
  bubble:{kind:'speed-drop',chance:10,stages:1}
};

/** Por nome CANÔNICO; o botão do jogador nunca fornece porcentagens. */
export function kantoMoveSecondaryEffect(moveName:string):KantoSecondaryEffect|null {
  return KANTO_SECONDARY_EFFECTS[moveName]??null;
}
