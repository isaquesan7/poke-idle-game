import {describe,it,expect} from 'vitest';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {prepareGymOpponent} from '../src/gyms/gymTactics.js';
import {createGymBattleState,spendGymSp,applyGymDamage,switchGymPokemon} from '../src/gyms/gymBattleState.js';
import {resolveGymTurn} from '../src/gyms/gymTurn.js';
import {KANTO_BATTLE_MOVES} from '../src/combat/kantoBattle.js';

const basic={kind:'basic'} as const;
function party(gymIndex=0){
  const team=prepareGymOpponent(KANTO_GYMS[gymIndex]!).team;
  return createGymBattleState([
    {uid:11,combatant:team[0]},{uid:12,combatant:team[1]},
    {uid:13,combatant:team[2]}],team);
}
function good<T extends {status:string}>(result:T):Extract<T,{status:'applied'}>{
  expect(result.status).toBe('applied');
  if(result.status!=='applied')throw Error('Ação bloqueada');
  return result as Extract<T,{status:'applied'}>;
}
describe('GYM-02C2 — recuperação deliberada e múltiplos impactos',()=>{
  it('Concentrar dá SP à instância, sem restabelecer HP, e usa uma ação',()=>{
    let state=party();
    state=applyGymDamage(state,'player',5);
    state=spendGymSp(state,'player',30);
    const hpBefore=state.player.fighters[0]!.hp;
    const spBefore=state.player.fighters[0]!.sp;
    const result=good(resolveGymTurn(state,{kind:'focus'},basic,3));
    expect(result.state.player.fighters[0]!.sp).toBeGreaterThan(spBefore);
    expect(result.state.player.fighters[0]!.focusUses).toBe(1);
    expect(result.state.player.fighters[0]!.hp).toBeLessThanOrEqual(hpBefore);
    expect(result.state.turn).toBe(1);
    expect(result.log.some(line=>line.includes('Concentrar'))).toBe(true);
  });
  it('limite de Concentrar não reseta ao recolher, nem pelo líder',()=>{
    let state=spendGymSp(party(),'leader',30);
    const first=good(resolveGymTurn(state,basic,{kind:'focus'},5));
    state=first.state;
    expect(state.leader.fighters[0]!.focusUses).toBe(1);
    const forbidden=resolveGymTurn(state,basic,{kind:'focus'},6);
    expect(forbidden.status).toBe('blocked');
    expect(forbidden.state).toBe(state);
    const changed=switchGymPokemon(state,'leader',1);
    state=good(changed).state;
    state=good(switchGymPokemon(state,'leader',0)).state;
    expect(state.leader.fighters[0]!.focusUses).toBe(1);
    expect(resolveGymTurn(state,basic,{kind:'focus'},7).status).toBe('blocked');
  });
  it('Recover restaura HP pelo golpe e gasta SP, mas não cura por troca',()=>{
    let state=party(1);
    const starmieIndex=2;
    // A ação de troca voluntária não cura os Pokémon inativos.
    state=good(switchGymPokemon(state,'leader',starmieIndex)).state;
    const starmie=state.leader.fighters[starmieIndex]!;
    expect(starmie.combatant.moves?.some(m=>m.name==='recover')).toBe(true);
    state=applyGymDamage(state,'leader',25);
    const before=state.leader.fighters[starmieIndex]!;
    const result=good(resolveGymTurn(state,basic,{kind:'move',moveName:'recover'},11));
    const after=result.state.leader.fighters[starmieIndex]!;
    expect(after.hp).toBeGreaterThan(before.hp);
    expect(after.hp).toBeLessThanOrEqual(after.combatant.stats.hp);
    expect(after.sp).toBeLessThan(before.sp);
    expect(result.state.leader.fighters[0]!.hp).toBe(
      state.leader.fighters[0]!.hp);
  });
  it('multi-hit custa SP uma vez e aplica até dois golpes, sem ressuscitar alvo',()=>{
    const base=prepareGymOpponent(KANTO_GYMS[0]!).team;
    const two=KANTO_BATTLE_MOVES['double-kick']!;
    expect(two).toBeDefined();
    const attacker={...base[0]!,move:two,moves:[two]};
    let state=createGymBattleState([
      {uid:1,combatant:attacker},{uid:2,combatant:base[1]!},
      {uid:3,combatant:base[2]!}],base);
    const beforeSp=state.player.fighters[0]!.sp;
    const result=good(resolveGymTurn(state,{kind:'move',moveName:'double-kick'},basic,42));
    state=result.state;
    expect(result.log.filter(x=>x.includes('double-kick')).length).toBe(2);
    expect(state.player.fighters[0]!.sp).toBeLessThan(beforeSp);
    expect(state.leader.fighters[0]!.hp).toBeLessThan(
      state.leader.fighters[0]!.combatant.stats.hp);
  });
  it('status/efeito secundário ainda não resolvido é rejeitado, sem SP perdido',()=>{
    const state=party(1);
    const active=state.player.fighters[0]!;
    const secondary=active.combatant.moves?.find(m=>m.name==='confusion');
    // A etapa não tenta inventar suporte à confusão.
    if(!secondary){
      const attempt=resolveGymTurn(state,{kind:'move',moveName:'confusion'},basic,15);
      expect(attempt.status).toBe('blocked');
      expect(attempt.state).toBe(state);
    }
  });
});
