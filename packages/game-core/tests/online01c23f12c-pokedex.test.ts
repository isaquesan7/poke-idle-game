import {describe,it,expect} from 'vitest';
import {onlinePokedexProjection,onlinePokedexDetail} from '../src/catalog/serverPokedex.js';
import {KANTO_POKEDEX} from '../src/catalog/kantoSpecies.js';
import {kantoTypeMultiplier} from '../src/combat/kantoBattle.js';
const zero=()=>({hp:0,attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0});
const fixture=()=>({version:1,mode:'normal',name:'Dex CI',trainer:{level:1,xp:0,manual:zero()},coins:0,wins:0,losses:0,seen:[4,10,10],caughtSpecies:[4],badges:[],roster:[{uid:1,pokemonId:4,level:1,xp:0,affinity:0,manual:zero(),moveName:'scratch',upgrades:{}},{uid:2,pokemonId:4,level:1,xp:0,affinity:0,manual:zero(),moveName:'scratch',upgrades:{}}],team:[1],nextUid:3,expedition:null});
describe('23F12C: online species journal encyclopedia',()=>{
 it('151 records; duplicates are not progress, unknown entries expose only ID/status',()=>{
  const dex=onlinePokedexProjection(JSON.stringify(fixture()))!;
  expect(dex.entries.length).toBe(151);
  expect([dex.caught,dex.seen,dex.unknown]).toEqual([1,1,149]);
  expect(dex.entries[3]).toMatchObject({id:4,status:'caught',name:'Charmander'});
  expect(dex.entries[9]).toMatchObject({id:10,status:'seen'});
  expect(dex.entries[149]).toEqual({id:150,status:'unknown'});
  expect(onlinePokedexDetail(JSON.stringify(fixture()),150)).toBeNull();
 });
 it('uses actual catalogue and hides undiscovered evolution identities',()=>{
  const raw=JSON.stringify(fixture()),detail=onlinePokedexDetail(raw,4)!;
  expect(detail.base).toEqual(KANTO_POKEDEX[3]!.base);
  expect(detail.evolution).toEqual([{target:null,trigger:'level',minLevel:16}]);
  expect(detail.matchups.weak).toContainEqual({type:'water',multiplier:kantoTypeMultiplier('water',['fire'])});
  expect(detail.moves.some(m=>m.name==='ember')).toBe(true);
  const s=fixture();s.seen.push(5);
  expect(onlinePokedexDetail(JSON.stringify(s),4)!.evolution[0]!.target).toEqual({id:5,name:'Charmeleon'});
 });
 it('retains species history when current roster evolves and rejects malformed IDs',()=>{
  const s=fixture();s.roster[0]!.pokemonId=5;s.roster[1]!.pokemonId=5;s.caughtSpecies.push(5);
  expect(onlinePokedexProjection(JSON.stringify(s))!.caught).toBe(2);
  s.seen.push(999);expect(onlinePokedexProjection(JSON.stringify(s))).toBeNull();
  expect(onlinePokedexProjection('{')).toBeNull();
 });
});
