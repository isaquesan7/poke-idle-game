import {describe,expect,it} from 'vitest';
import {expeditionRewards,EXPEDITION_CYCLE_MS} from '../src/rewards/expedition.js';

describe('D064BS — XP da expedição exclusivo do líder',()=>{
  it('preserva moedas, XP do treinador e bolas, sem progredir reservas',()=>{
    const leader={level:20,xp:0};
    const reserves=[{level:20,xp:0},{level:21,xp:0}];
    const rewards=expeditionRewards(60*EXPEDITION_CYCLE_MS,{
      regionId:3,pokemon:[leader,...reserves]
    });
    expect(rewards.cycles).toBe(60);
    expect(rewards.pokemonXpByMember).toHaveLength(3);
    expect(rewards.pokemonXpByMember?.[0]).toBeGreaterThan(0);
    expect(rewards.pokemonXpByMember?.slice(1)).toEqual([0,0]);
    expect(rewards.pokemonXpPerMember).toBe(rewards.pokemonXpByMember?.[0]);
    expect(rewards.trainerXp).toBeGreaterThan(0);
    expect(rewards.coins).toBeGreaterThan(0);
    expect(rewards.affinityGainPerMember).toBe(0);
  });
  it('mantém XP zero no líder nível 100 e não transfere para reservas',()=>{
    const rewards=expeditionRewards(8*60*60*1000,{
      regionId:10,pokemon:[{level:100,xp:0},{level:80,xp:0},{level:85,xp:0}]
    });
    expect(rewards.pokemonXpByMember).toEqual([0,0,0]);
  });
  it('não concede XP duas vezes com tempo menor que um ciclo',()=>{
    const rewards=expeditionRewards(EXPEDITION_CYCLE_MS-1,{
      regionId:1,pokemon:[{level:1,xp:0},{level:1,xp:0}]
    });
    expect(rewards.cycles).toBe(0);
    expect(rewards.pokemonXpByMember).toEqual([0,0]);
  });
});

it('mastery credits fractional XP deterministically across claim boundaries, never after overlevel',()=>{
 const ctx={regionId:1,pokemon:[{level:2,xp:0}],masteryXpPercent:10};
 const one=expeditionRewards(EXPEDITION_CYCLE_MS,ctx);
 expect(one.pokemonXpPerMember).toBe(5);expect(one.masteryXpRemainder).toBe(50);
 const two=expeditionRewards(EXPEDITION_CYCLE_MS,{...ctx,pokemon:[{level:2,xp:5}],masteryXpRemainder:one.masteryXpRemainder!});
 expect(two.pokemonXpPerMember).toBe(6);
 expect(expeditionRewards(2*EXPEDITION_CYCLE_MS,ctx).pokemonXpPerMember).toBe(11);
 expect(expeditionRewards(100*EXPEDITION_CYCLE_MS,{...ctx,pokemon:[{level:100,xp:0}]}).pokemonXpPerMember).toBe(0);
 expect(expeditionRewards(100*EXPEDITION_CYCLE_MS,{...ctx,pokemon:[{level:22,xp:0}]}).pokemonXpPerMember).toBe(0);
});
