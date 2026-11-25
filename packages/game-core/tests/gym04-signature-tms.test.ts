import {describe,it,expect} from 'vitest';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {prepareGymOpponent} from '../src/gyms/gymTactics.js';
import {gymSignatureTm} from '../src/gyms/gymSignatureTms.js';
import {createGymBattleState} from '../src/gyms/gymBattleState.js';
import {resolveGymTurn,gymLegalTurnActions} from '../src/gyms/gymTurn.js';
import {kantoMoveSpCost,kantoMovePp} from '../src/combat/kantoSkillEnergy.js';
import {kantoTmIsTeachEnabled} from '../src/catalog/kantoTmPreview.js';
import {kantoLevelMoves} from '../src/catalog/kantoLevelMoves.js';
describe('GYM04 NPC-only signature machines',()=>{
 it('exact original party intersections, real paid turn and rank applied',()=>{
  let count=0;
  for(const gym of KANTO_GYMS){
   const team=prepareGymOpponent(gym).team;
   for(const mon of team){
    const tm=gymSignatureTm(gym.id,mon.speciesId);
    if(!tm)continue;
    count++;
    expect(mon.moves?.[0]).toEqual(tm.move);
    expect(kantoMovePp(tm.move.name)).toBeGreaterThan(0);
    expect(kantoMoveSpCost(tm.move)).toBeGreaterThan(0);
    expect(kantoTmIsTeachEnabled('tm'+String(tm.tm).padStart(2,'0'),mon.speciesId)).toBe(false);
    const mirror=[mon,team[1],team[2]] as const;
    const state=createGymBattleState([{uid:1,combatant:mon},{uid:2,combatant:team[1]},{uid:3,combatant:team[2]}],mirror);
    const action={kind:'move',moveName:tm.move.name} as const;
    expect(gymLegalTurnActions(state,'leader')).toContainEqual(action);
    const result=resolveGymTurn(state,{kind:'basic'},action,1234);
    expect(result.status).toBe('applied');
   }
  }
  expect(count).toBe(15);
 });
 it('never injects Rock Tomb into non-original party or player level-up catalogue',()=>{
  expect(gymSignatureTm('boulder',74)).toBeNull();
  expect(gymSignatureTm('boulder',27)).toBeNull();
  expect(gymSignatureTm('cascade',54)).toBeNull();
  expect(gymSignatureTm('earth',95)).toBeNull();
  expect(kantoLevelMoves(95,15).some(x=>x.move.name==='rock-tomb')).toBe(false);
  expect(kantoLevelMoves(121,23).some(x=>x.move.name==='water-pulse')).toBe(false);
 });
});
