import {describe,it,expect} from 'vitest';
import {KANTO_REGIONS,kantoRegionalSpeciesPool} from '../src/map/kantoRegions.js';
import {serverRegionalAccess,serverRegionalCatalog,serverRegionalOpponent,serverRegionalRoll} from '../src/combat/serverRegionalPolicy.js';
import {canonicalFrozenCombatants} from '../src/combat/serverFrozenBattle.js';
import {createFrozenWildTurnSession} from '../src/combat/serverWildTurnSession.js';
import {legalFrozenWildTurnActions,resolveFrozenWildTurn} from '../src/combat/serverWildTurnResolver.js';
import {quoteFrozenBattleRewards} from '../src/combat/serverBattleRewards.js';
import {applyFrozenBattleRewardQuote} from '../src/combat/serverBattlePayout.js';
import {finalizeFrozenWildEncounter} from '../src/capture/serverEncounterFinalization.js';
const zero=()=>({hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0});
describe('23F5 canonical regional extension (pure, not HTTP enablement)',()=>{
 it('covers all ten unlock thresholds and exhaustively matches weighted buckets',()=>{
  expect(serverRegionalCatalog(1)?.filter(r=>r.unlocked).map(r=>r.id)).toEqual([1]);
  expect(serverRegionalCatalog(100)?.length).toBe(10);
  for(const r of KANTO_REGIONS){
   expect(serverRegionalAccess(r.id,r.trainerUnlockLevel-1)).toBe(false);
   expect(serverRegionalAccess(r.id,r.trainerUnlockLevel)).toBe(true);
   const pool=kantoRegionalSpeciesPool(r,r.levelMin);
   const weights=pool.map(entry=>entry.weight);
   const total=weights.reduce((n,w)=>n+w,0);
   const counts=new Map<number,number>();
   for(let pick=0;pick<total;pick++){
    const value=serverRegionalRoll(r.id,100,r.levelMin, (()=>{let call=0;const fixed=pool.length===r.speciesIds.length;return ()=>((call++===0)===fixed)?pick:0;})())!;
    counts.set(value.speciesId,(counts.get(value.speciesId)??0)+1);
    expect(value.level).toBe(r.levelMin);
   }
   expect(pool.map(entry=>counts.get(entry.speciesId))).toEqual(weights);
   expect(serverRegionalRoll(r.id,100,100,max=>max-1)?.level).toBe(r.levelMax);
   expect(serverRegionalOpponent(r.id,100,r.speciesIds[0]!,r.levelMax+1)).toBe(false);
  }
  expect(serverRegionalRoll(10,92,100,()=>0)).toBeNull();
  expect(serverRegionalRoll(1,1,1,max=>max)).toBeNull();
 });
 it('builds one-fighter sessions and legal turns in every region; binds region identity',()=>{
  for(const r of KANTO_REGIONS){
   const snapshot={version:1,regionId:r.id,trainer:{equipped:{},title:'aprendiz',wins:0,seen:[4],badges:[],inventory:{version:1 as const,ownedEquipment:{},extraBagSlots:0},level:r.trainerUnlockLevel,manual:zero()},
     activePokemon:{uid:1,speciesId:4,level:r.levelMin,affinity:0,manual:zero(),moveName:'scratch'},
     opponent:{speciesId:r.speciesIds[0]!,level:r.levelMin}};
   expect(canonicalFrozenCombatants(snapshot)).not.toBeNull();
   const session=createFrozenWildTurnSession(snapshot)!;
   expect(session.regionId).toBe(r.id);
   expect(legalFrozenWildTurnActions(snapshot,session)).toContainEqual({kind:'basic'});
   expect(legalFrozenWildTurnActions(snapshot,{...session,regionId:r.id===1?2:1})).toBeNull();
   expect(resolveFrozenWildTurn(snapshot,session,{kind:'basic'},123)?.status).toBe('applied');
   if(r.id!==1){
    expect(canonicalFrozenCombatants({...snapshot,trainer:{equipped:{},title:'aprendiz',wins:0,seen:[4],badges:[],inventory:{version:1 as const,ownedEquipment:{},extraBagSlots:0},level:r.trainerUnlockLevel-1,manual:zero()}})).toBeNull();
    expect(canonicalFrozenCombatants({...snapshot,opponent:{speciesId:10,level:r.levelMin}})).toBeNull();
   }
  }
 });
 it('credits the matching region and requires Ultra Ball for a legendary',()=>{
  const snapshot={version:1,regionId:10,trainer:{equipped:{},title:'aprendiz',wins:0,seen:[4],badges:[],inventory:{version:1 as const,ownedEquipment:{},extraBagSlots:0},level:93,manual:zero()},
   activePokemon:{uid:1,speciesId:4,level:91,affinity:0,manual:zero(),moveName:'scratch'},
   opponent:{speciesId:150,level:91}};
  const preview={outcome:'win',turns:1,playerRemainingHp:1,wildRemainingHp:0,log:[],frames:[]};
  const state={version:1,mode:'normal',trainer:{level:93,xp:0,manual:zero()},coins:0,wins:0,losses:0,
   roster:[{uid:1,pokemonId:4,level:91,xp:0,affinity:0,manual:zero(),moveName:'scratch',battleRecord:{wins:0,draws:0,losses:0}}],
   team:[1],nextUid:2,seen:[4],caughtSpecies:[4],regionWins:Array(10).fill(0),
   ballPocket:{version:1,quantities:{'poke-ball':12,'ultra-ball':1}}};
  const quote=quoteFrozenBattleRewards(snapshot,preview,0,9999)!;
  expect(quote.regionId).toBe(10);
  const paid=applyFrozenBattleRewardQuote(JSON.stringify(state),snapshot,preview,quote)!;
  expect(JSON.parse(paid.raw).regionWins).toEqual([0,0,0,0,0,0,0,0,0,1]);
  expect(finalizeFrozenWildEncounter(paid.raw,snapshot,preview,'poke-ball',123,1740000000000)).toBeNull();
  const capture=finalizeFrozenWildEncounter(paid.raw,snapshot,preview,'ultra-ball',123,1740000000000)!;
  expect(capture.result.ballId).toBe('ultra-ball');
  expect(JSON.parse(capture.raw).ballPocket.quantities['ultra-ball']??0).toBe(0);
 });
});
