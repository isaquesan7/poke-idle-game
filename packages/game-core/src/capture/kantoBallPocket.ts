/**
 * D-064D · Modelo puro de bolso de Poké Bolas (writer de batalha regional).
 *
 * Ausência em save antigo NÃO significa "bolso vazio"; migração e kits iniciais
 * requerem uma política explícita antes de habilitar captura e loja.
 * Proibido alterar os saldos por CSS, localStorage direto ou replay de batalha.
 */
import {KANTO_BALLS,canUseKantoBall} from './kantoBalls.js';
import type {KantoBallId} from './kantoBalls.js';

export interface KantoBallPocketV1 {
  readonly version:1;
  readonly quantities:Readonly<Partial<Record<KantoBallId,number>>>;
}
export type KantoBallPocketRead=
  | {readonly status:'legacy-untracked'}
  | {readonly status:'invalid';readonly reason:string}
  | {readonly status:'valid';readonly pocket:KantoBallPocketV1};

const validQty=(n:unknown):n is number=>
  typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=100000;
const knownIds=new Set(Object.keys(KANTO_BALLS));

/** Leitura conservadora: não inventa saldo para perfis antigos. */
export function inspectKantoBallPocket(value:unknown):KantoBallPocketRead{
  if(value===undefined)return{status:'legacy-untracked'};
  if(!value||typeof value!=='object'||Array.isArray(value))
    return{status:'invalid',reason:'Bolso de Poké Bolas inválido.'};
  const raw=value as Record<string,unknown>;
  if(raw.version!==1||!raw.quantities||typeof raw.quantities!=='object'
    ||Array.isArray(raw.quantities))
    return{status:'invalid',reason:'Formato do bolso de Poké Bolas inválido.'};
  const quantities=raw.quantities as Record<string,unknown>;
  if(Object.entries(quantities).some(([id,qty])=>!knownIds.has(id)||!validQty(qty)))
    return{status:'invalid',reason:'Quantidade ou tipo de Poké Bola inválido.'};
  return{status:'valid',pocket:{
    version:1,quantities:Object.fromEntries(Object.entries(quantities)) as
      Partial<Record<KantoBallId,number>>
  }};
}

export type KantoBallSpendResult=
  | {readonly status:'ok';readonly pocket:KantoBallPocketV1}
  | {readonly status:'blocked';readonly reason:string};

/** Calcula a alteração para um lançamento autorizado, inclusive em falha.
 * NÃO concede captura: a resolução e o débito precisam compartilhar revision.
 */
export function spendKantoBallForAttempt(
  pocket:KantoBallPocketV1,ballId:KantoBallId,speciesId:number
):KantoBallSpendResult {
  const checked=inspectKantoBallPocket(pocket);
  if(checked.status!=='valid')
    return{status:'blocked',reason:'Bolso inválido.'};
  const amount=checked.pocket.quantities[ballId]??0;
  const permission=canUseKantoBall(ballId,speciesId,amount);
  if(!permission.ok)return{status:'blocked',reason:permission.reason};
  return{status:'ok',pocket:{
    version:1,quantities:{...checked.pocket.quantities,[ballId]:amount-1}
  }};
}
