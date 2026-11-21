/**
 * D-064AF — encontros DEMONSTRATIVOS com o motor real de Kanto.
 * Não é combate jogável, não recebe save, não persiste captura/recompensa
 * e não é RNG autoritativo. Os exemplos são somente espécies ilustrativas
 * do catálogo da prévia e não equivalem ao pool completo de cada região.
 */
import {KANTO_BATTLE_SPECIES,pokemonOwnStats,simulateKantoBattle,zeroStats}
  from '@kanto/game-core';
import type {BattleOutcome,Combatant} from '@kanto/game-core';
import {PREVIEW_REGIONS} from './previewCatalog';

export interface RegionDemoRequest{
  readonly regionId:number;
  readonly leaderSpeciesId:number;
  readonly leaderLevel:number;
  readonly seed:number;
}
export interface RegionDemoResult{
  readonly regionId:number;
  readonly leaderSpeciesId:number;
  readonly leaderName:string;
  readonly leaderLevel:number;
  readonly wildSpeciesId:number;
  readonly wildName:string;
  readonly wildLevel:number;
  readonly outcome:BattleOutcome;
  readonly turns:number;
  readonly playerMaxHp:number;
  readonly wildMaxHp:number;
  readonly playerRemainingHp:number;
  readonly wildRemainingHp:number;
  readonly log:readonly string[];
}
function valid(value:number,min:number,max:number):boolean{
  return Number.isSafeInteger(value)&&value>=min&&value<=max;
}
function combatant(id:number,level:number):Combatant|null{
  const species=KANTO_BATTLE_SPECIES[id];
  if(!species)return null;
  return{
    speciesId:id,name:species.name,level,
    types:species.types,move:species.move,rank:0,
    stats:pokemonOwnStats(species.base,level,zeroStats())
  };
}
export function previewRegionDemo(input:RegionDemoRequest):RegionDemoResult|null{
  if(!input||!valid(input.regionId,1,10)
    ||!valid(input.leaderSpeciesId,1,151)
    ||!valid(input.leaderLevel,1,100)
    ||!valid(input.seed,0,0xffffffff))return null;
  const region=PREVIEW_REGIONS.find(item=>item.id===input.regionId);
  if(!region||!region.examples.length)return null;
  // Uma semente local altera a espécie ilustrativa e o RNG de combate.
  const wildSpeciesId=region.examples[input.seed%region.examples.length]!;
  const wildLevel=Math.min(region.maxLevel,Math.max(region.minLevel,
    input.leaderLevel+((input.seed>>>16)%5)-2));
  const player=combatant(input.leaderSpeciesId,input.leaderLevel);
  const wild=combatant(wildSpeciesId,wildLevel);
  if(!player||!wild)return null;
  const battle=simulateKantoBattle(player,wild,input.seed);
  // Motor legado inclui texto de prêmio/captura automática: é verdade na
  // Arena real, mas falso nesta prévia. Nunca apresentar esses grants.
  const log=battle.log
    .filter(line=>!line.startsWith('Captura! '))
    .map(line=>line==='Vitória! Recompensas de combate recebidas.'
      ?'Vitória na demonstração! Nenhum recurso foi concedido.'
      :line);
  return{
    regionId:region.id,leaderSpeciesId:player.speciesId,
    leaderName:player.name,leaderLevel:player.level,
    wildSpeciesId:wild.speciesId,wildName:wild.name,wildLevel:wild.level,
    outcome:battle.outcome,turns:battle.turns,
    playerMaxHp:battle.playerMaxHp,wildMaxHp:battle.wildMaxHp,
    playerRemainingHp:battle.playerRemainingHp,
    wildRemainingHp:battle.wildRemainingHp,log
  };
}
