/**
 * D-064C · Contrato puro para teto de XP de Expedição.
 * Não altera ciclos, moedas, XP do treinador nem o writer atual. Um ciclo
 * agregado nunca consegue ultrapassar o nível máximo da região escolhida.
 */
import {grantXp,xpThreshold} from '../progression/xp.js';
import type {LevelProgress} from '../progression/xp.js';
import {kantoRegion} from './kantoRegions.js';

export type RegionExpeditionXpResult={
  readonly level:number;
  readonly xp:number;
  readonly xpAccepted:number;
  readonly xpDiscarded:number;
  readonly capped:boolean;
};

/** O Pokémon pode entrar no próximo tier quando atingir o teto anterior.
 * Treinador precisa ter nível suficiente para desbloquear a região.
 * Entrar em tier antigo é permitido; nesse caso o XP poderá estar no teto.
 */
export function canStartRegionalExpedition(
  trainerLevel:number,pokemonLevel:number,regionId:number
):boolean{
  const region=kantoRegion(regionId);
  return !!region
    &&Number.isSafeInteger(trainerLevel)&&trainerLevel>=1&&trainerLevel<=100
    &&Number.isSafeInteger(pokemonLevel)&&pokemonLevel>=1&&pokemonLevel<=100
    &&trainerLevel>=region.trainerUnlockLevel
    &&pokemonLevel>=region.levelMin-1;
}

/** Usa a curva atual como motor de projeção e pode ser reutilizado quando
 * xpThreshold for revisada. NÃO apaga XP existente ao entrar em região anterior.
 */
export function cappedRegionalPokemonXp(
  previous:LevelProgress,awardedXp:number,regionId:number
):RegionExpeditionXpResult|null{
  const region=kantoRegion(regionId);
  if(!region||!Number.isSafeInteger(previous.level)||previous.level<1
    ||previous.level>100||!Number.isSafeInteger(previous.xp)||previous.xp<0
    ||!Number.isSafeInteger(awardedXp)||awardedXp<0)return null;
  if(previous.level>=region.levelMax||region.levelMax===1)
    return{level:previous.level,xp:previous.xp,
      xpAccepted:0,xpDiscarded:awardedXp,capped:true};
  let remainingToCap=0;
  for(let level=previous.level;level<region.levelMax;level++){
    remainingToCap+=xpThreshold('pokemon',level);
  }
  remainingToCap=Math.max(0,remainingToCap-previous.xp);
  const xpAccepted=Math.min(awardedXp,remainingToCap);
  const result=grantXp('pokemon',previous,xpAccepted);
  if(result.level>region.levelMax)throw Error('Nível de Expedição ultrapassou limite regional.');
  return{level:result.level,xp:result.xp,xpAccepted,
    xpDiscarded:awardedXp-xpAccepted,capped:result.level>=region.levelMax};
}
