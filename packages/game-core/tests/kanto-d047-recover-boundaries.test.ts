import {describe,expect,it} from 'vitest';
import {
  KANTO_BATTLE_MOVES,KANTO_SUPPORT_MOVES,kantoMaxSp,kantoMoveSpCost,
  simulateKantoBattle
} from '../src/index.js';
import type {Combatant,KantoBattleResult} from '../src/index.js';

/**
 * D-047: adversários ARTIFICIAIS com dano elevado e HP alto para forçar
 * limiar crítico em vez de depender de encontros naturais (normalmente
 * terminam em 3–5 turnos). A versão de teste com Mega Kick NÃO é um
 * learnset legítimo de Staryu: só testa o contrato SP do motor isolado,
 * sem jamais equipar, exportar ou ensinar este golpe via writer.
 */
const recover=KANTO_SUPPORT_MOVES.recover!;
const tackle=KANTO_BATTLE_MOVES.tackle!;
const heavy=KANTO_BATTLE_MOVES['mega-kick']!;
const SEEDS=[0,1,7,19,31,53,107,169,239,345,777,1024,4556,99991,149331,987654] as const;

function staryu(move:typeof tackle):Combatant{
  return {
    speciesId:120,name:'Staryu',types:['water'],level:15,
    stats:{hp:250,attack:50,defense:30,specialAttack:50,
      specialDefense:50,speed:100},
    move,moves:[move,recover],rank:0
  };
}
function foe(attack:number):Combatant{
  return {
    speciesId:19,name:'Rattata',types:['normal'],level:15,
    stats:{hp:5000,attack,defense:800,specialAttack:50,
      specialDefense:800,speed:10},
    move:tackle,rank:0
  };
}
function audit(result:KantoBattleResult){
  expect(result.frames).toHaveLength(result.log.length);
  const heals=result.frames.filter(f=>f.actor==='player'
    &&f.moveName==='recover');
  expect(heals.length).toBeLessThanOrEqual(1);
  for(let i=0;i<result.frames.length;i++){
    const frame=result.frames[i]!;
    expect(frame.playerHp).toBeGreaterThanOrEqual(0);
    expect(frame.playerHp).toBeLessThanOrEqual(result.playerMaxHp);
    expect(frame.wildHp).toBeGreaterThanOrEqual(0);
    expect(frame.wildHp).toBeLessThanOrEqual(result.wildMaxHp);
    expect(frame.playerSp).toBeGreaterThanOrEqual(0);
    expect(frame.playerSp).toBeLessThanOrEqual(result.playerMaxSp);
    expect(frame.wildSp).toBeGreaterThanOrEqual(0);
    expect(frame.wildSp).toBeLessThanOrEqual(result.wildMaxSp);
    if(frame.actor==='player'&&frame.moveName==='recover'){
      const prev=result.frames[i-1]!;
      expect(frame.kind).toBe('heal');
      expect(frame.spCost).toBe(36);
      expect(prev.playerSp!-frame.playerSp!).toBe(36);
      expect(prev.playerHp).toBeLessThanOrEqual(result.playerMaxHp/2);
      expect(frame.playerHp-prev.playerHp).toBe(frame.amount);
      expect(frame.amount).toBeLessThanOrEqual(Math.floor(result.playerMaxHp/2));
      expect(frame.wildHp).toBe(prev.wildHp);
      expect(Number(/^T(\d+)/.exec(result.log[i]!)?.[1]))
        .toBeLessThanOrEqual(26);
    }
  }
  return heals.length;
}
describe('D-047 — Recover em HP crítico, insuficiência SP e ausência de loop',()=>{
  it('aos 50% HP recupera somente se ainda tem 36 SP, no máximo 1 vez',()=>{
    expect(kantoMoveSpCost(recover)).toBe(36);
    expect(kantoMaxSp(15,120)).toBe(50);
    expect(kantoMoveSpCost(tackle)).toBeLessThanOrEqual(14);
    const player=staryu(tackle),wild=foe(650);
    let used=0,critical=0;
    for(const seed of SEEDS){
      const result=simulateKantoBattle(player,wild,seed);
      const count=audit(result);
      used+=count;
      critical+=Number(result.frames.some(f=>f.playerHp>0
        &&f.playerHp<=result.playerMaxHp/2));
      if(count>0){
        expect(result.frames.some(f=>f.actor==='player'&&f.kind==='heal'
          &&f.moveName==='recover')).toBe(true);
      }
    }
    expect(critical).toBeGreaterThan(0);
    expect(used).toBeGreaterThan(0);
  });

  it('sem 36 SP nunca autoriza Recover, mesmo após HP crítico',()=>{
    expect(kantoMoveSpCost(heavy)).toBe(40);
    const player=staryu(heavy),wild=foe(650);
    let exhausted=0;
    for(const seed of SEEDS){
      const result=simulateKantoBattle(player,wild,seed);
      expect(audit(result)).toBe(0);
      if(result.frames.some(f=>f.playerHp>0
        &&f.playerHp<=result.playerMaxHp/2
        &&f.playerSp!==undefined&&f.playerSp<36)){
        exhausted++;
        // O histórico não inventa uma cura recusada (sem SP);
        // no máximo aparece ataque básico ou Concentrar.
        expect(result.frames.some(f=>f.actor==='player'
          &&f.moveName==='recover')).toBe(false);
      }
      expect(simulateKantoBattle(player,wild,seed)).toEqual(result);
    }
    expect(exhausted).toBeGreaterThan(0);
  });

  it('não cura quando HP continua alto, mesmo com movimento disponível',()=>{
    const player=staryu(tackle);
    const result=simulateKantoBattle(player,foe(1),107);
    expect(audit(result)).toBe(0);
    expect(result.frames.filter(f=>f.kind==='heal'&&f.actor==='player')).toHaveLength(0);
  });
});
