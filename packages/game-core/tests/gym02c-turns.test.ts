import {describe,it,expect} from 'vitest';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {prepareGymOpponent} from '../src/gyms/gymTactics.js';
import {createGymBattleState,spendGymSp,applyGymDamage} from '../src/gyms/gymBattleState.js';
import {resolveGymTurn} from '../src/gyms/gymTurn.js';

const basic={kind:'basic'} as const;
function setup(){
  const mons=prepareGymOpponent(KANTO_GYMS[0]!).team;
  return createGymBattleState([
    {uid:11,combatant:mons[0]},{uid:12,combatant:mons[1]},
    {uid:13,combatant:mons[2]}],mons);
}
describe('GYM-02C1 — turnos determinísticos 3x3',()=>{
  it('troca custa ação e o adversário ainda pode atingir o recém-chegado',()=>{
    const state=setup();
    const initialHp=state.player.fighters[1]!.hp;
    const result=resolveGymTurn(state,{kind:'switch',toIndex:1},basic,14);
    expect(result.status).toBe('applied');
    if(result.status!=='applied')return;
    expect(result.state.player.activeIndex).toBe(1);
    expect(result.state.player.voluntarySwitchesUsed).toBe(1);
    expect(result.state.player.fighters[0]!.hp).toBe(state.player.fighters[0]!.hp);
    expect(result.state.player.fighters[1]!.hp).toBeLessThan(initialHp);
    expect(result.log.some(text=>text.includes('ação consumida'))).toBe(true);
    expect(state.player.activeIndex).toBe(0);
  });
  it('SP/HP mantidos por membro nas trocas; oponente não ganha HP após KO',()=>{
    let state=spendGymSp(setup(),'player',20);
    const before=state.player.fighters[0]!.sp;
    const exchange=resolveGymTurn(state,{kind:'switch',toIndex:1},basic,7);
    expect(exchange.status).toBe('applied');
    if(exchange.status!=='applied')return;
    state=exchange.state;
    expect(state.player.fighters[0]!.sp).toBeGreaterThan(before);
    expect(state.player.fighters[0]!.hp).toBe(
      exchange.state.player.fighters[0]!.combatant.stats.hp);
    const original=state.player.fighters[0]!.sp;
    const returnTurn=resolveGymTurn(state,{kind:'switch',toIndex:0},basic,11);
    expect(returnTurn.status).toBe('applied');
    if(returnTurn.status!=='applied')return;
    expect(returnTurn.state.player.fighters[0]!.sp).toBe(original);
  });
  it('troca forçada após KO não dá turno grátis nem SP ao derrotado',()=>{
    let state=setup();
    const leaderSp=state.leader.fighters[0]!.sp;
    state=applyGymDamage(state,'leader',state.leader.fighters[0]!.hp);
    const invalid=resolveGymTurn(state,basic,basic,1);
    expect(invalid.status).toBe('blocked');
    expect(invalid.state).toBe(state);
    const valid=resolveGymTurn(state,basic,{kind:'switch',toIndex:1},1);
    expect(valid.status).toBe('applied');
    if(valid.status!=='applied')return;
    expect(valid.state.leader.fighters[0]!.hp).toBe(0);
    expect(valid.state.leader.fighters[0]!.sp).toBe(leaderSp);
    expect(valid.state.leader.voluntarySwitchesUsed).toBe(0);
    expect(valid.state.player.fighters[0]!.hp).toBe(
      state.player.fighters[0]!.hp);
    expect(valid.state.leader.needsReplacement).toBe(false);
  });
  it('ação paga sem SP e suporte não implementado são recusados sem alterações',()=>{
    let state=setup();
    const move=state.player.fighters[0]!.combatant.move;
    state=spendGymSp(state,'player',state.player.fighters[0]!.sp);
    const bad=resolveGymTurn(state,{kind:'move',moveName:move.name},basic,1);
    expect(bad.status).toBe('blocked');
    expect(bad.state).toBe(state);
    expect(resolveGymTurn(state,{kind:'move',moveName:'recover'},basic,1).status)
      .toBe('blocked');
  });
  it('mesma seed e ações produzem estado e log idênticos',()=>{
    const state=setup();
    const a=resolveGymTurn(state,basic,basic,123456);
    const b=resolveGymTurn(state,basic,basic,123456);
    expect(a).toEqual(b);
    expect(state.player.fighters[0]!.hp).toBe(state.player.fighters[0]!.combatant.stats.hp);
  });
  it('após derrota total, nenhuma rodada adicional pode acontecer',()=>{
    let state=setup();
    for(let index=0;index<3;index++){
      state=applyGymDamage(state,'leader',state.leader.fighters[index]!.hp);
      if(index<2){
        const replacement=resolveGymTurn(state,basic,{kind:'switch',toIndex:index+1},25);
        expect(replacement.status).toBe('applied');
        if(replacement.status!=='applied')return;
        state=replacement.state;
      }
    }
    expect(state.outcome).toBe('player-win');
    expect(resolveGymTurn(state,basic,basic,1).status).toBe('blocked');
  });
});
