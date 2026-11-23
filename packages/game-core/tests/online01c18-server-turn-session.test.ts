import {describe,expect,it} from 'vitest';
import {
  createFrozenWildTurnSession,initialFrozenWildTurnActions,
  canonicalFrozenCombatants,kantoMaxSp,kantoMoveSpCost
} from '../src/index.js';

const zero=()=>({
  hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0
});
const snapshot=(species=4,moveName='scratch')=>({
  version:1,regionId:1,
  trainer:{level:1,manual:zero()},
  activePokemon:{
    uid:17,speciesId:species,level:1,affinity:0,
    manual:zero(),moveName
  },
  opponent:{speciesId:10,level:2}
});
describe('ONLINE-01C-18 — initial authoritative wild turn session',()=>{
  it('freezes HP, SP, one equipped player move and fair wild move loadout',()=>{
    const s=snapshot();
    const actors=canonicalFrozenCombatants(s)!;
    const turn=createFrozenWildTurnSession(s)!;
    expect(turn).not.toBeNull();
    expect(turn).toMatchObject({
      version:1,mode:'turns',regionId:1,phase:'await-player',
      turn:0,maxTurns:30,
      player:{uid:17,speciesId:4,status:null,focusUses:0,lastFocusTurn:-100,
        equippedMoves:['scratch']},
      wild:{speciesId:10,status:null,focusUses:0,lastFocusTurn:-100}
    });
    expect(turn.player.hp).toBe(actors.player.stats.hp);
    expect(turn.player.maxHp).toBe(actors.player.stats.hp);
    expect(turn.wild.hp).toBe(actors.wild.stats.hp);
    expect(turn.player.sp).toBe(kantoMaxSp(1,4));
    expect(turn.wild.sp).toBe(kantoMaxSp(2,10));
    expect(turn.player.sp).toBe(turn.player.maxSp);
    expect(turn.wild.sp).toBe(turn.wild.maxSp);
    expect(turn.wild.equippedMoves).toEqual(
      (actors.wild.moves??[actors.wild.move]).map(move=>move.name)
    );
    expect(turn.wild.equippedMoves.length).toBeGreaterThan(0);
    expect(turn.wild.equippedMoves.length).toBeLessThanOrEqual(4);
    expect(turn.log).toEqual([]);
    expect(turn.frames).toEqual([]);
    expect(Object.hasOwn(turn,'seed')).toBe(false);
    expect(Object.hasOwn(turn,'outcome')).toBe(false);
    expect(Object.hasOwn(turn,'rewards')).toBe(false);
    expect(Object.hasOwn(turn,'captured')).toBe(false);
    expect(createFrozenWildTurnSession(s)).toEqual(turn);
  });
  it('offers only canonical basic attack and equipped move; no focus at full SP',()=>{
    expect(initialFrozenWildTurnActions(snapshot())).toEqual([
      {kind:'basic',moveName:'basic-attack',spCost:0},
      {kind:'move',moveName:'scratch',
        spCost:kantoMoveSpCost(canonicalFrozenCombatants(snapshot())!.player.move)}
    ]);
    const choices=initialFrozenWildTurnActions(snapshot())!;
    expect(choices.every(action=>action.spCost>=0)).toBe(true);
    expect(choices.some(action=>action.kind==='focus')).toBe(false);
    expect(choices.some(action=>action.kind==='switch')).toBe(false);
  });
  it('rejects invalid trainer, illegal moves and unsupported regions',()=>{
    expect(createFrozenWildTurnSession({...snapshot(),regionId:2})).toBeNull();
    expect(createFrozenWildTurnSession(snapshot(4,'hyper-beam'))).toBeNull();
    expect(createFrozenWildTurnSession({
      ...snapshot(),trainer:{level:1,manual:{...zero(),hp:40}}
    })).toBeNull();
    expect(initialFrozenWildTurnActions(snapshot(4,'hyper-beam'))).toBeNull();
    expect(createFrozenWildTurnSession(null)).toBeNull();
  });
});
