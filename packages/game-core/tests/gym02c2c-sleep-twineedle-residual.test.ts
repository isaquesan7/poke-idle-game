import {describe,expect,it} from 'vitest';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {prepareGymOpponent} from '../src/gyms/gymTactics.js';
import {createGymBattleState,applyGymDamage,applyGymResidual} from '../src/gyms/gymBattleState.js';
import type {GymBattleState,GymSide} from '../src/gyms/gymBattleState.js';
import {gymApplySleep,gymTickSleep,gymApplyStatus} from '../src/gyms/gymEffects.js';
import {KANTO_BATTLE_MOVES} from '../src/combat/kantoBattle.js';
import {resolveGymTurn} from '../src/gyms/gymTurn.js';

const basic={kind:'basic'} as const;
function game():GymBattleState{
  const t=prepareGymOpponent(KANTO_GYMS[0]!).team;
  return createGymBattleState([
    {uid:101,combatant:t[0]},{uid:102,combatant:t[1]},
    {uid:103,combatant:t[2]}],t);
}
function ok(result:ReturnType<typeof resolveGymTurn>){
  expect(result.status).toBe('applied');
  if(result.status!=='applied')throw Error(result.reason);
  return result;
}
describe('GYM-02C2c: sono, Twineedle e nocaute residual',()=>{
  it('sono dura 1 a 3 ações próprias sem gastar SP; não envelhece na reserva',()=>{
    let state=gymApplySleep(game(),'leader',3);
    expect(state.leader.fighters[0]!.status).toBe('sleep');
    expect(state.leader.fighters[0]!.sleepActions).toBe(3);
    const hp=state.leader.fighters[0]!.hp;
    const sp=state.leader.fighters[0]!.sp;
    const forcedSwitch=resolveGymTurn(state,basic,{kind:'switch',toIndex:1},17);
    state=ok(forcedSwitch).state;
    expect(state.leader.fighters[0]!.sleepActions).toBe(3);
    expect(state.leader.fighters[0]!.hp).toBe(hp);
    state=ok(resolveGymTurn(state,basic,{kind:'switch',toIndex:0},18)).state;
    expect(state.leader.fighters[0]!.sleepActions).toBe(3);
    for(let i=0;i<3;i++){
      const before=state.leader.fighters[0]!.sp;
      const result=ok(resolveGymTurn(state,basic,basic,25+i));
      expect(result.log.some(x=>x.includes('leader está dormindo'))).toBe(true);
      state=result.state;
      expect(state.leader.fighters[0]!.sleepActions).toBe(2-i);
      expect(state.leader.fighters[0]!.sp).toBe(before);
    }
    expect(sp).toBeGreaterThanOrEqual(state.leader.fighters[0]!.sp);
    // Após a terceira ação perdida, acorda ANTES da quarta ação.
    state=gymTickSleep(state,'leader');
    expect(state.leader.fighters[0]!.status).toBeNull();
    expect(state.leader.fighters[0]!.sleepActions).toBe(0);
  });
  it('sono não sobrescreve status anterior e valida duração sem mutação',()=>{
    const state=gymApplyStatus(game(),'leader','poison');
    expect(gymApplySleep(state,'leader',2)).toBe(state);
    expect(()=>gymApplySleep(state,'leader',0)).toThrow();
    expect(()=>gymApplySleep(state,'leader',4)).toThrow();
  });
  it('Twineedle executa dois impactos, paga SP uma vez e rola poison por impacto',()=>{
    const base=prepareGymOpponent(KANTO_GYMS[0]!).team;
    const move=KANTO_BATTLE_MOVES['twineedle']!;
    expect(move.name).toBe('twineedle');
    const attacker={...base[0]!,move,moves:[move]};
    // Vida alta garante chance de rolar dois impactos sem KO antecipado.
    const tank={...base[0]!,types:['normal'],stats:{...base[0]!.stats,hp:700}};
    const initial=createGymBattleState([
      {uid:101,combatant:attacker},{uid:102,combatant:base[1]!},
      {uid:103,combatant:base[2]!}],[tank,base[1]!,base[2]!]);
    const outcomes=Array.from({length:180},(_,seed)=>
      resolveGymTurn(initial,{kind:'move',moveName:'twineedle'},basic,seed));
    const poisoned=outcomes.find(result=>result.status==='applied'
      &&result.state.leader.fighters[0]!.status==='poison');
    expect(poisoned).toBeDefined();
    if(poisoned?.status==='applied'){
      expect(poisoned.log.filter(x=>x.includes('usou twineedle')).length).toBe(2);
      expect(poisoned.log.filter(x=>x.includes('pelo impacto')).length).toBe(1);
      expect(poisoned.state.player.fighters[0]!.sp)
        .toBeLessThan(initial.player.fighters[0]!.sp);
      expect(poisoned.state.player.fighters[1]!.sp)
        .toBe(initial.player.fighters[1]!.sp);
      expect(poisoned.state.leader.fighters[0]!.hp).toBeLessThan(700);
    }
    expect(resolveGymTurn(initial,{kind:'move',moveName:'twineedle'},basic,91))
      .toEqual(resolveGymTurn(initial,{kind:'move',moveName:'twineedle'},basic,91));
  });
  it('residual simultâneo dos últimos Pokémon resulta em empate sem ganhador',()=>{
    const initial=game();
    const knockout=(side:GymSide)=>{
      const p=initial[side],fighters=[...p.fighters] as [
        typeof p.fighters[0],typeof p.fighters[1],typeof p.fighters[2]];
      fighters[0]={...fighters[0]!,hp:0};
      fighters[1]={...fighters[1]!,hp:0};
      fighters[2]={...fighters[2]!,hp:1,status:'poison'};
      return {...p,activeIndex:2,fighters};
    };
    const starting:GymBattleState={...initial,
      player:knockout('player'),leader:knockout('leader')};
    const result=applyGymResidual(starting,{player:9,leader:9});
    expect(result.outcome).toBe('draw');
    expect(result.player.fighters.map(f=>f.hp)).toEqual([0,0,0]);
    expect(result.leader.fighters.map(f=>f.hp)).toEqual([0,0,0]);
    expect(result.player.needsReplacement).toBe(false);
    expect(result.leader.needsReplacement).toBe(false);
    expect(resolveGymTurn(result,basic,basic,1).status).toBe('blocked');
    expect(starting.outcome).toBe('ongoing');
  });
  it('quando ambos os ativos caem e há reservas, ambos exigem troca gratuita',()=>{
    const state=game();
    const result=applyGymResidual(state,{
      player:state.player.fighters[0]!.hp,leader:state.leader.fighters[0]!.hp});
    expect(result.outcome).toBe('ongoing');
    expect(result.player.needsReplacement).toBe(true);
    expect(result.leader.needsReplacement).toBe(true);
    const switched=ok(resolveGymTurn(result,
      {kind:'switch',toIndex:1},{kind:'switch',toIndex:1},42));
    expect(switched.state.player.voluntarySwitchesUsed).toBe(0);
    expect(switched.state.leader.voluntarySwitchesUsed).toBe(0);
    expect(switched.state.player.fighters[0]!.hp).toBe(0);
    expect(switched.state.leader.fighters[0]!.hp).toBe(0);
  });
  it('12 confrontos completos com 3x3 terminam e mantêm os seis HPs legais',()=>{
    for(let seed=0;seed<12;seed++){
      let state=game(),rng=seed*701+1;
      for(let turn=0;turn<180&&state.outcome==='ongoing';turn++){
        const getAction=(side:GymSide)=>{
          const party=state[side];
          if(party.needsReplacement){
            const index=party.fighters.findIndex((f,i)=>f.hp>0&&i!==party.activeIndex);
            if(index<0)throw Error('substituição impossível');
            return {kind:'switch' as const,toIndex:index};
          }
          return basic;
        };
        const result=resolveGymTurn(state,getAction('player'),getAction('leader'),rng>>>0);
        expect(result.status).toBe('applied');
        if(result.status!=='applied')throw Error(result.reason);
        state=result.state;rng=result.seedAfter+turn+1;
        for(const side of ['player','leader'] as const){
          const team=state[side];
          expect(team.fighters).toHaveLength(3);
          for(const f of team.fighters){
            expect(f.hp).toBeGreaterThanOrEqual(0);
            expect(f.hp).toBeLessThanOrEqual(f.combatant.stats.hp);
            expect(f.sp).toBeGreaterThanOrEqual(0);
            expect(f.sp).toBeLessThanOrEqual(f.maxSp);
          }
        }
      }
      expect(state.outcome).not.toBe('ongoing');
    }
  });
});
