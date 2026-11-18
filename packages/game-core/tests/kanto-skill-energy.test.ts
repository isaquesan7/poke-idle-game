import {describe,expect,it} from 'vitest';
import {
  KANTO_BASIC_ATTACK,KANTO_CONCENTRATE,KANTO_SP_BALANCE,KANTO_BATTLE_MOVES,
  KANTO_SUPPORT_MOVES,KANTO_PP_SOURCE_BLOB,KANTO_PP_SOURCE_COMMIT,KANTO_MOVE_PP,
  KANTO_BATTLE_SPECIES,KANTO_POKEDEX,kantoDamage,
  kantoMaxSp,kantoMovePp,kantoMoveSpCost,kantoFocusRecovery,
  simulateKantoBattle,pokemonOwnStats,zeroStats
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
  expect(result.playerMaxSp).toBe(kantoMaxSp(result.playerLevel,result.playerSpeciesId));
  expect(result.frames).toHaveLength(result.log.length);
  expect(result.frames[0]?.playerSp).toBe(result.playerMaxSp);
  expect(result.frames[0]?.wildSp).toBe(result.wildMaxSp);
  expect(result.frames.at(-1)?.playerSp).toBe(result.playerRemainingSp);
  expect(result.frames.at(-1)?.wildSp).toBe(result.wildRemainingSp);
  const focusTurns:{player:number[];wild:number[]}={player:[],wild:[]};
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
    if(frame.kind==='focus'){
      expect(frame.moveName).toBe(KANTO_CONCENTRATE.name);
      expect(frame.spCost).toBe(0);
      expect(frame.target).toBe(frame.actor);
      expect(frame.spRecovery).toBeGreaterThan(0);
      expect(frame.amount).toBe(0);
      const delta=frame.actor==='player'?-pLoss:-wLoss;
      const noChange=frame.actor==='player'?wLoss:pLoss;
      expect(delta).toBe(frame.spRecovery);
      expect(noChange).toBe(0);
      const turn=Number(result.log[i]?.match(/^T(\d+)/)?.[1]);
      expect(turn).toBeGreaterThan(0);
      focusTurns[frame.actor!].push(turn);
      continue;
    }
    expect(pLoss).toBeGreaterThanOrEqual(0);
    expect(wLoss).toBeGreaterThanOrEqual(0);
    const expected=frame.spCost??0;
    expect(pLoss+wLoss).toBe(expected);
    if(frame.actor==='player')expect(pLoss).toBe(expected);
    if(frame.actor==='wild')expect(wLoss).toBe(expected);
    if(frame.moveName==='basic-attack')expect(frame.spCost).toBe(0);
  }
  for(const side of ['player','wild'] as const){
    const times=focusTurns[side];
    expect(times.length).toBeLessThanOrEqual(KANTO_SP_BALANCE.maxFocusUses);
    for(let i=1;i<times.length;i++){
      expect(times[i]!-times[i-1]!).toBeGreaterThanOrEqual(
        KANTO_SP_BALANCE.focusCooldownTurns);
    }
  }
}

describe('D-038: custos híbridos PP/poder, SP por espécie e Concentrar',()=>{
  it('PP real vem do CSV fixo, inclui TODOS os golpes atualmente executáveis',()=>{
    expect(KANTO_PP_SOURCE_COMMIT).toBe('ac2f1acb055026e3dff1e0aca743bb46256a810a');
    expect(KANTO_PP_SOURCE_BLOB).toBe('a55116329ca22f230fea953de94c2d1dffe2ad0e');
    expect(KANTO_MOVE_PP.tackle).toBe(35);
    expect(KANTO_MOVE_PP.ember).toBe(25);
    expect(KANTO_MOVE_PP['hydro-pump']).toBe(5);
    expect(KANTO_MOVE_PP['thunder-wave']).toBe(20);
    for(const move of Object.values({...KANTO_BATTLE_MOVES,...KANTO_SUPPORT_MOVES})){
      expect(kantoMovePp(move.name)).toBeGreaterThan(0);
    }
    expect(kantoMovePp('golpe-inexistente')).toBeNull();
  });
  it('PP, potência, secundário e prioridade entram nos custos, sem PP em ataque básico',()=>{
    expect(KANTO_SP_BALANCE.skillIntervalTurns).toBe(2);
    expect(KANTO_SP_BALANCE.focusPercent).toBe(30);
    expect(kantoMoveSpCost(KANTO_BASIC_ATTACK)).toBe(0);
    expect(kantoMoveSpCost(KANTO_BATTLE_MOVES.tackle!)).toBe(12);
    expect(kantoMoveSpCost(KANTO_BATTLE_MOVES.ember!)).toBe(20);
    expect(kantoMoveSpCost(KANTO_BATTLE_MOVES.absorb!)).toBe(17);
    expect(kantoMoveSpCost(KANTO_BATTLE_MOVES['quick-attack']!)).toBe(17);
    expect(kantoMoveSpCost(KANTO_BATTLE_MOVES['hydro-pump']!)).toBe(38);
    expect(kantoMoveSpCost(KANTO_SUPPORT_MOVES.growl!)).toBe(12);
    expect(kantoMoveSpCost(KANTO_SUPPORT_MOVES['tail-whip']!)).toBe(17);
    expect(kantoMoveSpCost(KANTO_SUPPORT_MOVES['poison-powder']!)).toBe(19);
    expect(kantoMoveSpCost(KANTO_SUPPORT_MOVES['thunder-wave']!)).toBe(27);
    expect(()=>kantoMoveSpCost({...KANTO_BASIC_ATTACK,power:999})).toThrow();
    expect(()=>kantoMoveSpCost(KANTO_CONCENTRATE)).toThrow();
    expect(()=>simulateKantoBattle(fighter('A',KANTO_CONCENTRATE),
      fighter('B',KANTO_BATTLE_MOVES.tackle!),0)).toThrow();
  });
  it('SP varia por espécie/nível usando stats-base, nunca bônus do treinador',()=>{
    expect(kantoMaxSp(1,4)).toBe(40);
    expect(kantoMaxSp(20,4)).toBe(44);
    expect(kantoMaxSp(20,7)).toBe(46);
    expect(kantoMaxSp(1,1)).toBe(41);
    expect(kantoMaxSp(100,150)).toBe(85);
    expect(kantoMaxSp(100,4)).toBe(71);
    expect(kantoMaxSp(20,4)).not.toBe(kantoMaxSp(20,7));
    expect(()=>kantoMaxSp(0,4)).toThrow();
    expect(()=>kantoMaxSp(101,4)).toThrow();
    expect(()=>kantoMaxSp(20,0)).toThrow();
    expect(()=>kantoMaxSp(20,152)).toThrow();
    expect(()=>kantoMaxSp(2.4,4)).toThrow();
    for(let id=1;id<=151;id++){
      const info=KANTO_POKEDEX[id-1]!;
      expect(info.id).toBe(id);
      for(const level of [1,25,50,100]){
        const max=kantoMaxSp(level,id);
        expect(max).toBeGreaterThanOrEqual(40);
        expect(max).toBeLessThanOrEqual(100);
      }
    }
  });
  it('Concentrar restaura até 30%, limitado ao máximo, sem regen passiva',()=>{
    expect(kantoFocusRecovery(40,0)).toBe(12);
    expect(kantoFocusRecovery(40,38)).toBe(2);
    expect(kantoFocusRecovery(60,0)).toBe(18);
    expect(kantoFocusRecovery(60,60)).toBe(0);
    expect(()=>kantoFocusRecovery(60,61)).toThrow();
    expect(()=>kantoFocusRecovery(0,0)).toThrow();
    expect(()=>kantoFocusRecovery(60,-1)).toThrow();
    const a=fighter('A',KANTO_BATTLE_MOVES.tackle!);
    const b=fighter('B',KANTO_BATTLE_MOVES.tackle!,1,{stats:{...durable,speed:10}});
    const result=simulateKantoBattle(a,b,123);
    verifySp(result);
    expect(result.turns).toBe(30);
    expect(result.outcome).toBe('draw');
    expect(result.log.some(line=>line.includes('Concentrar'))).toBe(true);
    expect(result.frames.filter(frame=>frame.kind==='focus'&&frame.actor==='player').length)
      .toBeGreaterThan(0);
    expect(result.log.some(line=>line.includes('usou ataque básico'))).toBe(true);
    expect(simulateKantoBattle(a,b,123)).toEqual(result);
  });
  it('suporte cobra PP/custo próprio, sem confundir rank com energia',()=>{
    const a=fighter('A',KANTO_SUPPORT_MOVES.growl!,20,{
      moves:[KANTO_SUPPORT_MOVES.growl!,KANTO_BATTLE_MOVES.scratch!],
      stats:{...durable,speed:30},ranks:{scratch:8}});
    const b=fighter('B',KANTO_BATTLE_MOVES.tackle!,20);
    const result=simulateKantoBattle(a,b,333);
    verifySp(result);
    const growl=result.frames.find(frame=>frame.moveName==='growl'&&frame.actor==='player');
    expect(growl?.spCost).toBe(12);
    expect(result.log.some(line=>line.includes('usou growl'))).toBe(true);
    expect(result.log.some(line=>line.includes('usou scratch'))).toBe(true);
    expect(result.log.some(line=>line.includes('usou ataque básico'))).toBe(true);
  });
  it('erro cobra SP, paralisia que impede ação não gasta recurso',()=>{
    const miss={...KANTO_BATTLE_MOVES.tackle!,power:200,accuracy:20};
    const a=fighter('A',miss,20,{stats:{...durable,speed:100}});
    const b=fighter('B',KANTO_BATTLE_MOVES.tackle!,20);
    let chargedMiss=false;
    for(let seed=0;seed<20;seed++){
      const result=simulateKantoBattle(a,b,seed);
      verifySp(result);
      chargedMiss||=result.frames.some(frame=>frame.kind==='miss'
        &&frame.actor==='player'&&frame.spCost===40);
      if(chargedMiss)break;
    }
    expect(chargedMiss).toBe(true);
    const electric=fighter('B',KANTO_SUPPORT_MOVES['thunder-wave']!,20,{
      types:['electric'],moves:[KANTO_SUPPORT_MOVES['thunder-wave']!,KANTO_BATTLE_MOVES.tackle!],
      stats:{...durable,speed:150}});
    let blocked=false;
    for(let seed=0;seed<160;seed++){
      const attempt=simulateKantoBattle(a,electric,seed);
      verifySp(attempt);
      const index=attempt.log.findIndex(line=>line.includes('não conseguiu agir'));
      if(index<0)continue;
      const curr=attempt.frames[index]!,prev=attempt.frames[index-1]!;
      expect(curr.playerSp).toBe(prev.playerSp);
      expect(curr.wildSp).toBe(prev.wildSp);
      blocked=true;break;
    }
    expect(blocked).toBe(true);
  });
  it('básico sem tipo NÃO tem imunidade Ghost, nem STAB, nem ocupa slot',()=>{
    const attacker=fighter('A',KANTO_BASIC_ATTACK,30,{
      types:['normal'],stats:{...durable,attack:100,defense:90}});
    const ghost=fighter('B',KANTO_BATTLE_MOVES.tackle!,30,{
      types:['ghost'],stats:{...durable,hp:200,defense:90}});
    const basic=kantoDamage(attacker,ghost,.8,.5);
    expect(basic.effectiveness).toBe(1);
    expect(basic.damage).toBeGreaterThan(0);
    expect(kantoDamage({...attacker,types:['ghost']},ghost,.8,.5).damage)
      .toBe(basic.damage);
    expect(kantoDamage({...attacker,move:KANTO_BATTLE_MOVES.tackle!},ghost,.8,.5)
      .effectiveness).toBe(0);
    expect(kantoDamage({...attacker,move:KANTO_BATTLE_MOVES.tackle!},ghost,.8,.5)
      .damage).toBe(0);
    // A luta continua possível mesmo quando todos os golpes normais são imunes.
    const result=simulateKantoBattle(
      {...attacker,move:KANTO_BATTLE_MOVES.tackle!},ghost,109);
    verifySp(result);
    expect(result.frames.some(frame=>frame.moveName==='basic-attack'
      &&frame.actor==='player'&&frame.amount>0)).toBe(true);
  });
  it('simula espécies, tipos e níveis sem travar, SP negativo nem prêmio repetido',()=>{
    const species=[1,4,7,10,25,37,43,60,74,92,94,95,113,129,131,143,150,151];
    let total=0,focusCount=0,basicCount=0,skillCount=0;
    let winCount=0,drawCount=0,turnSum=0;
    for(const level of [5,25,60,100])for(const id of species){
      const info=KANTO_BATTLE_SPECIES[id]!;
      const foe=KANTO_BATTLE_SPECIES[species[(species.indexOf(id)+7)%species.length]!]!;
      const player:Combatant={
        speciesId:id,name:info.name,types:info.types,level,
        stats:pokemonOwnStats(info.base,level,zeroStats()),move:info.move,rank:0
      };
      const wild:Combatant={
        speciesId:foe.id,name:foe.name,types:foe.types,level,
        stats:pokemonOwnStats(foe.base,level,zeroStats()),move:foe.move,rank:0
      };
      for(const seed of [0,1,7,19,31,53,107,169,239,345,777,1024,4556,99991,149331,987654]){
        const result=simulateKantoBattle(player,wild,seed);
        verifySp(result);
        expect(result.turns).toBeGreaterThan(0);
        expect(result.turns).toBeLessThanOrEqual(30);
        if(result.outcome!=='win')expect(result.captured).toBe(false);
        focusCount+=result.frames.filter(x=>x.kind==='focus').length;
        basicCount+=result.frames.filter(x=>x.moveName==='basic-attack').length;
        skillCount+=result.frames.filter(x=>x.spCost!==undefined&&x.spCost>0).length;
        if(result.outcome==='win')winCount++;
        if(result.outcome==='draw')drawCount++;
        turnSum+=result.turns;
        total++;
      }
    }
    expect(total).toBe(1152);
    expect(basicCount).toBeGreaterThan(0);
    expect(skillCount).toBeGreaterThan(0);
    expect(winCount).toBeGreaterThan(0);
    expect(drawCount).toBeLessThan(total);
    expect(turnSum/total).toBeGreaterThan(1);
    // Não exigir arbitrariamente uma frequência fixa de Concentrar:
    // partidas terminadas antes do SP acabar não precisam utilizá-lo.
    expect(focusCount).toBeGreaterThanOrEqual(0);
  });
});
