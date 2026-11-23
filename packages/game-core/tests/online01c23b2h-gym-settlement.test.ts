import {describe,it,expect} from 'vitest';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {prepareGymOpponent} from '../src/gyms/gymTactics.js';
import {createGymBattleState} from '../src/gyms/gymBattleState.js';
import {applyCertifiedGymSettlement} from '../src/combat/serverGymSettlement.js';

const gym=KANTO_GYMS[0]!;
const opponent=prepareGymOpponent(gym).team;
const base=createGymBattleState([
  {uid:11,combatant:opponent[0]!},
  {uid:12,combatant:opponent[1]!},
  {uid:13,combatant:opponent[2]!}
],opponent);
const raw=()=>JSON.stringify({
  version:1,mode:'normal',coins:500,badges:[],wins:0,losses:0,
  trainer:{level:20,xp:0,title:'aprendiz',manual:{},equipped:{}},
  team:[11,12,13],expedition:null,
  roster:opponent.map((p,i)=>({uid:i+11,pokemonId:p.speciesId,
    level:p.level,xp:0,affinity:0}))
});
const playerWon={...base,turn:7,outcome:'player-win' as const,
  leader:{...base.leader,fighters:base.leader.fighters.map(f=>({...f,hp:0}))
    as unknown as typeof base.leader.fighters}};
const playerLost={...base,turn:7,outcome:'leader-win' as const,
  player:{...base.player,fighters:base.player.fighters.map(f=>({...f,hp:0}))
    as unknown as typeof base.player.fighters}};
const event='gym-settlement-test-0001';

describe('ONLINE-01C-23B2H: same GYM-03A economy through private pure transition',()=>{
  it('Brock pays catalog 1500 coins + 120 trainer XP and exactly one badge',()=>{
    const result=applyCertifiedGymSettlement(raw(),{
      gymId:gym.id,outcome:'player-win',battle:playerWon,eventId:event
    });
    expect(result?.paid).toEqual({gymId:'boulder',outcome:'player-win',
      badgeId:'boulder',coins:1500,trainerXp:120});
    const next=JSON.parse(result!.raw);
    expect(next.coins).toBe(2000);
    expect(next.trainer.xp).toBe(120);
    expect(next.badges).toEqual(['boulder']);
    expect(next.lastGymVictory.eventId).toBe(event);
    expect(applyCertifiedGymSettlement(result!.raw,{
      gymId:gym.id,outcome:'player-win',battle:playerWon,eventId:'second-id-test-0001'
    })).toBeNull();
  });
  it('loss and draw do not mint badges, coins or XP',()=>{
    const loss=applyCertifiedGymSettlement(raw(),{
      gymId:gym.id,outcome:'leader-win',battle:playerLost,eventId:event
    });
    expect(loss?.paid).toEqual({gymId:'boulder',outcome:'leader-win',
      badgeId:null,coins:0,trainerXp:0});
    expect(JSON.parse(loss!.raw).badges).toEqual([]);
    expect(JSON.parse(loss!.raw).coins).toBe(500);
    expect(JSON.parse(loss!.raw).trainer.xp).toBe(0);
  });
  it('rejects fake winner, wrong Gym, unknown UID and fabricated team',()=>{
    const params={gymId:gym.id,outcome:'player-win' as const,
      battle:playerWon,eventId:event};
    expect(applyCertifiedGymSettlement(raw(),{...params,
      battle:{...playerWon,outcome:'draw'}})).toBeNull();
    expect(applyCertifiedGymSettlement(raw(),{...params,gymId:'cascade'})).toBeNull();
    expect(applyCertifiedGymSettlement(raw(),{...params,battle:{
      ...playerWon,player:{...playerWon.player,fighters:
        playerWon.player.fighters.map((f,i)=>i===0?{...f,uid:999}:f)
      }
    }})).toBeNull();
  });
});
