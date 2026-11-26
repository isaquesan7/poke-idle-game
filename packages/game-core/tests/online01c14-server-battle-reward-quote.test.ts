import {describe,expect,it} from 'vitest';
import {quoteFrozenBattleRewards,previewFrozenWildBattle} from '../src/index.js';

const zero=()=>({hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0});
const snapshot=(level=1,affinity=0)=>({
  version:1 as const,regionId:1 as const,
  trainer:{equipped:{},title:'aprendiz',wins:0,seen:[4],badges:[],inventory:{version:1 as const,gear:[],extraBagSlots:0},level:1,manual:zero()},
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
  it('credits half of a victory on defeat, keeps draw policy and excludes coins/balls',()=>{
    const loss=quoteFrozenBattleRewards(snapshot(1,2),outcomePreview('loss'),0)!;
    expect([loss.coins,loss.trainerXp,loss.pokemonXp,loss.affinityDelta])
      .toEqual([0,28,16,-2]);
    expect(loss.ballDropId).toBeNull();
    expect([loss.wins,loss.losses,loss.draws]).toEqual([0,1,0]);
    const draw=quoteFrozenBattleRewards(snapshot(1,1),outcomePreview('draw'),0)!;
    expect([draw.coins,draw.trainerXp,draw.pokemonXp,draw.affinityDelta])
      .toEqual([0,0,22,-1]);
    expect([draw.wins,draw.losses,draw.draws]).toEqual([0,1,1]);
    const experienced=quoteFrozenBattleRewards(snapshot(5),outcomePreview('loss'),0)!;
    expect(experienced.pokemonXp).toBe(14);
    expect(experienced.trainerXp).toBe(25);
    const overlevel=quoteFrozenBattleRewards(snapshot(14),outcomePreview('loss'),0,0)!;
    expect([overlevel.trainerXp,overlevel.pokemonXp,overlevel.coins,overlevel.ballDropId]).toEqual([0,0,0,null]);
  });
  it('blocks XP and coin progression by overlevel and forbids malformed inputs',()=>{
    const veteran=quoteFrozenBattleRewards(snapshot(14,5),outcomePreview('win'),3)!;
    expect(veteran.progressFactorTenths).toBe(0);
    expect([veteran.coins,veteran.trainerXp,veteran.pokemonXp,
      veteran.affinityDelta,veteran.wins]).toEqual([0,0,0,0,0]);
    expect(veteran.battleRecordIncrement).toBeNull();
    const capped=quoteFrozenBattleRewards(snapshot(1,99),outcomePreview('win'),3)!;
    expect(capped.affinityDelta).toBe(1);
    expect(quoteFrozenBattleRewards(snapshot(),outcomePreview('win'),-1)).toBeNull();
    expect(quoteFrozenBattleRewards(snapshot(),outcomePreview('win'),4)).toBeNull();
    expect(quoteFrozenBattleRewards(snapshot(),{outcome:'win'},1)).toBeNull();
    expect(quoteFrozenBattleRewards({...snapshot(),regionId:10},outcomePreview('win'),1)).toBeNull();
    const actual=previewFrozenWildBattle(snapshot(),123456)!;
    const quote=quoteFrozenBattleRewards(snapshot(),actual,2)!;
    expect(quote.outcome).toBe(actual.outcome);
  });
});

it('applies only family XP after regional scaling; other rewards remain identical',()=>{
 const base=snapshot(2),plain=quoteFrozenBattleRewards(base,outcomePreview('win'),0)!;
 const mastered=quoteFrozenBattleRewards({...base,masteryPoints:{'4':100}},outcomePreview('win'),0)!;
 expect(mastered).toEqual({...plain,pokemonXp:Math.floor(plain.pokemonXp*1.1)});
 expect(quoteFrozenBattleRewards({...base,masteryPoints:{'7':100}},outcomePreview('win'),0)).toEqual(plain);
 expect(quoteFrozenBattleRewards({...snapshot(14),masteryPoints:{'4':100}},outcomePreview('win'),0)?.pokemonXp).toBe(0);
 expect(quoteFrozenBattleRewards({...base,masteryPoints:{'5':100}},outcomePreview('win'),0)).toBeNull();
});
