import {describe,expect,it} from 'vitest';
import {KANTO_BATTLE_MOVES,simulateKantoBattle} from '../src/index.js';
import type {Combatant,KantoBattleResult} from '../src/index.js';

const stats={hp:320,attack:66,defense:105,specialAttack:72,specialDefense:100,speed:85};
const p:Combatant={speciesId:4,name:'Charmander',types:['fire'],level:20,stats,
  move:KANTO_BATTLE_MOVES.ember!,rank:0};
const w:Combatant={speciesId:7,name:'Squirtle',types:['water'],level:20,
  stats:{...stats,speed:25},move:KANTO_BATTLE_MOVES.tackle!,rank:0};

/** Regras verificáveis: trilha de HP produzida NA SIMULAÇÃO, nunca inferida do texto. */
function verifyFrames(result:KantoBattleResult) {
  expect(result.frames).toHaveLength(result.log.length);
  expect(result.frames[0]).toEqual({
    playerHp:result.playerMaxHp,wildHp:result.wildMaxHp,
    kind:'intro',target:null,amount:0
  });
  expect(result.frames.at(-1)?.playerHp).toBe(result.playerRemainingHp);
  expect(result.frames.at(-1)?.wildHp).toBe(result.wildRemainingHp);
  for(const [index,frame] of result.frames.entries()){
    expect(frame.playerHp).toBeGreaterThanOrEqual(0);
    expect(frame.playerHp).toBeLessThanOrEqual(result.playerMaxHp);
    expect(frame.wildHp).toBeGreaterThanOrEqual(0);
    expect(frame.wildHp).toBeLessThanOrEqual(result.wildMaxHp);
    expect(frame.amount).toBeGreaterThanOrEqual(0);
    const prev=result.frames[index-1];
    if(!prev)continue;
    const target=frame.target;
    const before=target==='player'?prev.playerHp:prev.wildHp;
    const after=target==='player'?frame.playerHp:frame.wildHp;
    if(frame.kind==='attack'||frame.kind==='residual'){
      expect(target).not.toBeNull();
      expect(before-after).toBe(frame.amount);
    }else if(frame.kind==='heal'){
      expect(target).not.toBeNull();
      expect(after-before).toBe(frame.amount);
    }else{
      expect(frame.playerHp).toBe(prev.playerHp);
      expect(frame.wildHp).toBe(prev.wildHp);
    }
  }
}
describe('timeline visual determinística alinhada ao diário',()=>{
  it('uma entrada por linha, HP máximo inicial, resultado idêntico e sem rolagens extras',()=>{
    for(const seed of [0,2,11,47,333,987654]){
      const result=simulateKantoBattle(p,w,seed);
      verifyFrames(result);
      expect(result.playerSpeciesId).toBe(4);
      expect(result.playerName).toBe('Charmander');
      expect(result.playerLevel).toBe(20);
      expect(result.playerMaxHp).toBe(stats.hp);
      expect(result.wildMaxHp).toBe(stats.hp);
      expect(simulateKantoBattle(p,w,seed)).toEqual(result);
      expect(result.frames.some(frame=>frame.kind==='attack'&&frame.amount>0)).toBe(true);
    }
  });
  it('dano residual e recuperação têm a variação exata na linha correspondente',()=>{
    const absorber:Combatant={...p,types:['grass'],move:KANTO_BATTLE_MOVES.absorb!,
      stats:{...stats,speed:50}};
    const poisoner:Combatant={...p,types:['poison'],move:KANTO_BATTLE_MOVES['poison-sting']!};
    let drained=false,residual=false;
    for(let seed=0;seed<200;seed++){
      const withDrain=simulateKantoBattle(absorber,w,seed);
      verifyFrames(withDrain);
      drained||=withDrain.frames.some(f=>f.kind==='heal'&&f.amount>0);
      const poisoned=simulateKantoBattle(poisoner,w,seed);
      verifyFrames(poisoned);
      residual||=poisoned.frames.some(f=>f.kind==='residual'&&f.amount>0);
      if(drained&&residual)break;
    }
    expect(drained).toBe(true);
    expect(residual).toBe(true);
  });
  it('golpes de suporte alteram status sem inventar perda de HP',()=>{
    const growl=KANTO_BATTLE_MOVES.scratch!;
    const support:Combatant={...p,move:{name:'growl',type:'normal',
      category:'status',power:0,accuracy:100,priority:0},
      moves:[{name:'growl',type:'normal',category:'status',power:0,accuracy:100,priority:0},growl]};
    const out=simulateKantoBattle(support,w,32);
    verifyFrames(out);
    const index=out.log.findIndex(line=>line.includes('usou growl'));
    expect(index).toBeGreaterThan(0);
    expect(out.frames[index]?.kind).toBe('status');
    expect(out.frames[index]?.wildHp).toBe(out.frames[index-1]?.wildHp);
  });
});
