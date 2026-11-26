import {describe,it,expect} from 'vitest';
import {KANTO_POKEDEX} from '../src/catalog/kantoSpecies.js';
import {KANTO_MASTERY_FAMILIES,kantoMasteryFamily,kantoMasteryRank,kantoResearchValue,quoteKantoResearch,masteryAchievements} from '../src/progression/kantoMastery.js';
import type {ResearchSnapshot} from '../src/progression/kantoMastery.js';
const fixture=():ResearchSnapshot=>({roster:[{uid:1,pokemonId:25},{uid:2,pokemonId:25},{uid:3,pokemonId:25},{uid:4,pokemonId:26},{uid:5,pokemonId:26},{uid:6,pokemonId:19}],team:[1],favorites:[3],points:{'25':14},busy:false});
describe('Kanto mastery policy',()=>{
 it('partitions all 151 species exactly once, branches and later-generation parents excluded',()=>{
  const ids=KANTO_MASTERY_FAMILIES.flatMap(f=>f.speciesIds);
  expect(ids).toHaveLength(151);expect(new Set(ids).size).toBe(151);
  expect([...ids].sort((a,b)=>a-b)).toEqual(KANTO_POKEDEX.map(p=>p.id));
  expect(KANTO_MASTERY_FAMILIES.find(f=>f.id===133)?.speciesIds).toEqual([133,134,135,136]);
  expect(kantoMasteryFamily(25)).toEqual({id:25,stage:1});
  expect(kantoMasteryFamily(6)).toEqual({id:4,stage:3});
  expect(kantoMasteryFamily(143)).toEqual({id:143,stage:1});
  expect(kantoMasteryFamily(152)).toBeNull();
 });
 it('rank boundaries and non-stacking bonuses',()=>{
  for(const [points,rank,xp,stat] of [[0,0,0,0],[4,0,0,0],[5,1,2,0],[14,1,2,0],[15,2,5,0],[30,3,10,0],[60,4,10,1],[100,5,10,3]] as const){
   expect(kantoMasteryRank(points)?.current).toMatchObject({rank,xpPercent:xp,statPercent:stat});
  }
  expect(kantoMasteryRank(100)?.next).toBeNull();expect(kantoMasteryRank(101)).toBeNull();
  expect(kantoResearchValue(19)).toBe(1);expect(kantoResearchValue(26)).toBeGreaterThanOrEqual(2);
  expect(kantoResearchValue(144)).toBe(10);expect(kantoResearchValue(151)).toBe(15);
 });
 it('quotes only owned UIDs, shares points across family, does not mutate input',()=>{
  const s=fixture(),before=JSON.stringify(s),q=quoteKantoResearch(s,[2,4]);
  expect(q.status).toBe('ok');
  if(q.status!=='ok')throw Error('expected valid quote');
  expect(q.families).toEqual([{id:25,before:14,after:14+q.totalPoints,credit:q.totalPoints,rank:2}]);
  expect(JSON.stringify(s)).toBe(before);
 });
 it('rejects protected, missing, duplicate, last specimen, busy and corrupt saves atomically',()=>{
  const s=fixture();
  expect(quoteKantoResearch(s,[1]).status).toBe('protected');
  expect(quoteKantoResearch(s,[2,3]).status).toBe('protected');
  expect(quoteKantoResearch(s,[2,99]).status).toBe('missing-pokemon');
  expect(quoteKantoResearch(s,[2,2]).status).toBe('invalid-selection');
  expect(quoteKantoResearch(s,[4,5]).status).toBe('last-specimen');
  expect(quoteKantoResearch(s,[6]).status).toBe('last-specimen');
  expect(quoteKantoResearch({...s,busy:true},[2]).status).toBe('busy');
  expect(quoteKantoResearch({...s,points:{'26':1}},[2]).status).toBe('invalid-state');
 });
 it('caps final credit and prevents further conversions',()=>{
  const s={...fixture(),points:{'25':99}};
  const q=quoteKantoResearch(s,[4]);expect(q.status).toBe('ok');
  if(q.status==='ok')expect(q.totalPoints).toBe(1);
  expect(quoteKantoResearch(s,[4,2]).status).toBe('mastered');
  expect(quoteKantoResearch({...s,points:{'25':100}},[2]).status).toBe('mastered');
 });
});

it('research titles unlock only at completed family milestones',()=>{
 const points=Object.fromEntries(KANTO_MASTERY_FAMILIES.slice(0,5).map(f=>[String(f.id),100]));
 expect(masteryAchievements(points).map(a=>a.unlocked)).toEqual([true,false,false,false]);
 expect(masteryAchievements(Object.fromEntries(KANTO_MASTERY_FAMILIES.map(f=>[String(f.id),99]))).every(a=>!a.unlocked)).toBe(true);
 const all=masteryAchievements(Object.fromEntries(KANTO_MASTERY_FAMILIES.map(f=>[String(f.id),100])));
 expect(all.every(a=>a.unlocked)).toBe(true);expect(all[3]?.target).toBe(KANTO_MASTERY_FAMILIES.length);
});
