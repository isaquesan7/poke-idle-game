import {kantoRegion} from '../map/kantoRegions.js';

/**
 * D064BJ: zero XP/moedas de progressão quando o líder supera o adversário em 12 níveis.
 * D4C0: drops de itens de batalhas regionais são independentes deste fator.
 * Diferença <=2 recebe 100%; a partir de +3 perde 10% por nível excedente.
 * Avalia o nível ANTES de aplicar o resultado.
 */
export function battleProgressFactor(pokemonLevel:number,wildLevel:number):number {
  if(!Number.isSafeInteger(pokemonLevel)||pokemonLevel<1||pokemonLevel>100
    ||!Number.isSafeInteger(wildLevel)||wildLevel<1||wildLevel>100)
    throw new RangeError('Níveis de combate inválidos.');
  return overlevelFactor(pokemonLevel-wildLevel);
}

/** Expedições não possuem inimigo individual: comparar ao teto da região. */
export function expeditionProgressFactor(regionId:number,pokemonLevel:number):number{
  const region=kantoRegion(regionId);
  if(!region)throw new RangeError('Região de expedição inválida.');
  return battleProgressFactor(pokemonLevel,region.levelMax);
}
function overlevelFactor(difference:number):number{
  return Math.max(0,Math.min(10,12-difference))/10;
}
/** Taxas conservadoras: R1 = economia publicada, +1 por área por ciclo. */
export function expeditionRegionRates(regionId:number):{
  readonly coins:number;readonly trainerXp:number;readonly pokemonXp:number
}{
  if(!kantoRegion(regionId))throw new RangeError('Região inválida.');
  const bonus=regionId-1;
  return {coins:7+bonus,trainerXp:4+bonus,pokemonXp:5+bonus};
}

/** Somente incrementos inteiros; sem XP/ganhos por sobre-nível. */
export function scaledRegionalReward(base:number,factor:number):number{
  if(!Number.isSafeInteger(base)||base<0||!Number.isFinite(factor)
    ||factor<0||factor>1)throw new RangeError('Recompensa inválida.');
  return Math.floor(base*factor);
}
