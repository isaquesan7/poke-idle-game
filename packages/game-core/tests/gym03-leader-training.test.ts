import {describe,it,expect} from 'vitest';
import {KANTO_GYMS} from '../src/gyms/kantoGyms.js';
import {prepareGymOpponent,prepareGymLeader,gymPokemonTraining,gymOpponentRanks,GYM_LEADER_TITLE} from '../src/gyms/gymTactics.js';
import {kantoSpecies} from '../src/catalog/kantoSpecies.js';
import {kantoLevelMoves} from '../src/catalog/kantoLevelMoves.js';
import {kantoSupportMoves} from '../src/catalog/kantoSupportMoves.js';
import {gymPsychicLevelMoves} from '../src/gyms/gymPsychicMoves.js';
import {legacyMoveRankLimits} from '../src/legacy/pokemonMoveReducer.js';
import {pokemonOwnStats,pokemonFinalStats} from '../src/stats/pokemon.js';
import {trainerTotals} from '../src/stats/trainer.js';
import {trainerContribution} from '../src/affinity/affinity.js';
import {LEGACY_ITEMS,LEGACY_TITLES} from '../src/legacy/catalog.js';
import {gymSignatureTm} from '../src/gyms/gymSignatureTms.js';
import {STATS} from '../src/stats/types.js';
describe('GYM03: eight leaders and 24 trained Pokemon on equal legal budgets',()=>{
 it('uses exact trainer budgets, real unique equipment, previous badges and 100 affinity',()=>{
  expect(KANTO_GYMS.map(g=>g.trainerLevel)).toEqual([12,23,31,39,51,61,72,84]);
  for(const gym of KANTO_GYMS){
   const t=prepareGymLeader(gym);
   expect(Object.values(t.manual).reduce((a,b)=>a+b,0)).toBe(2*(t.level-1));
   expect(Object.values(t.manual).every(n=>Number.isSafeInteger(n)&&n>=0&&n<=40)).toBe(true);
   expect(new Set(t.equipment.map(e=>e.slot)).size).toBe(t.equipment.length);
   expect(t.equipment.every(e=>LEGACY_ITEMS.some(i=>i.id===e.itemId&&i.slot===e.slot))).toBe(true);
   expect(t.badges).toEqual(KANTO_GYMS.slice(0,gym.order-1).map(g=>g.id));
   expect(t.affinity).toBe(100);
   expect(t.activeTitle).toBe('gym-leader');
   expect(Object.values(GYM_LEADER_TITLE.stats)).toEqual([6,6,6,6,6,6]);
   expect(LEGACY_TITLES.some(x=>x.id===t.activeTitle)).toBe(false);
   expect(t.totals).toEqual(trainerTotals({manual:t.manual,equipment:t.equipment,
    activeTitle:GYM_LEADER_TITLE.stats,
    badges:KANTO_GYMS.slice(0,gym.order-1).map(g=>({id:g.id,stats:g.badgeStats}))}));
  }
 });
 it('all Pokemon spend full manual budget, apply exact 10% contribution and legal ranks',()=>{
  for(const gym of KANTO_GYMS){
   const p=prepareGymOpponent(gym);
   expect(p).toEqual(prepareGymOpponent(gym));
   for(const mon of p.team){
    const species=kantoSpecies(mon.speciesId)!;
    const moves=mon.moves!;
    const manual=gymPokemonTraining(mon.speciesId,mon.level,moves);
    expect(Object.values(manual).reduce((a,b)=>a+b,0)).toBe(2*(mon.level-1));
    const own=pokemonOwnStats(species.base,mon.level,manual);
    expect(mon.stats).toEqual(pokemonFinalStats(species.base,mon.level,manual,p.trainer.totals,100));
    for(const stat of STATS)expect(mon.stats[stat]-own[stat]).toBe(trainerContribution(p.trainer.totals[stat],100));
    const signature=gymSignatureTm(gym.id,mon.speciesId);
    if(signature)expect(moves[0]).toEqual(signature.move);
    const legal=[...(signature?[{move:signature.move,learnedAt:0}]:[]),...kantoLevelMoves(mon.speciesId,mon.level),...kantoSupportMoves(mon.speciesId,mon.level),...gymPsychicLevelMoves(mon.speciesId,mon.level)];
    expect(moves.every(m=>legal.some(x=>x.move.name===m.name))).toBe(true);
    const rankable=moves.filter(m=>m.category!=='status'&&m.power>0);
    const available=new Set(legal.filter(x=>x.move.category!=='status'&&x.move.power>0).map(x=>x.move.name));
    const limit=legacyMoveRankLimits(mon.level);
    const spent=Object.values(mon.ranks!).reduce((a,b)=>a+b,0);
    expect(spent).toBe(Math.min(limit.skillPoints,rankable.length*limit.maxRankPerMove));
    expect(spent).toBe(Math.min(limit.skillPoints,Math.min(signature?.move.category==='status'?3:4,available.size)*limit.maxRankPerMove));
    expect(mon.ranks).toEqual(gymOpponentRanks(mon.speciesId,mon.level,moves));
    expect(mon.rank).toBe(mon.ranks![mon.move.name]);
    for(const m of moves){
     expect(mon.ranks![m.name]).toBeGreaterThanOrEqual(0);
     expect(mon.ranks![m.name]).toBeLessThanOrEqual(limit.maxRankPerMove);
     if(m.category==='status'||m.power===0)expect(mon.ranks![m.name]).toBe(0);
    }
   }
  }
 });
 it('Geodude at 12 has 22 manual points and two legal rank points',()=>{
  const g=prepareGymOpponent(KANTO_GYMS[0]!),p=g.team[0];
  expect(p.speciesId).toBe(74);expect(p.level).toBe(12);
  expect(Object.values(p.ranks!).reduce((a,b)=>a+b,0)).toBe(2);
  expect(g.trainer.level).toBe(12);
 });
});
