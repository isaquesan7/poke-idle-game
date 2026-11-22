import {describe,it,expect} from 'vitest';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {prepareGymOpponent} from '../src/gyms/gymTactics.js';
import {createGymBattleState,spendGymSp,applyGymDamage} from '../src/gyms/gymBattleState.js';
import type {GymBattleState} from '../src/gyms/gymBattleState.js';
import {gymChooseAiAction,resolveGymAiTurn} from '../src/gyms/gymAiTurn.js';
import {gymLegalTurnActions,resolveGymTurn,GYM_MAX_TURNS}
  from '../src/gyms/gymTurn.js';
const basic={kind:'basic'} as const;
function match(index:number):GymBattleState{
  const team=prepareGymOpponent(KANTO_GYMS[index]!).team;
  return createGymBattleState([
    {uid:11,combatant:team[0]},{uid:12,combatant:team[1]},
    {uid:13,combatant:team[2]}],team);
}
function legalAction(state:GymBattleState,side:'player'|'leader'){
  const chosen=gymChooseAiAction(state,side);
  expect(gymLegalTurnActions(state,side)).toContainEqual(chosen);
  return chosen;
}
describe('GYM-02D — IA com mesma autoridade de ações 3×3',()=>{
  it('ao KO da equipe, escolhe reserva consciente e não gasta troca/SP',()=>{
    let state=match(0);
    state=applyGymDamage(state,'leader',state.leader.fighters[0]!.hp);
    const before=state.leader.fighters[0]!.sp;
    const selected=legalAction(state,'leader');
    expect(selected.kind).toBe('switch');
    const response=resolveGymAiTurn(state,basic,17);
    expect(response.status).toBe('applied');
    if(response.status!=='applied')return;
    expect(response.state.leader.voluntarySwitchesUsed).toBe(0);
    expect(response.state.leader.fighters[0]!.hp).toBe(0);
    expect(response.state.leader.fighters[0]!.sp).toBe(before);
    expect(response.state.player.fighters[0]!.hp).toBe(
      state.player.fighters[0]!.hp);
    expect(response.state.turn).toBe(state.turn);
  });
  it('não pode gastar quota extra de troca ou usar Concentrar em cooldown',()=>{
    let state=spendGymSp(match(1),'leader',20);
    state={...state,turn:2,leader:{...state.leader,
      voluntarySwitchesUsed:3,
      fighters:[
        {...state.leader.fighters[0]!,focusUses:2,lastFocusTurn:1},
        state.leader.fighters[1]!,state.leader.fighters[2]!
      ]}};
    const available=gymLegalTurnActions(state,'leader');
    expect(available.some(a=>a.kind==='switch'||a.kind==='focus')).toBe(false);
    const chosen=legalAction(state,'leader');
    expect(chosen.kind==='switch'||chosen.kind==='focus').toBe(false);
    expect(resolveGymAiTurn(state,basic,2).status).toBe('applied');
  });
  it('limite de 120 rodadas dá empate técnico, não vitória por HP',()=>{
    const state={...match(0),turn:GYM_MAX_TURNS-1};
    const result=resolveGymTurn(state,basic,basic,2);
    expect(result.status).toBe('applied');
    if(result.status!=='applied')return;
    expect(result.state.turn).toBe(GYM_MAX_TURNS);
    expect(result.state.outcome).toBe('draw');
    expect(result.log.some(x=>x.includes('Empate técnico'))).toBe(true);
    expect(resolveGymAiTurn(result.state,basic,2).status).toBe('blocked');
  });
  it('rodada forçada não avança contador nem concede ataque gratuito',()=>{
    let state=match(2);
    state=applyGymDamage(state,'player',state.player.fighters[0]!.hp);
    const result=resolveGymTurn(state,legalAction(state,'player'),
      legalAction(state,'leader'),44);
    expect(result.status).toBe('applied');
    if(result.status!=='applied')return;
    expect(result.state.turn).toBe(state.turn);
    expect(result.state.player.voluntarySwitchesUsed).toBe(0);
    expect(result.state.leader.fighters[0]!.hp)
      .toBe(state.leader.fighters[0]!.hp);
  });
  it('todos os 8 líderes: decisões determinísticas e duelo 3×3 sempre finaliza',()=>{
    for(let gym=0;gym<8;gym++){
      for(let seed=0;seed<4;seed++){
        let state=match(gym);
        let rng=(gym*1000+seed*1701+99)>>>0;
        for(let step=0;step<GYM_MAX_TURNS+8&&state.outcome==='ongoing';step++){
          const player=legalAction(state,'player');
          const leader=legalAction(state,'leader');
          expect(leader).toEqual(gymChooseAiAction(state,'leader'));
          const a=resolveGymTurn(state,player,leader,rng);
          const b=resolveGymTurn(state,player,leader,rng);
          expect(a).toEqual(b);
          expect(a.status).toBe('applied');
          if(a.status!=='applied')throw Error(a.reason);
          state=a.state;
          rng=(a.seedAfter+step+1)>>>0;
          for(const side of ['player','leader'] as const){
            expect(state[side].voluntarySwitchesUsed).toBeLessThanOrEqual(3);
            for(const fighter of state[side].fighters){
              expect(fighter.hp).toBeGreaterThanOrEqual(0);
              expect(fighter.hp).toBeLessThanOrEqual(fighter.combatant.stats.hp);
              expect(fighter.sp).toBeGreaterThanOrEqual(0);
              expect(fighter.sp).toBeLessThanOrEqual(fighter.maxSp);
              expect(fighter.focusUses).toBeLessThanOrEqual(2);
            }
          }
        }
        expect(state.outcome).not.toBe('ongoing');
        expect(state.turn).toBeLessThanOrEqual(GYM_MAX_TURNS);
      }
    }
  });
});
