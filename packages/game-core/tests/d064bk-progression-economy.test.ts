import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,expeditionRewards,emptyExpeditionBallProgress,
  grantXp,xpThreshold,EXPEDITION_CYCLE_MS,MAX_EXPEDITION_CYCLES,
  expeditionProgressFactor
} from '../src/index.js';

const CLAIM_MS=EXPEDITION_CYCLE_MS*MAX_EXPEDITION_CYCLES;
const regionForLevel=(level:number)=>{
  // Modelo ideal: não supõe que a região esteja liberada pelo treinador.
  return [...KANTO_REGIONS].reverse().find(region=>region.levelMin<=level)??KANTO_REGIONS[0]!;
};

describe('D064BK — auditoria determinística da economia de expedições',()=>{
  it('simula todos os níveis iniciais 1..100 sem extrapolar cap de XP ou conceder afinidade',()=>{
    for(let startingLevel=1;startingLevel<=100;startingLevel++){
      const region=regionForLevel(startingLevel);
      const progress={level:startingLevel,xp:0};
      const rewards=expeditionRewards(CLAIM_MS,{
        regionId:region.id,pokemon:[progress],ballProgress:emptyExpeditionBallProgress()
      });
      const after=grantXp('pokemon',progress,rewards.pokemonXpPerMember);
      expect(rewards.affinityGainPerMember).toBe(0);
      expect(after.level).toBeGreaterThanOrEqual(startingLevel);
      expect(after.level).toBeLessThanOrEqual(100);
      expect(rewards.coins).toBeGreaterThanOrEqual(0);
      expect(rewards.trainerXp).toBeGreaterThanOrEqual(0);
      expect(rewards.ballDrops?.['ultra-ball']??0).toBe(0);
      if(startingLevel===100){
        expect(rewards.pokemonXpPerMember).toBe(0);
        expect(after).toMatchObject({level:100,xp:0});
      }
      if(expeditionProgressFactor(region.id,startingLevel)===0){
        expect(rewards.coins).toBe(0);
        expect(rewards.trainerXp).toBe(0);
        expect(rewards.ballDrops).toEqual(emptyExpeditionBallProgress());
      }
    }
  });
  it('repete resgates de oito horas com cursor de bola persistente, sem recompensa duplicada',()=>{
    let pokemon={level:1,xp:0},trainer={level:1,xp:0};
    let ballProgress=emptyExpeditionBallProgress();
    let totalCoins=0,totalBalls=0;
    for(let claim=0;claim<40;claim++){
      const region=regionForLevel(pokemon.level);
      const earned=expeditionRewards(CLAIM_MS,{regionId:region.id,pokemon:[pokemon],ballProgress});
      expect(earned.cycles).toBe(MAX_EXPEDITION_CYCLES);
      expect(earned.affinityGainPerMember).toBe(0);
      expect(earned.ballProgress).toBeDefined();
      pokemon=grantXp('pokemon',pokemon,earned.pokemonXpPerMember);
      trainer=grantXp('trainer',trainer,earned.trainerXp);
      ballProgress={...earned.ballProgress!};
      totalCoins+=earned.coins;
      totalBalls+=Object.values(earned.ballDrops!).reduce((a,b)=>a+b,0);
      expect(pokemon.level).toBeLessThanOrEqual(100);
      expect(trainer.level).toBeLessThanOrEqual(100);
      if(pokemon.level===100)expect(pokemon.xp).toBe(0);
    }
    expect(totalCoins).toBeGreaterThan(0);
    expect(totalBalls).toBeGreaterThan(0);
    expect(ballProgress['poke-ball']).toBeGreaterThanOrEqual(1440);
    expect(trainer.level).toBeGreaterThan(1);
    expect(pokemon.level).toBeGreaterThan(1);
  });
  it('requer muito mais XP no fim da curva do treinador sem alterar fórmula publicada',()=>{
    expect(xpThreshold('trainer',99)).toBeGreaterThan(xpThreshold('trainer',1)*100);
    expect(grantXp('trainer',{level:100,xp:0},100000)).toMatchObject({level:100,xp:0});
  });
});
