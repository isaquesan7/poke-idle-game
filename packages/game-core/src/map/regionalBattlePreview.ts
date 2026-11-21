/**
 * D-064F — Pré-resolução regional com motor REAL de batalha, sem save ou loot.
 *
 * O catálogo regional passa a controlar o inimigo e seu nível no mesmo
 * simulador D-063. Lendários são apenas sorteados nos tiers permitidos.
 * Captura 35% da Arena antiga ainda é calculada internamente pelo simulador,
 * mas NÃO É RESOLVIDA nem creditada: battlePreview não é comando de gameplay.
 *
 * NÃO autorizar este resultado como argumento externo do writer. O futuro
 * writer deve reconstruir o combate do próprio snapshot, validar a região,
 * verificar a bola e gastar estoque na mesma revisão da eventual captura.
 */
import {pokemonOwnStats} from '../stats/pokemon.js';
import {zeroStats} from '../stats/types.js';
import {
  KANTO_BATTLE_SPECIES,simulateKantoBattle
} from '../combat/kantoBattle.js';
import type {Combatant,KantoBattleResult} from '../combat/kantoBattle.js';
import {kantoRegion,kantoRegionalEncounter} from './kantoRegions.js';

export interface KantoRegionalBattlePreview {
  readonly regionId:number;
  readonly wildSpeciesId:number;
  readonly wildLevel:number;
  readonly battle:Omit<KantoBattleResult,'captured'>;
  /** Captura deliberadamente fora do escopo até a mochila transacional. */
  readonly captureDisabled:true;
}
export type KantoRegionalPreviewResult=
  | {readonly status:'ready';readonly preview:KantoRegionalBattlePreview}
  | {readonly status:'blocked';readonly reason:string};

/** Não permite região liberada apenas via UI nem encontro fora de sua pool.
 * O Treinador abre regiões; o Pokémon pode batalhar com nível inferior, mas
 * isso aumenta o risco de derrota (sem manipular recompensas).
 */
export function previewKantoRegionalBattle(
  trainerLevel:number,regionId:number,leader:Combatant,seed:number
):KantoRegionalPreviewResult{
  if(!Number.isSafeInteger(trainerLevel)||trainerLevel<1||trainerLevel>100)
    return{status:'blocked',reason:'Nível do Treinador inválido.'};
  const region=kantoRegion(regionId);
  if(!region)return{status:'blocked',reason:'Região inexistente.'};
  if(trainerLevel<region.trainerUnlockLevel)
    return{status:'blocked',reason:'Nível do Treinador insuficiente para a região.'};
  const encounter=kantoRegionalEncounter(regionId,seed,leader.level);
  if(!encounter)return{status:'blocked',reason:'Encontro regional inválido.'};
  const species=KANTO_BATTLE_SPECIES[encounter.speciesId];
  if(!species)return{status:'blocked',reason:'Espécie regional sem dados de combate.'};
  try{
    const wild:Combatant={
      speciesId:species.id,name:species.name,level:encounter.level,types:species.types,
      stats:pokemonOwnStats(species.base,encounter.level,zeroStats()),
      move:species.move,rank:0
    };
    const result=simulateKantoBattle(leader,wild,seed,'regional-preview');
    // Remove a antiga captura 35% do contrato visível para que nenhuma
    // integração acidental possa conceder uma captura sem Poké Bola.
    const {captured:_unused,...battle}=result;
    return{status:'ready',preview:{
      regionId,wildSpeciesId:encounter.speciesId,wildLevel:encounter.level,
      battle,captureDisabled:true
    }};
  }catch{
    return{status:'blocked',reason:'Falha ao simular combate da região.'};
  }
}
