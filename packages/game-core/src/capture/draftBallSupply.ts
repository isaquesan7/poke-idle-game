/**
 * D-064I — rascunho de abastecimento renovável de Poké Bolas.
 *
 * Apesar do nome histórico "draft", o writer v0.2 JÁ utiliza esta função
 * para recompensar vitórias regionais. A loja ainda não existe.
 * D064BO (esclarecimento do usuário): Ultra Ball ganha em combate desde
 * a R7 a cada 15 vitórias. A restrição de Ultra Ball a R9/R10 é
 * EXCLUSIVA do modo EXPEDIÇÃO; não se aplica a vitórias regionais.
 * Preservar Poké/Great Ball e o teto de vitórias já publicados.
 * O writer futuro deve contar vitórias por região com recibo idempotente;
 * NÃO se basear em contador arbitrário enviado pelo botão/cliente.
 */
import type {KantoBallPocketV1} from './kantoBallPocket.js';
import {kantoRegion} from '../map/kantoRegions.js';

/** Limite persistido histórico de vitórias de cada região. A UI pode seguir
 * batalhando no teto, mas não deve aumentar o contador nem repetir drops. */
export const KANTO_REGION_WINS_CAP=100000;

export type D064DraftBallDrop={
  readonly 'poke-ball':number;
  readonly 'great-ball':number;
  readonly 'ultra-ball':number;
};

/** Kit inicial realmente entregue a novos saves; não oferece Ultra Ball. */
export const D064_DRAFT_STARTER_BALLS:KantoBallPocketV1={
  version:1,quantities:{'poke-ball':12}
};
/** regionWinNumber é o total DE VITÓRIAS daquela região depois de aplicada
 * a batalha. A lógica não usa RNG nem concede Master Ball. */
export function d064DraftBallDrop(regionId:number,regionWinNumber:number):
  D064DraftBallDrop|null {
  const region=kantoRegion(regionId);
  if(!region||!Number.isSafeInteger(regionWinNumber)||regionWinNumber<1
    ||regionWinNumber>KANTO_REGION_WINS_CAP)return null;
  return {
    'poke-ball':regionId<=6&&regionWinNumber%3===0?1:0,
    'great-ball':regionId>=4&&regionWinNumber%7===0?1:0,
    'ultra-ball':regionId>=7&&regionWinNumber%15===0?1:0
  };
}
/** Soma apenas ganhos de vitórias reais; nenhuma quantidade pode ser negativa
 * ou depender de informação local não validada pelo journal de batalhas. */
export function d064DraftBallSupply(regionId:number,wins:number):
  D064DraftBallDrop|null {
  if(!kantoRegion(regionId)||!Number.isSafeInteger(wins)||wins<0||wins>KANTO_REGION_WINS_CAP)return null;
  return{
    'poke-ball':regionId<=6?Math.floor(wins/3):0,
    'great-ball':regionId>=4?Math.floor(wins/7):0,
    'ultra-ball':regionId>=7?Math.floor(wins/15):0
  };
}
