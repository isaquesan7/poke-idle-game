import {describe,expect,it} from 'vitest';
import {
  canonicalFrozenCombatants,previewFrozenWildBattle,
  KANTO_BATTLE_SPECIES,kantoWildMoveLoadout,simulateKantoBattle,
  pokemonFinalStats,pokemonOwnStats,zeroStats
} from '../src/index.js';
import type {ServerBattleSnapshotV1} from '../src/index.js';

const blank=()=>({hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0});
const fresh=():ServerBattleSnapshotV1=>({
  version:1,regionId:1,
  trainer:{equipped:{},title:'aprendiz',wins:0,seen:[4],badges:[],inventory:{version:1 as const,gear:[],extraBagSlots:0},level:1,manual:blank()},
  activePokemon:{uid:1,speciesId:4,level:1,affinity:0,manual:blank(),moveName:'scratch'},
  opponent:{speciesId:10,level:2}
});
describe('ONLINE-01C-11 — canonical frozen PvE adapter (no grants)',()=>{
 it('builds exactly the catalog stats, move legality and fair wild AI',()=>{
   const pair=canonicalFrozenCombatants(fresh());
   expect(pair).not.toBeNull();
   const p=pair!.player,w=pair!.wild;
   expect(p.speciesId).toBe(4);
   expect(p.move.name).toBe('scratch');
   expect(p.stats).toEqual(pokemonFinalStats(
     KANTO_BATTLE_SPECIES[4]!.base,1,blank(),{...blank(),hp:1},0));
   expect(w.speciesId).toBe(10);
   expect(w.stats).toEqual(pokemonOwnStats(
     KANTO_BATTLE_SPECIES[10]!.base,2,zeroStats()));
   expect(w.moves).toEqual(kantoWildMoveLoadout(
     10,2,KANTO_BATTLE_SPECIES[10]!.move));
   expect(w.rank).toBe(0);
 });
 it('reuses the exact official battle engine and strips legacy automatic capture',()=>{
   const input=fresh();
   const pair=canonicalFrozenCombatants(input)!;
   const canonical=simulateKantoBattle(pair.player,pair.wild,2026);
   const preview=previewFrozenWildBattle(input,2026)!;
   expect(preview.outcome).toBe(canonical.outcome);
   expect(preview.frames.length).toBe(preview.log.length);
   expect(preview.log.filter(line=>line.startsWith('Captura! '))).toEqual([]);
   expect(preview.log.some(line=>line.includes('Recompensas de combate recebidas'))).toBe(false);
   expect(preview.frames).toEqual(canonical.frames.filter((frame,index)=>
     !canonical.log[index]?.startsWith('Captura! ')));
   expect(preview.playerRemainingHp).toBe(canonical.playerRemainingHp);
   expect(preview.wildRemainingSp).toBe(canonical.wildRemainingSp);
   expect(preview).toEqual(previewFrozenWildBattle(input,2026));
   for(let seed=0;seed<50;seed++){
     const sample=previewFrozenWildBattle(input,seed)!;
     expect(sample.frames.length).toBe(sample.log.length);
     expect(sample.log.some(line=>line.startsWith('Captura! ')||
       line.includes('Recompensas de combate recebidas'))).toBe(false);
   }
   expect(Object.keys(preview)).not.toContain('captured');
   expect(Object.keys(preview)).not.toContain('affinityGain');
   expect(Object.keys(preview)).not.toContain('coins');
   expect(Object.keys(preview)).not.toContain('seed');
 });
 it('rejects forgery: future move, impossible level/budget and injected stats',()=>{
   expect(canonicalFrozenCombatants({...fresh(),regionId:8})).toBeNull();
   expect(canonicalFrozenCombatants({...fresh(),opponent:{speciesId:150,level:100}})).toBeNull();
   expect(canonicalFrozenCombatants({...fresh(),activePokemon:{
     ...fresh().activePokemon,moveName:'hyper-beam'}})).toBeNull();
   expect(canonicalFrozenCombatants({...fresh(),trainer:{
     level:1,manual:{...blank(),attack:1}}})).toBeNull();
   expect(canonicalFrozenCombatants({...fresh(),activePokemon:{
     ...fresh().activePokemon,level:1,manual:{...blank(),hp:1}}})).toBeNull();
   expect(canonicalFrozenCombatants({...fresh(),activePokemon:{
     ...fresh().activePokemon,stats:{hp:1000000}}})).not.toBeNull();
   // Unknown properties cannot influence validated canonical combatants.
   expect(canonicalFrozenCombatants({...fresh(),activePokemon:{
     ...fresh().activePokemon,stats:{hp:1000000}}})).toEqual(
     canonicalFrozenCombatants(fresh()));
   expect(previewFrozenWildBattle(fresh(),-1)).toBeNull();
   expect(previewFrozenWildBattle(fresh(),2**32)).toBeNull();
 });
 it('freezes per-slot ranks with zero fallback and rejects forged budgets',()=>{
   const input={...fresh(),version:2,activePokemon:{...fresh().activePokemon,level:30,
     moveNames:['scratch','ember','growl'],upgrades:{scratch:4,ember:2}}};
   const pair=canonicalFrozenCombatants(input)!;
   expect(pair.player.rank).toBe(4);
   expect(pair.player.ranks).toEqual({scratch:4,ember:2,growl:0});
   expect(pair.wild.rank).toBe(0);
   const bad=(upgrades:unknown)=>canonicalFrozenCombatants({...input,activePokemon:{...input.activePokemon,upgrades}});
   expect(bad({scratch:5})).toBeNull();
   expect(bad({scratch:4,ember:3})).toBeNull();
   expect(bad({growl:1})).toBeNull();
   expect(bad({'hyper-beam':1})).toBeNull();
   expect(canonicalFrozenCombatants({...fresh(),activePokemon:{...fresh().activePokemon,upgrades:{scratch:1}}})).toBeNull();
   const primaryOnly=canonicalFrozenCombatants({...input,activePokemon:{...input.activePokemon,upgrades:{scratch:4}}})!;
   expect(primaryOnly.player.ranks).toEqual({scratch:4,ember:0,growl:0});
   const legacy=canonicalFrozenCombatants({...input,activePokemon:{...input.activePokemon,upgrades:undefined}})!;
   expect(legacy.player.rank).toBe(0);
   expect(legacy.player.ranks).toBeUndefined();
 });
 it('accepts legal FRLG learned attacks and computes player investment bonuses',()=>{
   const input={...fresh(),trainer:{...fresh().trainer,level:2,manual:{...blank(),hp:1}},
     activePokemon:{...fresh().activePokemon,level:7,moveName:'ember'}};
   const pair=canonicalFrozenCombatants(input);
   expect(pair).not.toBeNull();
   expect(pair!.player.move.name).toBe('ember');
   expect(pair!.player.stats.hp).toBeGreaterThan(0);
   expect(pair!.player.stats.hp).toBeGreaterThanOrEqual(
     pokemonOwnStats(KANTO_BATTLE_SPECIES[4]!.base,7,blank()).hp);
   expect(previewFrozenWildBattle(input,148)).not.toBeNull();
 });
});
