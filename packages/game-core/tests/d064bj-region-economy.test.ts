import {describe,expect,it} from 'vitest';
import {
  KANTO_REGIONS,expeditionRewards,expeditionRegionRates,battleProgressFactor,
  expeditionProgressFactor,EXPEDITION_CYCLE_MS,MAX_EXPEDITION_CYCLES,
  emptyExpeditionBallProgress,grantXp
} from '../src/index.js';
const EIGHT_HOURS=8*60*60*1000;
const normal=(regionId:number,level:number,ballProgress=emptyExpeditionBallProgress())=>
  expeditionRewards(EIGHT_HOURS,{regionId,pokemon:[{level,xp:0}],ballProgress});

describe('D064BJ — recompensas progressivas e anti-farm',()=>{
  it('a taxa base da expedição cresce de modo moderado em todas as 10 áreas',()=>{
    for(const [i,region] of KANTO_REGIONS.entries()){
      const rates=expeditionRegionRates(region.id);
      expect(rates).toEqual({coins:7+i,trainerXp:4+i,pokemonXp:5+i});
    }
  });
  it('até dois níveis de diferença concedem 100%; a redução chega a zero após 12',()=>{
    expect(battleProgressFactor(10,10)).toBe(1);
    expect(battleProgressFactor(12,10)).toBe(1);
    expect(battleProgressFactor(13,10)).toBe(.9);
    expect(battleProgressFactor(17,10)).toBe(.5);
    expect(battleProgressFactor(21,10)).toBe(.1);
    expect(battleProgressFactor(22,10)).toBe(0);
    expect(battleProgressFactor(90,2)).toBe(0);
    expect(expeditionProgressFactor(1,12)).toBe(1);
    expect(expeditionProgressFactor(1,22)).toBe(0);
    expect(expeditionProgressFactor(9,92)).toBe(1);
    expect(expeditionProgressFactor(9,100)).toBe(.2);
  });
  it('Pokémon Lv90 não consegue farmar uma expedição no Bosque Inicial',()=>{
    const reward=normal(1,90);
    expect(reward.cycles).toBe(MAX_EXPEDITION_CYCLES);
    expect(reward.coins).toBe(0);
    expect(reward.trainerXp).toBe(0);
    expect(reward.pokemonXpPerMember).toBe(0);
    expect(reward.affinityGainPerMember).toBe(0);
    expect(reward.ballDrops).toEqual(emptyExpeditionBallProgress());
  });
  it('XP da expedição é recalculado ciclo a ciclo, sem ultrapassar o teto Lv22 da área 1',()=>{
    const reward=normal(1,2);
    const progressed=grantXp('pokemon',{level:2,xp:0},reward.pokemonXpPerMember);
    expect(progressed.level).toBeLessThanOrEqual(22);
    expect(reward.pokemonXpPerMember).toBeLessThan(14400);
    expect(reward.coins).toBeLessThan(20160);
    expect(reward.trainerXp).toBeLessThan(11520);
    expect(reward.affinityGainPerMember).toBe(0);
  });
  it('Poké Balls pequenas; Great só em R5+, Ultra só em R9 e R10',()=>{
    const lvl=(region:number)=>KANTO_REGIONS[region-1]!.levelMin;
    for(let id=1;id<=10;id++){
      const value=normal(id,lvl(id));
      expect(value.ballDrops?.['great-ball']??0).toBe(id<5?0:1);
      expect(value.ballDrops?.['ultra-ball']).toBe(0); // requer 24h elegíveis
      expect(value.ballDrops?.['poke-ball']).toBeGreaterThanOrEqual(1);
      expect(value.ballDrops?.['poke-ball']).toBeLessThanOrEqual(2);
    }
    const boost=normal(9,81,{'poke-ball':0,'great-ball':0,'ultra-ball':5760});
    expect(boost.ballDrops?.['ultra-ball']).toBe(1);
    const ten=normal(10,91,{'poke-ball':0,'great-ball':0,'ultra-ball':5760});
    expect(ten.ballDrops?.['ultra-ball']).toBe(1);
  });
  it('contadores de bolas persistem entre resgates, sem ganho ao reenviar um evento',()=>{
    const ctx={regionId:9,pokemon:[{level:81,xp:0}]};
    const a=expeditionRewards(EIGHT_HOURS,{...ctx,ballProgress:emptyExpeditionBallProgress()});
    const b=expeditionRewards(EIGHT_HOURS,{...ctx,ballProgress:a.ballProgress??emptyExpeditionBallProgress()});
    const c=expeditionRewards(EIGHT_HOURS,{...ctx,ballProgress:b.ballProgress??emptyExpeditionBallProgress()});
    expect(a.ballDrops?.['ultra-ball']).toBe(0);
    expect(b.ballDrops?.['ultra-ball']).toBe(0);
    expect(c.ballDrops?.['ultra-ball']).toBe(1);
  });
  it('garante 8 horas máximas por resgate e não usa afinidade de expedição',()=>{
    expect(expeditionRewards(EIGHT_HOURS+7*EIGHT_HOURS).cycles).toBe(MAX_EXPEDITION_CYCLES);
    expect(expeditionRewards(EXPEDITION_CYCLE_MS*3).affinityGainPerMember).toBe(0);
    expect(expeditionRewards(EIGHT_HOURS).trainerXp).toBe(11520); // legado sem região
  });
});
