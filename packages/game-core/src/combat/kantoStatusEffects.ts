/**
 * Efeitos secundários de golpes OFENSIVOS da fase de status v0.2.
 * Fonte fixa: PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a
 * data/v2/csv/moves.csv e move_meta.csv.
 *
 * É um recorte intencional, NÃO uma emulação de todos os efeitos FireRed/LeafGreen.
 * Condições temporárias de batalha não alteram o progresso individual.
 */
export const KANTO_STATUS_SOURCE_COMMIT =
  'ac2f1acb055026e3dff1e0aca743bb46256a810a';

export type KantoBattleStatus = 'burn' | 'paralysis' | 'poison';
export type KantoSecondaryEffect =
  | {readonly kind:'status';readonly status:KantoBattleStatus;readonly chance:number}
  | {readonly kind:'drain';readonly percent:number}
  | {readonly kind:'speed-drop';readonly chance:number;readonly stages:1};

export const KANTO_SECONDARY_EFFECTS: Readonly<Record<string,KantoSecondaryEffect>> = {
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
