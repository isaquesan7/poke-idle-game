import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_SPECIES,pokemonOwnStats,simulateKantoBattle,zeroStats
} from '../src/index.js';
import type {Combatant} from '../src/index.js';

/** D064BL: amostra determinística do motor REAL (sem conceder XP).
 * Este laboratório assume evoluções finais 3/6/9, os golpes-base do catálogo,
 * nenhum item, título, insígnia, afinidade, ranks ou upgrades.
 * NÃO equivale ao moveset efetivo de um treinador e não é telemetria.
 */
const LEADERS=[3,6,9] as const;
const R3_WILD=[19,55,63,74,95] as const;
const SEEDS=[0,1,7,19,31,53,107,169] as const;
function fighter(id:number,level:number):Combatant{
  const species=KANTO_BATTLE_SPECIES[id];
  if(!species)throw new Error('Espécie ausente no catálogo: '+id);
  return {speciesId:id,name:species.name,types:species.types,
    level,stats:pokemonOwnStats(species.base,level,zeroStats()),
    move:species.move,rank:0};
}
describe('D064BL — amostra do motor de combate em R3 com líder Nv41',()=>{
  it('mantém combate legítimo independente do fator de XP; documenta resultados sem assumir 100% vitórias',()=>{
    const report:Record<string,{win:number;loss:number;draw:number;meanTurns:number}>={};
    for(const leader of LEADERS){
      const player=fighter(leader,41);
      let win=0,loss=0,draw=0,turns=0;
      for(const wildId of R3_WILD){
        const wild=fighter(wildId,30);
        for(const seed of SEEDS){
          const result=simulateKantoBattle(player,wild,seed);
          expect(result.frames.length).toBe(result.log.length);
          expect(result.turns).toBeGreaterThanOrEqual(1);
          expect(result.turns).toBeLessThanOrEqual(30);
          expect(result.playerLevel).toBe(41);
          expect(result.wildSpeciesId).toBe(wildId);
          expect(result.playerRemainingHp).toBeGreaterThanOrEqual(0);
          expect(result.wildRemainingHp).toBeGreaterThanOrEqual(0);
          turns+=result.turns;
          if(result.outcome==='win')win++;
          else if(result.outcome==='loss')loss++;
          else draw++;
        }
      }
      expect(win+loss+draw).toBe(R3_WILD.length*SEEDS.length);
      report[String(leader)]={win,loss,draw,
        meanTurns:Math.round(turns/(R3_WILD.length*SEEDS.length)*100)/100};
    }
    console.info('D064BL_REAL_BATTLE_SAMPLE '+JSON.stringify({
      label:'amostra ilustrativa, não taxas de vitória da UI real',
      r3WildLevel:30,leaderLevel:41,moves:'catalog-default-only',
      seeds:SEEDS.length,wildSpecies:R3_WILD,report
    }));
  },30000);
});
