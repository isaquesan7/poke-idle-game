import {describe,expect,it} from 'vitest';
import {
  KANTO_BASIC_ATTACK,KANTO_SP_BALANCE,KANTO_BATTLE_MOVES,KANTO_SUPPORT_MOVES,
  kantoMaxSp,kantoMoveSpCost,simulateKantoBattle
} from '../src/index.js';
import type {Combatant,KantoBattleResult} from '../src/index.js';

const durable={hp:100000,attack:1,defense:10000,
  specialAttack:1,specialDefense:10000,speed:25};
const fighter=(name:string,move:Combatant['move'],level=1,
  extra:Partial<Combatant>={}):Combatant=>({
  speciesId:name==='A'?4:7,name,level,types:['normal'],stats:durable,
  move,rank:0,...extra
});
function verifySp(result:KantoBattleResult){
  expect(result.playerMaxSp).toBe(kantoMaxSp(result.playerLevel));
  expect(result.frames).toHaveLength(result.log.length);
  expect(result.frames[0]?.playerSp).toBe(result.playerMaxSp);
  expect(result.frames[0]?.wildSp).toBe(result.wildMaxSp);
  expect(result.frames.at(-1)?.playerSp).toBe(result.playerRemainingSp);
  expect(result.frames.at(-1)?.wildSp).toBe(result.wildRemainingSp);
  for(let i=0;i<result.frames.length;i++){
    const frame=result.frames[i]!;
    expect(frame.playerSp).toBeGreaterThanOrEqual(0);
    expect(frame.wildSp).toBeGreaterThanOrEqual(0);
    expect(frame.playerSp).toBeLessThanOrEqual(result.playerMaxSp);
    expect(frame.wildSp).toBeLessThanOrEqual(result.wildMaxSp);
    if(i===0)continue;
    const prev=result.frames[i-1]!;
    const pLoss=prev.playerSp!-frame.playerSp!;
    const wLoss=prev.wildSp!-frame.wildSp!;
    expect(pLoss).toBeGreaterThanOrEqual(0);
    expect(wLoss).toBeGreaterThanOrEqual(0);
    const expected=frame.spCost??0;
    expect(pLoss+wLoss).toBe(expected);
    if(frame.actor==='player')expect(pLoss).toBe(expected);
    if(frame.actor==='wild')expect(wLoss).toBe(expected);
    if(frame.moveName==='basic-attack')expect(frame.spCost).toBe(0);
  }
}

describe('D-037: reserva SP própria, diferenciada do PP da PokéAPI',()=>{
  it('SP progride por nível; custos são públicos e mais altos para efeitos/controle',()=>{
    expect(KANTO_SP_BALANCE.skillIntervalTurns).toBe(2);
    expect(kantoMaxSp(1)).toBe(40);
    expect(kantoMaxSp(20)).toBe(45);
    expect(kantoMaxSp(40)).toBe(50);
    expect(kantoMaxSp(100)).toBe(65);
    expect(()=>kantoMaxSp(0)).toThrow();
    expect(()=>kantoMaxSp(101)).toThrow();
    expect(()=>kantoMaxSp(2.4)).toThrow();
    expect(kantoMoveSpCost(KANTO_BASIC_ATTACK)).toBe(0);
    expect(KANTO_BASIC_ATTACK.power).toBe(30);
    expect(kantoMoveSpCost(KANTO_BATTLE_MOVES.tackle!)).toBe(14);
    expect(kantoMoveSpCost(KANTO_BATTLE_MOVES.ember!)).toBe(18);
    expect(kantoMoveSpCost(KANTO_BATTLE_MOVES.absorb!)).toBe(16);
    expect(kantoMoveSpCost(KANTO_BATTLE_MOVES['quick-attack']!)).toBe(17);
    expect(kantoMoveSpCost(KANTO_SUPPORT_MOVES.growl!)).toBe(16);
    expect(kantoMoveSpCost(KANTO_SUPPORT_MOVES['tail-whip']!)).toBe(16);
    expect(kantoMoveSpCost(KANTO_SUPPORT_MOVES['poison-powder']!)).toBe(22);
    expect(kantoMoveSpCost(KANTO_SUPPORT_MOVES['thunder-wave']!)).toBe(24);
    expect(()=>kantoMoveSpCost({...KANTO_BASIC_ATTACK,power:999})).toThrow();
  });
  it('gasta SP em habilidades, intercala básico e não fica negativo em 30 turnos',()=>{
    const a=fighter('A',KANTO_BATTLE_MOVES.tackle!);
    const b=fighter('B',KANTO_BATTLE_MOVES.tackle!,1,{stats:{...durable,speed:10}});
    const result=simulateKantoBattle(a,b,123);
    verifySp(result);
    expect(result.turns).toBe(30);
    expect(result.outcome).toBe('draw');
    expect(result.playerRemainingSp).toBe(12);
    expect(result.wildRemainingSp).toBe(12);
    expect(result.log.some(x=>x.includes('SP suficiente'))).toBe(true);
    expect(result.log.some(x=>x.includes('usou ataque básico'))).toBe(true);
    expect(result.frames.filter(f=>f.actor==='player'&&f.spCost===14)).toHaveLength(2);
    expect(result.frames.filter(f=>f.actor==='wild'&&f.spCost===14)).toHaveLength(2);
    expect(simulateKantoBattle(a,b,123)).toEqual(result);
  });
  it('suporte cobra SP, depois recupera ataque básico e nunca gasta em replay',()=>{
    const a=fighter('A',KANTO_SUPPORT_MOVES.growl!,20,{
      moves:[KANTO_SUPPORT_MOVES.growl!,KANTO_BATTLE_MOVES.scratch!],
      stats:{...durable,speed:30}});
    const b=fighter('B',KANTO_BATTLE_MOVES.tackle!,20);
    const result=simulateKantoBattle(a,b,333);
    verifySp(result);
    const growl=result.frames.find(f=>f.moveName==='growl'&&f.actor==='player');
    expect(growl?.spCost).toBe(16);
    expect(result.log.some(s=>s.includes('usou growl'))).toBe(true);
    expect(result.log.some(s=>s.includes('usou scratch'))).toBe(true);
    expect(result.log.some(s=>s.includes('usou ataque básico'))).toBe(true);
  });
  it('erro cobra SP antes de validar precisão; paralisia impede ação sem cobrança',()=>{
    // Poder alto + precisão baixa ainda faz a IA tentar o golpe;
    // um erro deve consumir SP de forma observável.
    const miss={...KANTO_BATTLE_MOVES.tackle!,power:200,accuracy:30};
    const a=fighter('A',miss,20,{stats:{...durable,speed:100}});
    const b=fighter('B',KANTO_BATTLE_MOVES.tackle!,20);
    let chargedMiss=false;
    for(let seed=0;seed<20;seed++){
      const result=simulateKantoBattle(a,b,seed);
      verifySp(result);
      chargedMiss||=result.frames.some(f=>f.kind==='miss'
        &&f.actor==='player'&&f.spCost===27);
      if(chargedMiss)break;
    }
    expect(chargedMiss).toBe(true);
    // Efeitos podem ou não ocorrer em determinada seed, porém frames de
    // impossibilidade de ação nunca devem debitar SP do combatente.
    const electric=fighter('B',KANTO_SUPPORT_MOVES['thunder-wave']!,20,{
      types:['electric'],moves:[KANTO_SUPPORT_MOVES['thunder-wave']!,KANTO_BATTLE_MOVES.tackle!],
      stats:{...durable,speed:150}});
    let seen=false;
    for(let seed=0;seed<160;seed++){
      const attempt=simulateKantoBattle(a,electric,seed);
      verifySp(attempt);
      const index=attempt.log.findIndex(line=>line.includes('não conseguiu agir'));
      if(index<0)continue;
      const curr=attempt.frames[index]!,prev=attempt.frames[index-1]!;
      expect(curr.playerSp).toBe(prev.playerSp);
      expect(curr.wildSp).toBe(prev.wildSp);
      seen=true;break;
    }
    expect(seen).toBe(true);
  });
  it('a captura, seed e dano seguem coerentes para os dois combatentes',()=>{
    const a=fighter('A',KANTO_BATTLE_MOVES.ember!,35,{
      types:['fire'],stats:{...durable,hp:140,attack:100,specialAttack:100,specialDefense:80,speed:200}});
    const b=fighter('B',KANTO_BATTLE_MOVES.tackle!,35,{
      stats:{...durable,hp:140,attack:80,defense:70,specialDefense:70,speed:60}});
    for(const seed of [0,1,2,66,255]){
      const res=simulateKantoBattle(a,b,seed);
      verifySp(res);
      for(const frame of res.frames){
        if(frame.kind==='attack'){
          expect(typeof frame.critical).toBe('boolean');
          expect(typeof frame.effectiveness).toBe('number');
          expect(frame.moveType).toMatch(/fire|normal/);
        }
      }
    }
  });
});
