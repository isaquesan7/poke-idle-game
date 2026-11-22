import {describe,it,expect} from 'vitest';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {prepareGymOpponent} from '../src/gyms/gymTactics.js';
import {createGymBattleState,applyGymDamage,switchGymPokemon} from '../src/gyms/gymBattleState.js';
import {gymApplyStatus,gymDropStat,gymDamageStat} from '../src/gyms/gymEffects.js';
import {resolveGymTurn} from '../src/gyms/gymTurn.js';
import {KANTO_BATTLE_MOVES} from '../src/combat/kantoBattle.js';
import {KANTO_SUPPORT_MOVES} from '../src/catalog/kantoSupportMoves.js';

const basic={kind:'basic'} as const;
function team(){
  const t=prepareGymOpponent(KANTO_GYMS[0]!).team;
  return createGymBattleState([
    {uid:1,combatant:t[0]},{uid:2,combatant:t[1]},{uid:3,combatant:t[2]}
  ],t);
}
function applied<T extends {status:string}>(r:T):Extract<T,{status:'applied'}>{
  expect(r.status).toBe('applied');
  if(r.status!=='applied')throw new Error('Esperava ação aplicada.');
  return r as Extract<T,{status:'applied'}>;
}
function equip(state:ReturnType<typeof team>,name:string){
  const move=KANTO_SUPPORT_MOVES[name]??KANTO_BATTLE_MOVES[name];
  if(!move)throw Error('Golpe inexistente '+name);
  const fighters=[...state.player.fighters] as [
    typeof state.player.fighters[0],typeof state.player.fighters[1],typeof state.player.fighters[2]
  ];
  const mon=fighters[0]!;
  fighters[0]={...mon,combatant:{...mon.combatant,move,moves:[move]}};
  return {...state,player:{...state.player,fighters}};
}
describe('GYM-02C2b — status individual simétrico',()=>{
  it('aplica veneno com golpe de suporte e causa dano residual por turno',()=>{
    const state=equip(team(),'poison-powder');
    const before=state.leader.fighters[0]!.hp;
    const r=applied(resolveGymTurn(state,{kind:'move',moveName:'poison-powder'},basic,1));
    expect(r.state.leader.fighters[0]!.status).toBe('poison');
    expect(r.state.leader.fighters[0]!.hp).toBeLessThan(before);
    expect(state.leader.fighters[0]!.status).toBeNull();
  });
  it('veneno e debuffs ficam ligados à instância após recolher e retornar',()=>{
    let state=gymApplyStatus(team(),'leader','poison');
    state=gymDropStat(state,'leader','attackDrops');
    state=applied(switchGymPokemon(state,'leader',1)).state;
    expect(state.leader.fighters[0]!.status).toBe('poison');
    expect(state.leader.fighters[0]!.effects?.attackDrops).toBe(1);
    state=applied(switchGymPokemon(state,'leader',0)).state;
    expect(state.leader.fighters[0]!.status).toBe('poison');
    expect(state.leader.fighters[0]!.effects?.attackDrops).toBe(1);
    expect(state.leader.fighters[0]!.hp).toBe(
      state.leader.fighters[0]!.combatant.stats.hp);
  });
  it('imunidade a queimadura para Fire e a veneno para Poison/Steel',()=>{
    const state=team();
    const mon=state.player.fighters[0]!;
    const fire={...mon,combatant:{...mon.combatant,types:['fire']}};
    const poison={...mon,combatant:{...mon.combatant,types:['poison']}};
    let s={...state,player:{...state.player,fighters:[fire,mon,mon] as [
      typeof mon,typeof mon,typeof mon]}};
    s=gymApplyStatus(s,'player','burn');
    expect(s.player.fighters[0]!.status).toBeNull();
    s={...state,player:{...state.player,fighters:[poison,mon,mon] as [
      typeof mon,typeof mon,typeof mon]}};
    s=gymApplyStatus(s,'player','poison');
    expect(s.player.fighters[0]!.status).toBeNull();
  });
  it('paralisia pode impedir a ação antes de consumir SP, deterministicamente',()=>{
    let state=equip(team(),'tackle');
    state=gymApplyStatus(state,'player','paralysis');
    const move={kind:'move',moveName:'tackle'} as const;
    const results=Array.from({length:64},(_,seed)=>resolveGymTurn(state,move,basic,seed));
    const skipped=results.find(r=>r.status==='applied'&&
      r.log.some(line=>line.includes('paralisado e perdeu a ação')));
    expect(skipped).toBeDefined();
    if(skipped?.status==='applied'){
      expect(skipped.state.player.fighters[0]!.sp).toBe(
        state.player.fighters[0]!.sp);
    }
    expect(resolveGymTurn(state,move,basic,17)).toEqual(
      resolveGymTurn(state,move,basic,17));
  });
  it('aplica debuff até o teto de seis estágios, sem tocar HP/SP',()=>{
    let s=team();
    const initial=s.leader.fighters[0]!;
    for(let i=0;i<9;i++)s=gymDropStat(s,'leader','defenseDrops');
    expect(s.leader.fighters[0]!.effects?.defenseDrops).toBe(6);
    expect(s.leader.fighters[0]!.hp).toBe(initial.hp);
    expect(s.leader.fighters[0]!.sp).toBe(initial.sp);
    expect(gymDamageStat(90,6)).toBe(22);
  });
  it('golpes com sono ou efeito por impacto ainda bloqueados sem gastar SP',()=>{
    const s=equip(team(),'sleep-powder');
    const r=resolveGymTurn(s,{kind:'move',moveName:'sleep-powder'},basic,1);
    expect(r.status).toBe('blocked');
    expect(r.state).toBe(s);
  });
  it('queimadura do ativo gera dano residual; reservas não perdem HP sozinhas',()=>{
    let s=team();
    s=gymApplyStatus(s,'player','burn');
    const before=s.player.fighters.map(f=>f.hp);
    const r=applied(resolveGymTurn(s,basic,basic,8));
    expect(r.state.player.fighters[0]!.hp).toBeLessThan(before[0]!);
    expect(r.state.player.fighters[1]!.hp).toBe(before[1]);
    expect(r.state.player.fighters[2]!.hp).toBe(before[2]);
  });
});
