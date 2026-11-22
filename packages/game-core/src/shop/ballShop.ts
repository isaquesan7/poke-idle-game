/**
 * D064BP — catálogo e contrato PURO de compra de Pokébolas.
 * Nenhum preço foi aprovado: o jogo publicado não deve executar compras
 * até que a política versionada seja deliberadamente ativada.
 * Preços são recebidos de política confiável, NUNCA de comandos do cliente.
 */
import type {KantoBallId} from '../capture/kantoBalls.js';
import {KANTO_BALLS} from '../capture/kantoBalls.js';
import {inspectKantoBallPocket} from '../capture/kantoBallPocket.js';
import type {KantoBallPocketV1} from '../capture/kantoBallPocket.js';

export type KantoShopBallId=Exclude<KantoBallId,'master-ball'>;
export interface KantoBallShopItem {
  readonly id:KantoShopBallId;
  readonly name:string;
  readonly trainerUnlockLevel:number;
  readonly maxPerPurchase:number;
}
export const KANTO_BALL_SHOP_CATALOG:Readonly<Record<KantoShopBallId,KantoBallShopItem>>={
  'poke-ball':{id:'poke-ball',name:'Poké Ball',trainerUnlockLevel:1,maxPerPurchase:50},
  'great-ball':{id:'great-ball',name:'Great Ball',trainerUnlockLevel:20,maxPerPurchase:25},
  'ultra-ball':{id:'ultra-ball',name:'Ultra Ball',trainerUnlockLevel:55,maxPerPurchase:10}
};
export const KANTO_BALL_SHOP_STATUS='pricing-pending' as const;
/** Min/Max no bolso são limites técnicos do save, não limites de compra. */
export const KANTO_SHOP_BALL_POCKET_CAP=100000;

export interface KantoShopPricePolicy {
  readonly version:number;
  readonly unitPrices:Readonly<Record<KantoShopBallId,number>>;
}
export interface KantoShopPurchaseInput {
  readonly coins:number;
  readonly pocket:KantoBallPocketV1;
  readonly trainerLevel:number;
  readonly ballId:string;
  readonly quantity:number;
}
export type KantoShopPurchaseResult=
  | {readonly status:'quoted';readonly cost:number;readonly remainingCoins:number;
    readonly pocket:KantoBallPocketV1;readonly policyVersion:number}
  | {readonly status:'blocked';readonly reason:string};

/** Simula uma operação única (coins e bolso), SEM gravar no save ou habilitar a loja.
 * O futuro writer deverá gerar receipt e revision num único commit CAS.
 */
export function quoteKantoBallShopPurchase(
  input:KantoShopPurchaseInput,policy:KantoShopPricePolicy|null
):KantoShopPurchaseResult {
  if(policy===null)return{status:'blocked',reason:'Loja aguardando definição de preços.'};
  if(!Number.isSafeInteger(policy.version)||policy.version<1
    ||Object.keys(policy.unitPrices).length!==3
    ||Object.values(policy.unitPrices).some(value=>
      !Number.isSafeInteger(value)||value<1||value>100000000))
    return{status:'blocked',reason:'Tabela de preços inválida.'};
  if(!Number.isSafeInteger(input.coins)||input.coins<0||
    !Number.isSafeInteger(input.trainerLevel)||input.trainerLevel<1||input.trainerLevel>100)
    return{status:'blocked',reason:'Saldo ou nível inválido.'};
  const item=KANTO_BALL_SHOP_CATALOG[input.ballId as KantoShopBallId];
  if(!item||item.id!==input.ballId||!KANTO_BALLS[item.id].conventionalShop)
    return{status:'blocked',reason:'Item não disponível na loja.'};
  if(input.trainerLevel<item.trainerUnlockLevel)
    return{status:'blocked',reason:'Nível de treinador insuficiente para este item.'};
  if(!Number.isSafeInteger(input.quantity)||input.quantity<1
    ||input.quantity>item.maxPerPurchase)
    return{status:'blocked',reason:'Quantidade de compra inválida.'};
  const inspection=inspectKantoBallPocket(input.pocket);
  if(inspection.status!=='valid')
    return{status:'blocked',reason:'Bolso de Pokébolas inválido.'};
  const current=inspection.pocket.quantities[item.id]??0;
  if(current+input.quantity>KANTO_SHOP_BALL_POCKET_CAP)
    return{status:'blocked',reason:'Limite do bolso atingido.'};
  const unitPrice=policy.unitPrices[item.id];
  if(!Number.isSafeInteger(unitPrice)||unitPrice<1)
    return{status:'blocked',reason:'Preço do item inválido.'};
  const cost=unitPrice*input.quantity;
  if(!Number.isSafeInteger(cost)||cost>input.coins)
    return{status:'blocked',reason:'Moedas insuficientes.'};
  return{status:'quoted',cost,remainingCoins:input.coins-cost,
    pocket:{version:1,quantities:{
      ...inspection.pocket.quantities,[item.id]:current+input.quantity
    }},policyVersion:policy.version};
}
