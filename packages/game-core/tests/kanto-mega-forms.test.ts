import {describe,it,expect} from 'vitest';
import {KANTO_MEGA_FORMS,kantoMegaForm,kantoMegaOptions,kantoPokemonFormProfile,quoteKantoMegaChoice} from '../src/catalog/kantoMegaForms.js';
import {KANTO_POKEDEX,kantoSpecies} from '../src/catalog/kantoSpecies.js';
import {kantoMasteryFamily} from '../src/progression/kantoMastery.js';
import {kantoEvolutionOptions} from '../src/catalog/kantoEvolution.js';
import {kantoRegionForSpecies} from '../src/map/kantoRegions.js';
import {pokemonOwnStats,pokemonFinalStats,pokemonMasteryStats} from '../src/stats/pokemon.js';
import {zeroStats,STATS} from '../src/stats/types.js';
describe('MEGA01 — permanent starter forms',()=>{
 it('exactly four forms, pinned IDs/types/stats; each adds 100 BST without changing HP',()=>{
  expect(KANTO_MEGA_FORMS.map(f=>[f.id,f.speciesId,f.pokemonApiId,f.stoneId,f.stoneApiId])).toEqual([
   ['venusaur-mega',3,10033,'venusaurite',698],['charizard-mega-x',6,10034,'charizardite-x',699],
   ['charizard-mega-y',6,10035,'charizardite-y',717],['blastoise-mega',9,10036,'blastoisinite',700]]);
  expect(KANTO_MEGA_FORMS.map(f=>f.types)).toEqual([['grass','poison'],['fire','dragon'],['fire','flying'],['water']]);
  expect(KANTO_MEGA_FORMS.map(f=>STATS.map(s=>f.base[s]))).toEqual([[80,100,123,122,120,80],[78,130,111,130,85,100],[78,104,78,159,115,100],[79,103,120,135,115,78]]);
  for(const f of KANTO_MEGA_FORMS){
   const base=kantoSpecies(f.speciesId)!.base;
   expect(f.base.hp).toBe(base.hp);
   expect(STATS.reduce((sum,s)=>sum+f.base[s]-base[s],0)).toBe(100);
   expect(Object.isFrozen(f.base)).toBe(true);
  }
 });
 it('keeps all 151 species, mastery, evolution and encounter identities intact',()=>{
  expect(KANTO_POKEDEX).toHaveLength(151);
  for(const f of KANTO_MEGA_FORMS){
   expect(kantoSpecies(f.pokemonApiId)).toBeUndefined();
   expect(kantoRegionForSpecies(f.pokemonApiId)).toBeUndefined();
   expect(kantoMasteryFamily(f.pokemonApiId)).toBeNull();
   expect(kantoEvolutionOptions(f.speciesId)).toEqual([]);
   expect(kantoMasteryFamily(f.speciesId)?.id).toBe(f.speciesId-2);
   expect(kantoPokemonFormProfile(f.speciesId,f.id)).toMatchObject({speciesId:f.speciesId,artId:f.pokemonApiId,name:f.name});
  }
 });
 it('only final starters can choose; no cross-species, second choice or X/Y switch',()=>{
  expect(kantoMegaOptions(6).map(f=>f.id)).toEqual(['charizard-mega-x','charizard-mega-y']);
  for(const id of [1,2,4,5,7,8,25,150,151,10034])expect(kantoMegaOptions(id)).toEqual([]);
  const ordinary={uid:17,pokemonId:6,level:100,affinity:100,upgrades:{ember:5}};
  const before=JSON.stringify(ordinary);
  expect(quoteKantoMegaChoice(ordinary,'charizard-mega-x')).toEqual({status:'ok',uid:17,speciesId:6,formId:'charizard-mega-x',stoneId:'charizardite-x'});
  expect(JSON.stringify(ordinary)).toBe(before);
  const mega={...ordinary,megaForm:'charizard-mega-x'};
  expect(kantoMegaOptions(6,mega.megaForm)).toEqual([]);
  expect(quoteKantoMegaChoice(mega,'charizard-mega-y').status).toBe('already-mega');
  expect(quoteKantoMegaChoice(ordinary,'venusaur-mega').status).toBe('incompatible');
  expect(quoteKantoMegaChoice({uid:1,pokemonId:150},'mewtwo-mega-x').status).toBe('incompatible');
  expect(kantoPokemonFormProfile(6,'blastoise-mega')).toBeNull();
  expect(kantoPokemonFormProfile(6,null)).toBeNull();
  expect(kantoMegaForm('__proto__')).toBeNull();
 });
 it('uses the same level/manual/trainer/mastery formulas without double counting',()=>{
  const ordinary=kantoPokemonFormProfile(6)!,mega=kantoPokemonFormProfile(6,'charizard-mega-x')!;
  const manual={...zeroStats(),attack:10},trainer={...zeroStats(),attack:40};
  const own=pokemonOwnStats(mega.base,100,manual),old=pokemonOwnStats(ordinary.base,100,manual);
  expect(own.hp).toBe(old.hp);expect(own.attack-old.attack).toBe(92);
  const final=pokemonFinalStats(mega.base,100,manual,trainer,100);
  expect(final.attack-own.attack).toBe(4);
  expect(pokemonMasteryStats(final,3).attack).toBe(Math.floor(final.attack*1.03));
 });
});
