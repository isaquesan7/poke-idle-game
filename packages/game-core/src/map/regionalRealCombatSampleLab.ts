/**
 * D-064AB — amostragem de resultados do motor REAL de combate em memória.
 *
 * Não é progressão longitudinal: cada luta recomeça com HP/SP restaurados,
 * o líder recebe stats BASE sem afinidade, investimento, equipamentos,
 * golpes opcionais ou formação. O treinador nível 100 serve somente para
 * liberar a área; não concede stats ao Pokémon e não representa a UI.
 * Captura está intencionalmente desabilitada pelo preview regional.
 */
import {KANTO_BATTLE_SPECIES} from '../combat/kantoBattle.js';
import {pokemonOwnStats} from '../stats/pokemon.js';
import {zeroStats} from '../stats/types.js';
import {kantoRegion} from './kantoRegions.js';
import {previewKantoRegionalBattle} from './regionalBattlePreview.js';

export interface RegionalBattleSampleRequest {
  readonly regionId:number;
  readonly leaderSpeciesId:number;
  readonly leaderLevel:number;
  readonly samples:number;
  readonly seed:number;
}
export interface RegionalBattleSampleSummary {
  readonly regionId:number;
  readonly leaderSpeciesId:number;
  readonly leaderLevel:number;
  readonly samples:number;
  readonly wins:number;
  readonly losses:number;
  readonly draws:number;
  readonly observedWinRate:number;
  readonly avgTurns:number;
  readonly minWildLevel:number;
  readonly maxWildLevel:number;
}
function good(value:number,min:number,max:number):boolean{
  return Number.isSafeInteger(value)&&value>=min&&value<=max;
}
function nextSeed(seed:number):number{
  // Percorre amostras em saltos determinísticos (não RNG seguro).
  let v=(seed+0x9e3779b9)>>>0;
  v=Math.imul(v^(v>>>16),0x85ebca6b)>>>0;
  v=Math.imul(v^(v>>>13),0xc2b2ae35)>>>0;
  return(v^(v>>>16))>>>0;
}
/** Resultado de batalhas completas simulateKantoBattle, não taxa inventada. */
export function d064SampleRealRegionalBattles(
  input:RegionalBattleSampleRequest
):RegionalBattleSampleSummary|null{
  if(!input||!good(input.regionId,1,10)
    ||!good(input.leaderSpeciesId,1,151)
    ||!good(input.leaderLevel,1,100)
    ||!good(input.samples,1,256)
    ||!good(input.seed,0,0xffffffff))return null;
  const region=kantoRegion(input.regionId);
  const leaderSpecies=KANTO_BATTLE_SPECIES[input.leaderSpeciesId];
  if(!region||!leaderSpecies)return null;
  const leader={
    speciesId:leaderSpecies.id,name:leaderSpecies.name,
    level:input.leaderLevel,types:leaderSpecies.types,
    stats:pokemonOwnStats(leaderSpecies.base,input.leaderLevel,zeroStats()),
    move:leaderSpecies.move,rank:0
  };
  let wins=0,losses=0,draws=0,totalTurns=0;
  let minWildLevel=101,maxWildLevel=0;
  let seed=input.seed>>>0;
  for(let i=0;i<input.samples;i++){
    seed=nextSeed(seed);
    // Mantém um conjunto estático de condições de batalha para medir
    // matchup, nível e RNG, sem alterar qualquer save ou XP da equipe.
    const simulated=previewKantoRegionalBattle(100,region.id,leader,seed);
    if(simulated.status!=='ready')return null;
    const b=simulated.preview.battle;
    if(b.outcome==='win')wins++;
    else if(b.outcome==='loss')losses++;
    else draws++;
    totalTurns+=b.turns;
    minWildLevel=Math.min(minWildLevel,simulated.preview.wildLevel);
    maxWildLevel=Math.max(maxWildLevel,simulated.preview.wildLevel);
  }
  return{
    regionId:region.id,leaderSpeciesId:leaderSpecies.id,
    leaderLevel:input.leaderLevel,samples:input.samples,
    wins,losses,draws,observedWinRate:wins/input.samples,
    avgTurns:totalTurns/input.samples,minWildLevel,maxWildLevel
  };
}
