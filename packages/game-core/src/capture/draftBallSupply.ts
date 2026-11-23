/**
 * D064BQ — drop aleatório de Pokébolas após vitória regional elegível.
 *
 * NÃO existe mais recompensa por marcos de 3/7/15 vitórias.
 * Uma única rolagem independente, com chance para nenhum item ou uma bola.
 * O seed do combate, id imutável do encontro e região formam o RNG determinista:
 * um replay produz o mesmo drop, a confirmação só paga uma vez via journal.
 * Sem backend autoritativo, RNG local não impede manipulação maliciosa.
 */
import type {KantoBallPocketV1} from './kantoBallPocket.js';
import {kantoRegion} from '../map/kantoRegions.js';

export const KANTO_REGION_WINS_CAP=100000;
export type D064DraftBallDrop={
  readonly 'poke-ball':number;
  readonly 'great-ball':number;
  readonly 'ultra-ball':number;
};

export type KantoBattleBallDropRates={
  readonly 'poke-ball':number;
  readonly 'great-ball':number;
  readonly 'ultra-ball':number;
};

/** Porcentagens sobre vitórias válidas, exclusivas (máximo 1 bola por vitória).
 * R1–R3: 30% Poké. R4–R6: 25% Poké + 14% Great.
 * R7–R8: 18% Poké + 14% Great + 5% Ultra.
 * R9–R10: 18% Poké + 14% Great + 7% Ultra.
 * Expedição é FONTE INDEPENDENTE: Ultra apenas R9–R10 a cada 24h elegíveis.
 */
export function d064BattleBallDropRates(regionId:number):KantoBattleBallDropRates|null{
  if(!kantoRegion(regionId))return null;
  if(regionId<=3)return{'poke-ball':30,'great-ball':0,'ultra-ball':0};
  if(regionId<=6)return{'poke-ball':25,'great-ball':14,'ultra-ball':0};
  if(regionId<=8)return{'poke-ball':18,'great-ball':14,'ultra-ball':5};
  return{'poke-ball':18,'great-ball':14,'ultra-ball':7};
}
export const D064_DRAFT_STARTER_BALLS:KantoBallPocketV1={
  version:1,quantities:{'poke-ball':12}
};

/** Hash independente dos sorteios de golpe/captura.
 * battleId muda por revisão; repetir o seed em encontros distintos
 * não força drops idênticos. uint32 -> rolagem 0..9999.
 */
export function d064BattleBallRoll(regionId:number,seed:number,battleId:string):number|null{
  if(!kantoRegion(regionId)||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff
    ||typeof battleId!=='string'||!/^regional-v02-[1-9][0-9]*$/.test(battleId)
    ||battleId.length>96)return null;
  let hash=(seed^(Math.imul(regionId,0x9e3779b9)>>>0)^0xa5a593cf)>>>0;
  for(let i=0;i<battleId.length;i++)
    hash=Math.imul(hash^battleId.charCodeAt(i),0x01000193)>>>0;
  hash^=hash>>>16;
  hash=Math.imul(hash,0x7feb352d)>>>0;
  hash^=hash>>>15;
  hash=Math.imul(hash,0x846ca68b)>>>0;
  hash^=hash>>>16;
  return(hash>>>0)%10000;
}

/** Shared canonical 0..9999 roll interpretation. The API derives this
 * integer from private HMAC entropy; /play keeps its existing local hashing.
 * Exactly zero or one ball per eligible victory, never a milestone award.
 */
export function d064BattleBallDropFromRoll(
  regionId:number,roll:number
):D064DraftBallDrop|null{
  const rates=d064BattleBallDropRates(regionId);
  if(!rates||!Number.isSafeInteger(roll)||roll<0||roll>=10000)return null;
  const poke=rates['poke-ball']*100;
  const great=poke+rates['great-ball']*100;
  const ultra=great+rates['ultra-ball']*100;
  return{
    'poke-ball':roll<poke?1:0,
    'great-ball':roll>=poke&&roll<great?1:0,
    'ultra-ball':roll>=great&&roll<ultra?1:0
  };
}

/** Existing local battle seed/hash policy is unchanged. */
export function d064DraftBallDrop(
  regionId:number,seed:number,battleId:string
):D064DraftBallDrop|null{
  const roll=d064BattleBallRoll(regionId,seed,battleId);
  return roll===null?null:d064BattleBallDropFromRoll(regionId,roll);
}

/** SOMENTE expectativa estatística, jamais quantidade prometida por vitórias.
 * Pode produzir frações; não usar como comando de crédito de estoque.
 */
export function d064DraftBallSupply(regionId:number,wins:number):
  Readonly<Record<keyof D064DraftBallDrop,number>>|null{
  const rates=d064BattleBallDropRates(regionId);
  if(!rates||!Number.isSafeInteger(wins)||wins<0)return null;
  return{
    'poke-ball':wins*rates['poke-ball']/100,
    'great-ball':wins*rates['great-ball']/100,
    'ultra-ball':wins*rates['ultra-ball']/100
  };
}
