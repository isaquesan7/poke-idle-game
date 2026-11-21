/**
 * D-064G · PROJEÇÃO de chances de captura para o balanceamento regional.
 *
 * Usa capture_rate do snapshot PokéAPI (3..255) e os multiplicadores
 * canônicos 1/1.5/2. A fórmula a/255 é uma APROXIMAÇÃO de geração III,
 * não o algoritmo integral dos quatro shakes, nem o sistema final de
 * captura. Permite mensurar a combinação rara aparição × baixa captura.
 * NÃO calcula nem grava evento, não usa RNG e nunca permite Master Ball.
 */
import {KANTO_BALLS} from './kantoBalls.js';
import type {KantoBallId} from './kantoBalls.js';
import {kantoSpecies} from '../catalog/kantoSpecies.js';
import {kantoRegion} from '../map/kantoRegions.js';

export type CaptureProjection={
  readonly ballId:Exclude<KantoBallId,'master-ball'>;
  readonly captureChance:number;
  readonly appearanceChance:number;
  readonly combinedChancePerBattle:number;
  readonly expectedBattlesPerCapture:number;
};
/** currentHp=0 é hipótese futura de captura após vitória (nocaute).
 * Em mecânica clássica 0 HP não é capturável: esta diferença é INTENCIONAL
 * no modelo, não representa implementação de jogo. */
export function d064CaptureProjection(
  speciesId:number,regionId:number,ballId:KantoBallId,maxHp:number,currentHp:number
):CaptureProjection|null{
  const region=kantoRegion(regionId);
  const species=kantoSpecies(speciesId);
  const ball=KANTO_BALLS[ballId];
  if(!region||!species||!region.speciesIds.includes(speciesId)
    ||!ball||!ball.automaticUse||ball.catchModifier===null
    ||!Number.isSafeInteger(maxHp)||maxHp<1
    ||!Number.isSafeInteger(currentHp)||currentHp<0||currentHp>maxHp)return null;
  if((species.legendary||species.mythical)&&!ball.legendaryCapture)return null;
  const weights=region.speciesIds.map(id=>
    region.rareSpeciesIds.includes(id)?region.rareWeight:region.commonWeight);
  const index=region.speciesIds.indexOf(speciesId);
  const numerator=weights[index]!;
  const total=weights.reduce((a,v)=>a+v,0);
  const appearanceChance=numerator/total;
  const modifiedRate=(3*maxHp-2*currentHp)*species.captureRate*ball.catchModifier/(3*maxHp);
  const captureChance=Math.min(1,modifiedRate/255);
  const combinedChancePerBattle=appearanceChance*captureChance;
  return {
    ballId:ballId as Exclude<KantoBallId,'master-ball'>,
    captureChance,appearanceChance,combinedChancePerBattle,
    expectedBattlesPerCapture:1/combinedChancePerBattle
  };
}
