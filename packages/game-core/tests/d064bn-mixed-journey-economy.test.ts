import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,KANTO_BATTLE_SPECIES,
  battleProgressFactor,battleTrainerXp,d064DraftBallDrop,
  emptyExpeditionBallProgress,expeditionRewards,grantXp,
  kantoRegionalEncounter,kantoWildMoveLoadout,
  pokemonOwnStats,resolveKantoCaptureAttempt,scaledRegionalReward,
  simulateKantoBattle,zeroStats
} from '../src/index.js';
import type {Combatant,ExpeditionBallProgress,LevelProgress} from '../src/index.js';
import type {KantoBallId,KantoBallPocketV1} from '../src/index.js';

/**
 * D064BN: amostra reproduzível do motor REAL com economia pura.
 * Distinções:
 * - zero pontos/equipamentos/título/afinidade, golpes padrões sem evolução;
 * - uma espécie inicial por run, sem trocar para novos capturados;
 * - uma batalha por seed, sem acelerar relógio ou prometer taxa do jogador;
 * - a cada 15 encontros, há 2h de expedição remunerada e resgate;
 * - tenta capturar espécies NÃO obtidas após vitória se há bola,
 *   sem compra nem repetição da mesma captura por derrota.
 * NÃO é save de produção, nem simula consumo de itens ainda não existentes.
 */
describe('D064BN — coortes com batalha real, captura e expedição',()=>{
  it('mantém bolso não negativo e contabiliza corretamente entradas e tentativas de três iniciais',()=>{
    const report:Record<string,unknown>={};
    for(const starterId of [1,4,7]){
      let trainer:LevelProgress={level:1,xp:0};
      let pokemon:LevelProgress={level:2,xp:0};
      let coins=0;
      const caught=new Set<number>([starterId]);
      const winsByRegion=Array<number>(10).fill(0);
      let pocket:KantoBallPocketV1={
        version:1,quantities:{'poke-ball':12,'great-ball':0,'ultra-ball':0}
      };
      let progress:ExpeditionBallProgress=emptyExpeditionBallProgress();
      let wins=0,losses=0,draws=0,attempts=0,captures=0;
      let battleCoins=0,expeditionCoins=0,highestRegion=1;
      let pokeballCredits=12,greatballCredits=0,ultraballCredits=0;
      for(let i=0;i<60;i++){
        const region=[...KANTO_REGIONS].reverse().find(r=>
          trainer.level>=r.trainerUnlockLevel&&pokemon.level>=r.levelMin
        );
        expect(region).toBeDefined();
        if(!region)throw new Error('Desbloqueio sem região');
        highestRegion=Math.max(highestRegion,region.id);
        const seed=Math.imul((i+1)*17+starterId,2654435761)>>>0;
        const encounter=kantoRegionalEncounter(region.id,seed,pokemon.level);
        expect(encounter).not.toBeNull();
        if(!encounter)throw new Error('Encontro inválido');
        const original=KANTO_BATTLE_SPECIES[starterId]!;
        const foe=KANTO_BATTLE_SPECIES[encounter.speciesId]!;
        const player:Combatant={
          speciesId:original.id,name:original.name,types:original.types,
          level:pokemon.level,stats:pokemonOwnStats(
            original.base,pokemon.level,zeroStats()),
          move:original.move,rank:0
        };
        const wildMoves=kantoWildMoveLoadout(foe.id,encounter.level,foe.move);
        const wild:Combatant={
          speciesId:foe.id,name:foe.name,types:foe.types,
          level:encounter.level,stats:pokemonOwnStats(foe.base,encounter.level,zeroStats()),
          move:wildMoves[0]!,moves:wildMoves,rank:0
        };
        const battle=simulateKantoBattle(player,wild,seed);
        expect(battle.log.length).toBe(battle.frames.length);
        const factor=battleProgressFactor(pokemon.level,encounter.level);
        if(battle.outcome==='win'){
          wins++;
          const earnedCoins=scaledRegionalReward(25+3*encounter.level,factor);
          battleCoins+=earnedCoins;coins+=earnedCoins;
          trainer=grantXp('trainer',trainer,
            scaledRegionalReward(battleTrainerXp(encounter.level),factor));
          pokemon=grantXp('pokemon',pokemon,
            scaledRegionalReward(20+6*encounter.level,factor));
          if(factor>0){
            const regionWins=(winsByRegion[region.id-1]??0)+1;
            winsByRegion[region.id-1]=regionWins;
            const drop=d064DraftBallDrop(region.id,regionWins)!;
            const quantities={...pocket.quantities};
            for(const ball of ['poke-ball','great-ball','ultra-ball'] as const){
              quantities[ball]=(quantities[ball]??0)+drop[ball];
            }
            pocket={version:1,quantities};
            pokeballCredits+=drop['poke-ball'];
            greatballCredits+=drop['great-ball'];
            ultraballCredits+=drop['ultra-ball'];
          }
          if(!caught.has(foe.id)){
            const preferred:KantoBallId=region.rareSpeciesIds.includes(foe.id)
              ?'ultra-ball':(pocket.quantities['poke-ball']??0)>0
                ?'poke-ball':'great-ball';
            if((pocket.quantities[preferred]??0)>0){
              const result=resolveKantoCaptureAttempt({
                regionId:region.id,speciesId:foe.id,ballId:preferred,pocket,
                maxHp:battle.wildMaxHp,currentHp:0,
                seed:(seed^0xa5a5a5a5)>>>0
              });
              expect(result.status).toBe('resolved');
              if(result.status==='resolved'){
                pocket=result.pocket;attempts++;
                if(result.captured){caught.add(foe.id);captures++;}
              }
            }
          }
        }else if(battle.outcome==='loss'){losses++;}
        else{draws++;}
        if((i+1)%15===0){
          const area=[...KANTO_REGIONS].reverse().find(r=>
            trainer.level>=r.trainerUnlockLevel&&pokemon.level>=r.levelMin
          )!;
          const reward=expeditionRewards(2*60*60*1000,{
            regionId:area.id,pokemon:[pokemon],ballProgress:progress
          });
          expect(reward.affinityGainPerMember).toBe(0);
          trainer=grantXp('trainer',trainer,reward.trainerXp);
          pokemon=grantXp('pokemon',pokemon,reward.pokemonXpPerMember);
          progress={...reward.ballProgress!};
          coins+=reward.coins;expeditionCoins+=reward.coins;
          const drops=reward.ballDrops!;
          const quantities={...pocket.quantities};
          for(const ball of ['poke-ball','great-ball','ultra-ball'] as const){
            quantities[ball]=(quantities[ball]??0)+drops[ball];
          }
          pocket={version:1,quantities};
          pokeballCredits+=drops['poke-ball'];
          greatballCredits+=drops['great-ball'];
          ultraballCredits+=drops['ultra-ball'];
        }
        for(const kind of ['poke-ball','great-ball','ultra-ball'] as const){
          expect(pocket.quantities[kind]??0).toBeGreaterThanOrEqual(0);
        }
        expect(coins).toBeGreaterThanOrEqual(0);
      }
      expect(wins+losses+draws).toBe(60);
      expect(attempts).toBe(pokeballCredits+greatballCredits+ultraballCredits
        -(pocket.quantities['poke-ball']??0)
        -(pocket.quantities['great-ball']??0)
        -(pocket.quantities['ultra-ball']??0));
      expect(coins).toBe(battleCoins+expeditionCoins);
      expect(captures).toBe(caught.size-1);
      expect(ultraballCredits).toBe(0);
      report[String(starterId)]={
        wins,losses,draws,attempts,captures,uniqueSpecies:caught.size,
        coins,battleCoins,expeditionCoins,highestRegion,trainerLevel:trainer.level,
        pokemonLevel:pokemon.level,pocket:pocket.quantities
      };
    }
    (globalThis as unknown as {console:{info:(value:string)=>void}})
      .console.info('D064BN_MIXED_ECONOMY_REPORT '+JSON.stringify({
        type:'test-only, no player telemetry',scenario:'60 seeded encounters + 4 claims of 2h',
        winnerLoadout:'base species move, no upgrades/evolution/trainer bonuses',
        report
      }));
  },30000);
});
