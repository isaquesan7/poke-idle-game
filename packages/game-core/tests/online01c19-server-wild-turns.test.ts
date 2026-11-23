import {describe,it,expect} from 'vitest';
import {
  createFrozenWildTurnSession,legalFrozenWildTurnActions,resolveFrozenWildTurn
} from '../src/index.js';

const zero=()=>({hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0});
const snapshot=(level=1,moveName='scratch')=>({
  version:1 as const,regionId:1 as const,
  trainer:{level:1,manual:zero()},
  activePokemon:{uid:101,speciesId:4,level,affinity:0,manual:zero(),moveName},
  opponent:{speciesId:10,level:2}
});
describe('ONLINE-01C-19 — canonical wild 1v1 turn resolver',()=>{
  it('uses the same legal Gym action catalog: no invented switches or skill slots',()=>{
    const s=snapshot(),before=createFrozenWildTurnSession(s)!;
    expect(legalFrozenWildTurnActions(s,before)).toEqual([
      {kind:'basic'},{kind:'move',moveName:'scratch'}
    ]);
    expect(resolveFrozenWildTurn(s,before,{kind:'focus'},1))
      .toMatchObject({status:'blocked',reason:'illegal-action'});
    expect(resolveFrozenWildTurn(s,before,{kind:'switch',toIndex:1},1))
      .toMatchObject({status:'blocked',reason:'illegal-action'});
    expect(resolveFrozenWildTurn(s,before,{kind:'move',moveName:'ember'},1))
      .toMatchObject({status:'blocked',reason:'illegal-action'});
    expect(resolveFrozenWildTurn(s,before,{kind:'basic',seed:44},1))
      .toMatchObject({status:'blocked',reason:'illegal-action'});
    expect(resolveFrozenWildTurn(s,before,{kind:'basic'},-1)).toBeNull();
    expect(resolveFrozenWildTurn(s,before,{kind:'basic'},2**32)).toBeNull();
  });
  it('persists exact HP/SP and applies both moves from canonical Gym engine',()=>{
    const s=snapshot(),initial=createFrozenWildTurnSession(s)!;
    const first=resolveFrozenWildTurn(s,initial,{kind:'move',moveName:'scratch'},43)!;
    expect(first.status).toBe('applied');
    if(first.status!=='applied')return;
    expect(first.turnState.turn).toBe(1);
    expect(first.turnState.player.sp).toBeLessThan(initial.player.sp);
    expect(first.turnState.wild.sp).toBeLessThanOrEqual(initial.wild.sp);
    expect(first.turnState.log.length).toBe(first.turnState.frames.length);
    expect(first.logDelta.length).toBe(first.framesDelta.length);
    expect(first.turnState.engine?.player.fighters[1]?.hp).toBe(0);
    expect(first.turnState.engine?.leader.fighters[2]?.hp).toBe(0);
    expect(Object.hasOwn(first.turnState,'seed')).toBe(false);
    expect(Object.hasOwn(first.turnState,'captured')).toBe(false);
    expect(Object.hasOwn(first.turnState,'rewards')).toBe(false);
    expect(resolveFrozenWildTurn(s,initial,{kind:'move',moveName:'scratch'},43))
      .toEqual(first);
    if(first.turnState.phase==='await-player'){
      expect(first.nextActions).toEqual(
        legalFrozenWildTurnActions(s,first.turnState));
      expect(first.nextActions.every(a=>
        ['basic','focus','move'].includes(a.kind))).toBe(true);
      const second=resolveFrozenWildTurn(
        s,first.turnState,{kind:'basic'},432)!;
      expect(second.status).toBe('applied');
      if(second.status==='applied'){
        expect(second.turnState.turn).toBe(2);
        expect(second.turnState.log.length).toBe(
          first.turnState.log.length+second.logDelta.length);
      }
    }
  });
  it('finishes within 30 turns, never pays or generates fictitious captures',()=>{
    const s=snapshot();
    let state:unknown=createFrozenWildTurnSession(s)!;
    for(let turn=0;turn<30;turn++){
      const legal=legalFrozenWildTurnActions(s,state);
      expect(legal).not.toBeNull();
      const action=legal!.find(a=>a.kind==='move')??{kind:'basic' as const};
      const next=resolveFrozenWildTurn(s,state,action,900+turn)!;
      expect(next.status).toBe('applied');
      if(next.status!=='applied')break;
      const current=next.turnState;
      state=current;
      expect(current.log.length).toBe(current.frames.length);
      expect(current.turn).toBe(turn+1);
      expect(current.player.hp).toBeGreaterThanOrEqual(0);
      expect(current.wild.hp).toBeGreaterThanOrEqual(0);
      expect(current.player.sp).toBeGreaterThanOrEqual(0);
      expect(current.wild.sp).toBeGreaterThanOrEqual(0);
      expect(current.player.hp).toBeLessThanOrEqual(current.player.maxHp);
      expect(current.wild.hp).toBeLessThanOrEqual(current.wild.maxHp);
      if(current.phase==='resolved'){
        expect(['win','loss','draw']).toContain(current.outcome);
        expect(next.nextActions).toEqual([]);
        expect(legalFrozenWildTurnActions(s,state)).toBeNull();
        expect(Object.hasOwn(state,'rewards')).toBe(false);
        expect(Object.hasOwn(state,'captured')).toBe(false);
        return;
      }
    }
    throw new Error('Kanto wild battle did not resolve in 30 turns');
  });
  it('rejects tampered combat state rather than recreating lost HP/SP',()=>{
    const s=snapshot(),initial=createFrozenWildTurnSession(s)!;
    expect(legalFrozenWildTurnActions(s,{
      ...initial,player:{...initial.player,hp:initial.player.maxHp+1}
    })).toBeNull();
    const first=resolveFrozenWildTurn(s,initial,{kind:'basic'},7)!;
    expect(first.status).toBe('applied');
    if(first.status==='applied'&&first.turnState.phase==='await-player'){
      const changed={...first.turnState,player:{
        ...first.turnState.player,sp:first.turnState.player.maxSp+1
      }};
      expect(legalFrozenWildTurnActions(s,changed)).toBeNull();
      expect(resolveFrozenWildTurn(s,changed,{kind:'basic'},8)).toBeNull();
      const wrongUid={...first.turnState,
        player:{...first.turnState.player,uid:88}};
      expect(legalFrozenWildTurnActions(s,wrongUid)).toBeNull();
    }
  });
});
