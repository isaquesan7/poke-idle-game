import {describe,it,expect} from 'vitest';
import {canonicalFrozenCombatants} from '../src/combat/serverFrozenBattle.js';
import {canonicalOnlineGymPreparation,canonicalOnlineGymTrainerBonuses} from '../src/combat/serverGymPreparation.js';
import {createFrozenWildTurnSession} from '../src/combat/serverWildTurnSession.js';
import {resolveFrozenWildTurn} from '../src/combat/serverWildTurnResolver.js';
import {zeroStats} from '../src/stats/types.js';
const state=()=>{
 const p={uid:1,pokemonId:4,level:30,xp:0,manual:zeroStats(),affinity:100,moveName:'ember',upgrades:{}};
 return {version:1,mode:'normal',trainer:{level:40,manual:{...zeroStats(),specialAttack:10},equipped:{gloves:'gloves-tech',jacket:'coat'},title:'veterano'},
 wins:4,seen:[4],badges:['boulder','cascade'],inventory:{version:1,ownedEquipment:{'gloves-tech':1,coat:1},extraBagSlots:0},
 roster:[p,{...p,uid:2},{...p,uid:3}],team:[1,2,3],nextUid:4,expedition:null};
};
const snapshot=(s=state())=>({version:1,regionId:1,opponent:{speciesId:10,level:2},
 trainer:{...s.trainer,wins:s.wins,seen:s.seen,badges:s.badges,inventory:s.inventory},
 activePokemon:{uid:1,speciesId:4,level:30,affinity:100,manual:zeroStats(),moveName:'ember'}});
describe('23F12D2 regional and Gym trainer bonuses share authority',()=>{
 it('uses identical final stats and deterministic actual turn with frozen bonuses',()=>{
  const raw=state(),s=snapshot(raw),pair=canonicalFrozenCombatants(s)!;
  const gym=canonicalOnlineGymPreparation(raw)!;
  expect(pair).not.toBeNull();expect(gym).not.toBeNull();
  expect(pair.player.stats).toEqual(gym.player[0].combatant.stats);
  const totals=canonicalOnlineGymTrainerBonuses(raw)!.totals;
  expect(totals.specialAttack).toBe(17);
  const initial=createFrozenWildTurnSession(s)!;
  const a=resolveFrozenWildTurn(s,initial,{kind:'move',moveName:'ember'},42);
  expect(a?.status).toBe('applied');
  expect(resolveFrozenWildTurn(s,initial,{kind:'move',moveName:'ember'},42)).toEqual(a);
  // Copy a new loadout, never mutate the persisted frozen object.
  const other=state();other.trainer.manual.specialAttack=0;
  expect(canonicalFrozenCombatants(snapshot(other))!.player.stats.specialAttack).toBeLessThan(pair.player.stats.specialAttack);
  expect(canonicalFrozenCombatants(s)).toEqual(pair);
 });
 it('rejects missing ownership, wrong slots, locked and exclusive titles, forged badges',()=>{
  const s=snapshot();
  for(const patch of [
   {inventory:{version:1,ownedEquipment:{},extraBagSlots:0}},
   {equipped:{hat:'coat'}},{title:'mestre'},{title:'gym-leader'},
   {badges:['cascade']},{badges:['boulder','boulder']},{wins:0},{inventory:undefined}
  ])expect(canonicalFrozenCombatants({...s,trainer:{...s.trainer,...patch}})).toBeNull();
  expect(canonicalFrozenCombatants({...s,trainer:{level:40,manual:zeroStats()}})).toBeNull();
  expect(canonicalFrozenCombatants({...s,trainer:{...s.trainer,totals:{specialAttack:9999}}})).toEqual(canonicalFrozenCombatants(s));
 });
});
