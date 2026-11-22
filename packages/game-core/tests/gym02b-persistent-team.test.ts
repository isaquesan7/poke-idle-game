import {describe,expect,it} from 'vitest';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {prepareGymOpponent} from '../src/gyms/gymTactics.js';
import {GYM_SWITCH_RULES,createGymBattleState,applyGymDamage,
  spendGymSp,switchGymPokemon,gymTeamIsDefeated} from '../src/gyms/gymBattleState.js';
import type {GymBattleState,GymSide} from '../src/gyms/gymBattleState.js';

function initial():GymBattleState{
  const leader=prepareGymOpponent(KANTO_GYMS[0]!).team;
  return createGymBattleState(
    [{uid:101,combatant:leader[0]},{uid:102,combatant:leader[1]},
      {uid:103,combatant:leader[2]}],leader
  );
}
function applied(state:GymBattleState,side:GymSide,index:number){
  const result=switchGymPokemon(state,side,index);
  expect(result.status).toBe('applied');
  if(result.status!=='applied')throw Error(result.reason);
  return result;
}
describe('GYM-02B — HP persistente e recuos com SP limitado',()=>{
  it('não cura HP após KO, retorno ou entrada de outro Pokémon',()=>{
    let state=initial();
    const max=state.player.fighters[0]!.hp;
    state=applyGymDamage(state,'player',7);
    const switched=applied(state,'player',1);
    state=switched.state;
    expect(switched.recoveredSp).toBe(0);
    expect(state.player.fighters[0]!.hp).toBe(max-7);
    state=applied(state,'player',0).state;
    expect(state.player.fighters[0]!.hp).toBe(max-7);
    expect(state.player.fighters[1]!.hp).toBe(
      state.player.fighters[1]!.combatant.stats.hp);
  });
  it('recolhimento voluntário restaura 20% uma única vez por Pokémon',()=>{
    let state=spendGymSp(initial(),'player',30);
    const max=state.player.fighters[0]!.maxSp;
    const before=state.player.fighters[0]!.sp;
    const first=applied(state,'player',1);
    expect(first.recoveredSp).toBe(Math.min(30,Math.floor(max*.2)));
    state=first.state;
    expect(state.player.fighters[0]!.sp).toBe(before+first.recoveredSp);
    expect(state.player.fighters[0]!.retreatRecoveriesUsed).toBe(1);
    state=applied(state,'player',0).state;
    state=spendGymSp(state,'player',10);
    const afterSpend=state.player.fighters[0]!.sp;
    const second=applied(state,'player',2);
    expect(second.recoveredSp).toBe(0);
    expect(second.state.player.fighters[0]!.sp).toBe(afterSpend);
    expect(second.state.player.fighters[0]!.retreatRecoveriesUsed).toBe(1);
  });
  it('troca voluntária tem teto de três por lado; quarta é negada sem mutação',()=>{
    let state=initial();
    expect(GYM_SWITCH_RULES.maxVoluntarySwitchesPerSide).toBe(3);
    state=applied(state,'player',1).state;
    state=applied(state,'player',0).state;
    state=applied(state,'player',2).state;
    const before=JSON.stringify(state);
    const denied=switchGymPokemon(state,'player',0);
    expect(denied.status).toBe('blocked');
    expect(denied.state).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('KO exige substituição, sem cura/SP, sem gastar troca voluntária',()=>{
    let state=spendGymSp(initial(),'leader',30);
    const fullHp=state.leader.fighters[0]!.hp;
    state=applyGymDamage(state,'leader',fullHp);
    expect(state.leader.needsReplacement).toBe(true);
    expect(state.leader.fighters[0]!.hp).toBe(0);
    expect(()=>spendGymSp(state,'leader',1)).toThrow();
    const forced=applied(state,'leader',1);
    expect(forced.recoveredSp).toBe(0);
    expect(forced.state.leader.voluntarySwitchesUsed).toBe(0);
    expect(forced.state.leader.fighters[0]!.sp).toBe(
      forced.state.leader.fighters[0]!.maxSp-30);
    expect(forced.state.leader.fighters[0]!.retreatRecoveriesUsed).toBe(0);
    expect(switchGymPokemon(forced.state,'leader',0).status).toBe('blocked');
  });
  it('quando os três caem, há vitória sem reviver ou permitir troca',()=>{
    let state=initial();
    for(let index=0;index<3;index++){
      state=applyGymDamage(state,'leader',state.leader.fighters[index]!.hp);
      if(index<2)state=applied(state,'leader',index+1).state;
    }
    expect(gymTeamIsDefeated(state,'leader')).toBe(true);
    expect(state.outcome).toBe('player-win');
    expect(switchGymPokemon(state,'leader',0).status).toBe('blocked');
    expect(()=>applyGymDamage(state,'player',1)).toThrow();
    expect(state.leader.fighters.every(p=>p.hp===0)).toBe(true);
  });
  it('líder e jogador seguem os mesmos limites de recuperação',()=>{
    let state=initial();
    state=spendGymSp(state,'player',25);
    state=spendGymSp(state,'leader',25);
    const p=applied(state,'player',1);
    const l=applied(p.state,'leader',1);
    expect(l.recoveredSp).toBe(p.recoveredSp);
    expect(l.state.leader.fighters[0]!.hp).toBe(
      state.leader.fighters[0]!.hp);
    expect(l.state.player.fighters[0]!.hp).toBe(
      state.player.fighters[0]!.hp);
  });
});
