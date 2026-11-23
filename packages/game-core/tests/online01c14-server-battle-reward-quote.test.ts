import {describe,expect,it} from 'vitest';
import {quoteFrozenBattleRewards,previewFrozenWildBattle} from '../src/index.js';

const zero=()=>({hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0});
const snapshot=(level=1,affinity=0)=>({
  version:1 as const,regionId:1 as const,
  trainer:{level:1,manual:zero()},
  activePokemon:{uid:1,speciesId:4,level,affinity,manual:zero(),moveName:'scratch'},
  opponent:{speciesId:10,level:2}
});
const outcomePreview=(outcome:'win'|'loss'|'draw')=>({
  outcome,turns:4,playerRemainingHp:1,wildRemainingHp:1,log:['fight'],
  frames:[{kind:'info'}]
});
describe('ONLINE-01C-14 — server reward quote parity (no grants)',()=>{
  it('matches /play regional win amounts, rolls and caps',()=>{
    for(let roll=0;roll<4;roll++){
      const q=quoteFrozenBattleRewards(snapshot(),outcomePreview('win'),roll)!;
      expect(q.coins).toBe(31);
      expect(q.trainerXp).toBe(56);
      expect(q.pokemonXp).toBe(32);
      expect(q.affinityDelta).toBe(2+roll);
      expect(q.progressFactorTenths).toBe(10);
      expect(q.wins).toBe(1);
      expect(q.losses).toBe(0);
      expect(q.draws).toBe(0);
      expect(q.battleRecordIncrement).toBe('win');
      expect(Object.hasOwn(q,'capture')).toBe(false);
      expect(Object.hasOwn(q,'pokeballs')).toBe(false);
    }
  });
  it('handles beginner loss/draw XP without imaginary coins or affinity',()=>{
    const loss=quoteFrozenBattleRewards(snapshot(1,2),outcomePreview('loss'),0)!;
    expect([loss.coins,loss.trainerXp,loss.pokemonXp,loss.affinityDelta])
      .toEqual([0,0,22,-2]);
    expect([loss.wins,loss.losses,loss.draws]).toEqual([0,1,0]);
    const draw=quoteFrozenBattleRewards(snapshot(1,1),outcomePreview('draw'),0)!;
    expect([draw.coins,draw.trainerXp,draw.pokemonXp,draw.affinityDelta])
      .toEqual([0,0,22,-1]);
    expect([draw.wins,draw.losses,draw.draws]).toEqual([0,1,1]);
    const experienced=quoteFrozenBattleRewards(snapshot(5),outcomePreview('loss'),0)!;
    expect(experienced.pokemonXp).toBe(0);
  });
  it('blocks farming by overlevel and forbids malformed inputs',()=>{
    const veteran=quoteFrozenBattleRewards(snapshot(14,5),outcomePreview('win'),3)!;
    expect(veteran.progressFactorTenths).toBe(0);
    expect([veteran.coins,veteran.trainerXp,veteran.pokemonXp,
      veteran.affinityDelta,veteran.wins]).toEqual([0,0,0,0,0]);
    expect(veteran.battleRecordIncrement).toBeNull();
    expect(quoteFrozenBattleRewards(snapshot(),outcomePreview('win'),-1)).toBeNull();
    expect(quoteFrozenBattleRewards(snapshot(),outcomePreview('win'),4)).toBeNull();
    expect(quoteFrozenBattleRewards(snapshot(),{outcome:'win'},1)).toBeNull();
    expect(quoteFrozenBattleRewards({...snapshot(),regionId:10},outcomePreview('win'),1)).toBeNull();
    const actual=previewFrozenWildBattle(snapshot(),123456)!;
    const quote=quoteFrozenBattleRewards(snapshot(),actual,2)!;
    expect(quote.outcome).toBe(actual.outcome);
  });
});
